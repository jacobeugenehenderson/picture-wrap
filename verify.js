/* verify.js — is anyone who made this picture still alive?
   ==========================================================================

   The one implementation. Both halves import it: the poster before it will
   queue a closing, the browser before it will raise the bar to the top.

   It lived in poster/lib.js until now, and the browser carried its own
   copy. That copy kept every bug the original had after the original was
   fixed — three times, over three separate fixes, which is the whole
   argument for this file existing. If you find yourself writing a second
   version of anything below, that is the mistake happening again.

   Nothing here fetches on its own. The caller passes in how to reach
   Wikidata and TMDB, because that is the one thing the two halves cannot
   share: the poster sends a User-Agent and retries on 429, and the browser
   is not allowed to do either.

     sparql(query)  -> array of plain {var: value} rows
     tmdb(path)     -> parsed JSON, or null on any failure

   Everything else — what the answers mean — is identical on both sides,
   and must stay that way.                                                 */

import { VALUES, LANGS } from './shared.js';

/* TMDB person records, cached for the life of the page or process. The
   same bit player turns up across dozens of pictures in a single backfill
   year and there is no reason to ask twice. */
const personCache = new Map();

/* The age past which we stop claiming to know. Not "nobody has lived this
   long" — Jeanne Calment reached 122. It is the age past which a birth
   date and no death record stops being evidence in either direction, and
   the answer becomes 'unknown'.

   It is still a chosen number, which is the honest thing to say about it.
   It is defensible because of what it decides: it moves people from
   'alive' to 'unknown', never to 'dead'. Being wrong with it costs a
   picture its closing, not a false claim about a real person. */
const OLDEST = 112;

/* And the age past which we stop saying 'unknown', because there is
   nothing left to be unsure of. Jeanne Calment, 122 years and 164 days,
   is the longest life anyone has ever documented — so this is not a
   chosen number in the way OLDEST is. It is the record.

   The two lines do different jobs and the gap between them is the point.
   Past 112 a birth date no longer shows someone is living; past 122 it
   shows they are not. Between them we genuinely don't know.

   What it costs when it is wrong runs the other way from OLDEST, which is
   why it sits on the record rather than near it: being wrong here calls a
   living person dead. Nobody has ever been alive at 123.

   What it buys is not tidiness. Under 'unknown' alone, The Fortieth Door
   (1924) was held open by Bruce Gordon, born 1850, and would have been
   held open by him for ever — 14 of the 65 pictures from 1924 that
   Wikidata still shows as running are the same story. Those pictures
   never reached the Vault, never became candidates, and nothing anywhere
   reported them as a problem. */
const MAXIMUM_AGE = 122;

const thisYear = () => new Date().getUTCFullYear();

/* Could this person conceivably still be alive?

   Two facts, one sum. Nobody can have been born after the picture they
   worked on, so a missing birth date is not the absence of evidence it
   looks like — the release year is an upper bound on it, and the person
   is at least as old as the picture. Take whichever bound we have, ask
   how young the person could possibly be today, and compare that to the
   longest life on record.

   It answers 'no' or 'we can't say'. It never answers 'yes': being young
   enough to be alive is not being alive, and that is what the rest of
   this file is for. */
export function beyondLiving(born, releaseYear) {
  const year = Number(String(born || '').slice(0, 4))
    || Number(String(releaseYear || '').slice(0, 4)) || 0;
  return year > 0 && thisYear() - year > MAXIMUM_AGE;
}

/* The same line drawn as a year, for the places that have to ask it of
   Wikidata rather than of a person we already hold: born before this and
   there is no living to be beyond. Exported so no query hard-codes a
   year that quietly stops being true next January. */
export const earliestLivingBirthYear = () => thisYear() - MAXIMUM_AGE;

/* And the same line again as SPARQL, because half the places that need it
   are asking Wikidata for a survivor rather than judging someone we
   already hold. Drop it into a block that is matching people with no
   death date, and the block stops matching the ones no absence of a
   record can bring back.

   It is here, not in the four queries that use it, for the reason this
   whole file is here: the copy always outlives the fix.

     ?film ?prop ?alive .
     FILTER NOT EXISTS { ?alive wdt:P570 ?dd }
     ${couldBeLivingSparql('?alive', '?film')}

   `film` is optional and does the other half of the arithmetic: pass it
   and a picture older than any human life stops producing survivors at
   all, whether or not anyone recorded a birth date. */
export const couldBeLivingSparql = (person, film) => {
  const cut = earliestLivingBirthYear();
  return `FILTER NOT EXISTS { ${person} wdt:P569 ?ageBorn . FILTER(YEAR(?ageBorn) < ${cut}) }` +
    (film ? `\n    FILTER NOT EXISTS { ${film} wdt:P577 ?ageOut . FILTER(YEAR(?ageOut) < ${cut}) }` : '');
};

/* Is this a date, or a year with a placeholder stapled to it?

   Wikidata answers properly: every time value carries a precision, where
   11 means "to the day" and 9 means "only the year is known" — and a
   year-only value still serialises as 1 January, because it has to
   serialise as something. We ask for the precision rather than guess.

   TMDB publishes no precision at all, so there the 1 January ending is the
   only signal available and it is a proxy, not a fact. That is a limit of
   the source, not a rule anyone chose. */
const WD_PRECISION_DAY = 11;
const toTheDay = date => !/-01-01$/.test(String(date));

/* Wikidata hands back "1944-01-02T00:00:00Z"; TMDB hands back
   "1944-01-02". Everything downstream wants the second shape.

   And sometimes Wikidata hands back neither. P570 can carry "unknown
   value" — the editor asserting a death without a date — which the query
   service returns as a skolem IRI. Slicing that to ten characters gave
   Yumeko Aizome a death date of "http://www". The verdict was right by
   accident, because a URI is truthy and truthy meant dead, and the whole
   point of this file is not deciding things by accident. */
const day = iso => {
  if (!iso) return null;
  const text = String(iso);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
};

/* Did Wikidata assert a death at all, date or no date? "Unknown value" is
   an assertion — it says this person is gone and nobody recorded when. */
const asserted = value => value != null && String(value) !== '';

/* A Wikidata query's raw columns, turned into the record `statusOf` reads.

   Exported because callers that judge Wikidata's own credits — the pass,
   and anything else that holds dates before this file sees them — were
   otherwise going to re-implement the three lines above: which slice is a
   date, what an undated death means, where precision lives. Those are not
   parsing details, they are the difference between a verdict and an
   accident, and this file exists so there is one copy of them.

   Two precisions, and they are not interchangeable. The first pilot run
   dated a wrap to 2000-01-01 on Mary Parker, whose BIRTH is recorded to
   the day and whose death is a bare year — because a single `precision`
   field was written by the birth and then read by the death. A record
   with one precision on it will always end up answering for the wrong
   date eventually. */
export const fromWikidata = (born, precision, died, diedPrecision) => ({
  born: day(born),
  precision: Number(precision ?? 0),
  died: day(died),
  diedPrecision: Number(diedPrecision ?? 0),
  deathAsserted: asserted(died),
});

/* Is a death date solid enough to date a wrap with?

   Vetoing on a shaky record is safe — it leaves a picture open. Dating on
   one is a claim the whole page is built around, and 2000-01-01 is a year
   wearing a date's clothes. Wikidata publishes precision, so we ask; TMDB
   does not, so the 1 January ending is the only signal there. */
export const datesAWrap = person =>
  Boolean((person?.wd?.died && person.wd.diedPrecision >= WD_PRECISION_DAY)
    || (person?.tmdb?.died && toTheDay(person.tmdb.died)));

/* When did a closed picture close, and who closed it?

   Here rather than in a caller, because within an hour of the rule being
   written there were three copies of it — the pass, the rebuild and the
   audit — and two of them already disagreed. That is the exact history
   this file exists to stop repeating.

   The rule: the LAST death decides, whatever precision it was recorded
   at. Taking the last precisely-recorded death instead is the tempting
   version, because it always yields a printable date — and it is wrong
   in a way that matters. Los misterios del turf argentino would have read
   "Julio Irigoyen was the last of its makers, 29 August 1967" while
   Aparicio Podestá, also credited, died in 1979. Twelve years and the
   wrong name, bought with a prettier date. 56 pictures in 1924 alone.

   So three answers, and the caller renders what it likes:

     day    a death recorded to the day. The only one that may print as a
            date, and the only one that may name a person in a wrap line.
     year   the last death is real but recorded only to the year. The
            picture wrapped that year, on a day nobody wrote down.
     none   no death recorded anywhere. Closed by arithmetic, and it has
            no place on a timeline at all. */
export function wrapDate(judged) {
  const dated = judged
    .filter(p => p.status === 'dead' && !p.impossible)
    .map(p => ({ person: p, died: p.wd?.died || p.tmdb?.died }))
    .filter(d => d.died)
    .sort((a, b) => b.died.localeCompare(a.died));

  if (!dated.length) {
    return { wrapped: null, wrappedYear: null, dateBasis: 'none', last: null };
  }

  const last = dated[0];
  const precise = Boolean(last.person.datesAWrap ?? datesAWrap(last.person));

  return {
    wrapped: precise ? last.died : null,
    wrappedYear: last.died.slice(0, 4),
    dateBasis: precise ? 'day' : 'year',
    last: {
      wikidataId: last.person.wikidataId || null,
      tmdbId: last.person.tmdbId || null,
      name: last.person.name,
      died: last.died,
      source: last.person.source || null,
    },
  };
}

/* The year either database gives, preferring Wikidata where both do. */
const bornYear = person =>
  Number(String(person?.wd?.born || person?.tmdb?.born || '').slice(0, 4)) || 0;

async function mapLimit(items, limit, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...await Promise.all(items.slice(i, i + limit).map(fn)));
  }
  return out;
}

/* Dead, alive, or unknown — and the three are not interchangeable.

   'dead'    — a death date from either database, or an age no human has
               ever reached. Those are the only two ways in. The second
               infers a death but never a date, and the difference decides
               everything downstream: a picture can close on it, and no
               picture can be dated by it.
   'alive'   — a birth date we can credit, and no death anywhere.
   'unknown' — no usable evidence. Not an answer, never read as 'dead'.

   A birth date is creditable if it is precise, or if both databases give
   one and agree on the year. A lone imprecise date is a year somebody
   typed, and a year is not a person: Bill Alcorn, "Soldier (uncredited)"
   in Mildred Pierce, exists as `1920-01-01` in TMDB and nowhere else at
   all. That is not a survivor to set against a picture.

   Note which way the errors run. 'alive' is what vetoes a closing, so
   over-crediting a birth date costs a picture its wrap, while
   under-crediting one risks closing a picture on somebody's silence. The
   second is the expensive mistake, which is why corroboration is what
   moves someone out of 'alive' — evidence, not arithmetic.

   `releaseYear` is what lets the arithmetic reach someone with no birth
   date at all: they cannot have been born after the picture. */
export function statusOf(person, releaseYear) {
  if (!person) return 'unknown';

  /* A death Wikidata asserts without dating is still a death. Reading it
     off the date alone worked only because an undatable value happened to
     be a non-empty string. */
  if (person.wd?.deathAsserted) return 'dead';
  const died = person.wd?.died || person.tmdb?.died || null;
  if (died) return 'dead';

  const births = [
    person.wd?.born
      ? { year: Number(person.wd.born.slice(0, 4)),
          exact: person.wd.precision >= WD_PRECISION_DAY }
      : null,
    person.tmdb?.born
      ? { year: Number(person.tmdb.born.slice(0, 4)),
          exact: toTheDay(person.tmdb.born) }
      : null,
  ].filter(b => b && b.year);

  /* The youngest they could possibly be. With no birth date on either
     side that is the picture's own age, since nobody worked on a film
     before they were born. */
  const youngest = births.length ? Math.max(...births.map(b => b.year)) : null;

  if (beyondLiving(youngest, releaseYear)) return 'dead';

  if (!births.length) return 'unknown';

  /* Precision matters for 'alive' and not for the line above it. Whether
     a birth date is exact to the day changes nothing about a man born in
     1850: no reading of that year leaves him living. */
  const corroborated = births.length === 2 && births[0].year === births[1].year;
  if (!births.some(b => b.exact) && !corroborated) return 'unknown';

  /* Old enough that neither 'alive' nor 'dead' is a claim we can make. */
  const age = thisYear() - youngest;
  return age > OLDEST ? 'unknown' : 'alive';
}

/* Which of these people does Wikidata know to be dead, found by name?

   The gap this closes: a person is linked to Wikidata only through P4985,
   the TMDB person id. Plenty of people Wikidata knows perfectly well have
   no such link — so they fall past the id lookup to TMDB, TMDB has no
   death date, and we announce them as a survivor.

   Péter Eötvös is the case that found it. Died 24 March 2024, recorded on
   Wikidata, no P4985 — and we reopened Cats' Play on him. A name is not a
   good key, but it is the key we have, and it beats deciding from TMDB's
   silence alone.

   Guarded on the birth year matching exactly, which is why only people
   with a birth date are asked about. An exact name match is common enough
   to be dangerous on its own — there are several of most names — but a
   name and a birth year together is a different claim. If more than one
   person clears the guard we have found ambiguity, not an answer, and the
   caller keeps whatever it already believed.

   Any failure returns an empty set: this pass can only move someone out of
   'alive', so losing it costs a closing, never a claim. */
const NAME_BATCH = 60;

async function deathsByName(people, sparql) {
  /* A map, not a set: which Wikidata item matched and what death it
     carried, so the burial can be checked later instead of taken on
     trust. It was a bare set of ids, which recorded THAT we had decided
     someone was dead and nothing about why — on an inference from a name
     and a birth year, which is the weakest evidence this file acts on.

     The date is kept for the record and is deliberately not allowed to
     date a wrap: a name match is good enough to stop claiming somebody
     is alive, and not good enough to put a day on the headline claim. */
  const buried = new Map();

  /* Quotes and backslashes would break out of the SPARQL literal, and a
     name that long is a data error rather than a person. */
  const asking = people.filter(p =>
    p.name && p.name.length <= 60 && !/["\\\n]/.test(p.name) && bornYear(p));
  if (!asking.length) return buried;

  for (let i = 0; i < asking.length; i += NAME_BATCH) {
    const batch = asking.slice(i, i + NAME_BATCH);
    const values = batch.map(p => `"${p.name}"@en`).join(' ');

    /* wdt:P31 wd:Q5 keeps films, characters and songs that share a name
       out of it. rdfs:label only, not altLabel: alt labels multiply the
       match set and the query time, and TMDB records the common form of a
       name, which is what rdfs:label holds. */
    const rows = await sparql(`
      SELECT ?name ?p ?dob ?dod WHERE {
        VALUES ?name { ${values} }
        ?p rdfs:label ?name ; wdt:P31 wd:Q5 .
        OPTIONAL { ?p wdt:P569 ?dob }
        OPTIONAL { ?p wdt:P570 ?dod }
      }`).catch(() => []);

    const byName = new Map();
    for (const r of rows) {
      if (!byName.has(r.name)) byName.set(r.name, []);
      byName.get(r.name).push(r);
    }

    for (const person of batch) {
      const born = bornYear(person);
      const candidates = (byName.get(person.name) || []).filter(r =>
        Number(String(r.dob || '').slice(0, 4)) === born);

      /* One match, and it has a death date. Anything else is a guess. */
      if (candidates.length === 1 && candidates[0].dod) {
        buried.set(person.id, {
          wikidataId: candidates[0].p ? String(candidates[0].p).split('/').pop() : null,
          died: day(candidates[0].dod),
          matchedOn: `${person.name}, born ${born}`,
        });
      }
    }
  }

  return buried;
}

/* Everyone TMDB credits who might still be alive, and a count of the ones
   nobody can answer for.

   Three passes, because neither database is complete and they are
   incomplete in different places.

     1. Wikidata by TMDB id — birth and death dates for everyone it links.
     2. TMDB's own dates for everyone Wikidata has not buried.
     3. Wikidata again, by name, for whoever is still standing.

   Every one of those exists because of a specific wrong answer. Asking
   TMDB who was in a film and then asking only Wikidata whether they were
   alive counted everyone unmatched as dead, and put pictures with living
   bit players in the Vault. Stopping at pass one because Wikidata had
   heard of someone counted people TMDB had buried as survivors. Stopping
   at pass two counted people with no P4985 link — Péter Eötvös, dead in
   2024 and recorded — as survivors too.

   The rule underneath all three: an absent death date is not a pulse. It
   is an absent death date, and the answer to it is 'unknown'.

   Returns { alive, unknown }. A non-empty `alive` means the picture is not
   closed. A non-zero `unknown` is not a veto — for a 1935 picture almost
   every unknown really is dead — but it is the honest measure of how much
   of the claim rests on nothing.

   `ok` says whether the test actually ran. An empty `alive` with ok:false
   is not a finding of nobody — it is a lookup that failed, or a film with
   no TMDB id to ask about. The poster can live with the difference,
   because a human reads its queue. The browser cannot: there, an
   unchecked picture drawn as wrapped is a false claim on screen. Callers
   must decide what silence means for them rather than being handed a
   confident empty list. */
/* Nobody can have worked on a picture released before they were born.

   That is arithmetic, not a heuristic, and it catches a class of error we
   inherit rather than create: Wikidata name collisions. The Doctor Who
   William Russell, born 1924, is credited on Anna Christie (1923). A
   British character actor born 1942 is credited on Evangeline (1919). Rae
   Allen, born 1926, on The Misleading Lady (1920).

   About 0.4% of the Vault, but concentrated at the extremes — every one
   of the six longest gaps between release and closing turned out to be
   one of these, so they dominate exactly the lists a reader would find
   interesting.

   Two things it fixes. The closing date and the "last of its makers"
   line, which are the headline claims on every page and every post. And,
   more seriously, a *living* person misattributed to an old picture would
   veto it forever — the wrap could never happen, and nothing would ever
   explain why. */
export function impossible(person, releaseYear) {
  if (!releaseYear) return false;
  const born = Number(String(person?.wd?.born || person?.tmdb?.born || '').slice(0, 4));
  return born > 0 && born > releaseYear;
}

export async function survivors({ film, tmdbId, media = 'movie', year, sparql, tmdb, detail = false }) {
  if (!tmdbId) return { alive: [], unknown: 0, ok: false };

  try {
    /* A series is not a long film. TMDB keeps them apart, and so must we:
       /movie/{id}/credits against a series id answers about whatever film
       happens to hold that number.

       aggregate_credits, not credits, because a series' /credits is only
       the billed regulars — five people for BoJack Horseman, against 248
       cast and 179 crew in the aggregate. Everyone who ever appeared is
       the question this project asks. */
    const credits = await tmdb(media === 'tv'
      ? `/tv/${encodeURIComponent(tmdbId)}/aggregate_credits`
      : `/movie/${encodeURIComponent(tmdbId)}/credits`);
    if (!credits) return { alive: [], unknown: 0, ok: false };

    /* The two endpoints disagree about shape. A film credit carries
       `character` and `job` directly; an aggregate series credit carries
       `roles` and `jobs` arrays, because one person may have played three
       parts across nine years. Flattened here, once. */
    const flatten = (list, key) => (Array.isArray(list) ? list : []).map(c => ({
      ...c,
      character: c.character ?? c.roles?.[0]?.character ?? null,
      job: c.job ?? c.jobs?.[0]?.job ?? null,
      _cast: key === 'cast',
    }));

    const cast = flatten(credits.cast, 'cast');
    const crew = flatten(credits.crew, 'crew');
    const everyone = [...cast, ...crew];
    if (!everyone.length) return { alive: [], unknown: 0, ok: false };

    const ids = [...new Set(everyone.map(c => String(c.id)))];

    /* People Wikidata already ties to this film are somebody else's
       problem — the caller has tested them against Wikidata's own dates. */
    const known = await sparql(`
      SELECT ?tmdb WHERE {
        VALUES ?prop { ${VALUES} }
        wd:${film} ?prop ?p . ?p wdt:P4985 ?tmdb .
      }`);
    const have = new Set(known.map(r => r.tmdb));
    const missing = ids.filter(id => !have.has(id));

    /* Everyone TMDB names is already linked from the film's own Wikidata
       item, so Wikidata's test covered all of them. Nothing left to ask,
       and that IS a complete answer. */
    if (!missing.length) return { alive: [], unknown: 0, ok: true };

    /* Pass one — Wikidata by TMDB id.

       Birth date as well as death date. An item with no P570 is not a
       person who is alive, it is a person nobody has buried in public, and
       reading the one as the other is this project's oldest mistake with
       the two databases swapped. Helen Hunt — hairdresser on Cover Girl,
       1944 — has a Wikidata item carrying no dates at all, and used to
       veto the picture on the strength of it.

       LANGS, not "en": the label service hands back the bare Q-number when
       a person has no label in the language asked for, and this list is
       largely people who don't.

       The birth date comes through the full statement path rather than
       `wdt:`, because that is the only way to reach its precision. */
    const rows = await sparql(`
      SELECT ?tmdb ?p ?pLabel ?dob ?prec ?dod ?deathPrec ?img WHERE {
        VALUES ?tmdb { ${missing.map(i => `"${i}"`).join(' ')} }
        ?p wdt:P4985 ?tmdb .
        OPTIONAL {
          ?p p:P569/psv:P569 ?birth .
          ?birth wikibase:timeValue ?dob ; wikibase:timePrecision ?prec .
        }
        /* Both paths for the death, and both are needed. The truthy one
           still answers "is there a death at all", including the undated
           assertion that has no time value to reach. The statement path
           answers "how precisely is it known", which is what may date a
           wrap. Asking only the second would read an undated death as no
           death. */
        OPTIONAL { ?p wdt:P570 ?dod }
        OPTIONAL {
          ?p p:P570/psv:P570 ?death .
          ?death wikibase:timePrecision ?deathPrec .
        }
        OPTIONAL { ?p wdt:P18 ?img }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "${LANGS}". }
      }`).catch(() => []);

    const names = new Map(everyone.map(c => [String(c.id), c.name]));

    /* What each person did on the picture, so a survivor can be shown as a
       row in the roster rather than described in a sentence underneath it.
       Cast entries carry a character, crew entries carry a job. */
    const billing = new Map();
    for (const c of everyone) {
      const id = String(c.id);
      if (billing.has(id)) continue;
      billing.set(id, {
        role: c.character || c.job || null,
        onScreen: !!c._cast,
      });
    }

    /* One TMDB id can be claimed by more than one Wikidata item, and when
       it is, taking the first row is not a choice — SPARQL does not order
       results, so it is a coin flip that lands differently between runs.

       TMDB person 31220 is "Jorge Busto", who edited a picture in 1940 and
       has no dates. Two Wikidata items claim him: one with no dates, one
       born in 1982. Whichever came back first decided whether a man born
       forty-two years after the picture vetoed it.

       Two items claiming one identifier is ambiguity, not evidence. We
       keep neither and let TMDB answer instead. */
    const claims = new Map();
    for (const r of rows) {
      if (!claims.has(r.tmdb)) claims.set(r.tmdb, new Map());
      claims.get(r.tmdb).set(r.p ?? r.pLabel ?? '', r);
    }

    const wikidata = new Map();
    for (const [id, items] of claims) {
      if (items.size !== 1) continue;       /* Contested. Nobody wins. */
      const r = [...items.values()][0];
      wikidata.set(id, {
        entity: r.p || null,
        name: r.pLabel || null,
        /* Only the site wants this, and only for someone it is about to
           put in a roster beside people who have one. Free here: the
           query is already asking this item about itself. */
        img: r.img || null,
        born: day(r.dob),
        precision: Number(r.prec ?? 0),
        died: day(r.dod),
        diedPrecision: Number(r.deathPrec ?? 0),
        deathAsserted: asserted(r.dod),
      });
    }

    /* Pass two — TMDB's own dates, for everyone Wikidata has not buried.
       That is a wider net than "everyone Wikidata has never heard of", and
       the difference is where the errors were living: Robert Amon has a
       Wikidata item with no dates and a TMDB record saying he died in
       November 1992. Wikidata had claimed him, so TMDB was never asked. */
    const unburied = missing.filter(id => wikidata.get(id)?.died == null);
    const fetched = await mapLimit(unburied, 8, async id => {
      if (personCache.has(id)) return [id, personCache.get(id)];
      const p = await tmdb(`/person/${encodeURIComponent(id)}`);
      const rec = p
        ? { name: p.name || null, born: p.birthday || null, died: p.deathday || null }
        : null;
      personCache.set(id, rec);
      return [id, rec];
    });
    const tmdbDates = new Map(fetched);

    /* Both records, kept apart rather than merged. Whether two sources
       independently give the same birth year is itself evidence, and
       flattening them into one field throws that away. */
    const people = missing.map(id => ({
      id,
      name: wikidata.get(id)?.name || names.get(id) || id,
      wdEntity: wikidata.get(id)?.entity || null,
      wd: wikidata.get(id) || null,
      tmdb: tmdbDates.get(id) || null,
    }));

    /* Anyone Wikidata or TMDB says was born after the picture came out was
       not on it. Dropped before any of them can vote. */
    const releaseYear = Number(String(year || '').slice(0, 4)) || 0;
    const credible = people.filter(p => !impossible(p, releaseYear));

    /* Pass three — Wikidata again, by name, for anyone still standing. */
    const buried = await deathsByName(
      credible.filter(p => bornYear(p) && statusOf(p, releaseYear) !== 'dead'), sparql);

    /* `alive` carries people, not names. The poster only ever wanted the
       name, but the site has to put a survivor in the list beside everyone
       else — and a name alone cannot be a row. */
    const alive = [];
    let unknown = 0;
    for (const person of credible) {
      if (buried.has(person.id)) continue;   /* Wikidata knows better. */
      const status = statusOf(person, releaseYear);
      if (status === 'alive') {
        alive.push({
          tmdbId: person.id,
          name: person.name,
          born: person.wd?.born || person.tmdb?.born || null,
          wikidata: person.wdEntity || null,
          img: person.wd?.img || null,
          role: billing.get(person.id)?.role || null,
          onScreen: billing.get(person.id)?.onScreen ?? true,
        });
      } else if (status === 'unknown') unknown++;
    }

    /* Asked for by explain.js, so a verdict can be shown with its
       evidence rather than asserted. Off by default: the poster wants an
       answer, and building the working out for six thousand pictures
       nobody will read is waste. It is the SAME array the decision was
       made from — a separate diagnostic path would eventually disagree
       with the real one, which is the mistake this file exists to end. */
    const working = detail
      ? credible.map(p => ({
          name: p.name,
          tmdbId: p.id,
          wikidataId: p.wdEntity,
          status: buried.has(p.id) ? 'dead' : statusOf(p, releaseYear),
          buriedByName: buried.get(p.id) ?? false,
          /* Recorded so a stored verdict can be re-decided later without
             asking anybody again. Precision travels with the date: a
             later pass changing a threshold needs to know whether a year
             was a year or a placeholder. */
          datesAWrap: datesAWrap(p),
          wikidata: p.wd
            ? { born: p.wd.born, precision: p.wd.precision, died: p.wd.died,
                deathAsserted: p.wd.deathAsserted }
            : null,
          tmdb: p.tmdb ? { born: p.tmdb.born, died: p.tmdb.died } : null,
        }))
      : undefined;

    /* How many people TMDB credits at all — the denominator of coverage,
       free here because the credits list is already in hand, and needing
       a second fetch of the same endpoint anywhere else. */
    return {
      alive, unknown, ok: true, tmdbCredited: everyone.length,
      ...(detail ? { working } : {}),
    };
  } catch {
    return { alive: [], unknown: 0, ok: false };
  }
}
