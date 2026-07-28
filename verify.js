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

const day = iso => (iso ? String(iso).slice(0, 10) : null);

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

   'dead'    — a death date, from either database. Only a recorded death
               makes anyone dead. Nothing is inferred into this bucket.
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
   moves someone out of 'alive' — evidence, not arithmetic. */
export function statusOf(person) {
  if (!person) return 'unknown';

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

  if (!births.length) return 'unknown';

  const corroborated = births.length === 2 && births[0].year === births[1].year;
  if (!births.some(b => b.exact) && !corroborated) return 'unknown';

  /* Old enough that neither 'alive' nor 'dead' is a claim we can make. */
  const age = new Date().getUTCFullYear() - Math.max(...births.map(b => b.year));
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
  const buried = new Set();

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
      if (candidates.length === 1 && candidates[0].dod) buried.add(person.id);
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

   Without a TMDB id there is nothing to ask, and this returns no
   objection. Read that as absence, never as agreement. */
export async function survivors({ film, tmdbId, sparql, tmdb }) {
  if (!tmdbId) return { alive: [], unknown: 0 };

  try {
    const credits = await tmdb(`/movie/${encodeURIComponent(tmdbId)}/credits`);
    if (!credits) return { alive: [], unknown: 0 };

    const { cast, crew } = credits;
    const everyone = [...(Array.isArray(cast) ? cast : []),
                      ...(Array.isArray(crew) ? crew : [])];
    if (!everyone.length) return { alive: [], unknown: 0 };

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
    if (!missing.length) return { alive: [], unknown: 0 };

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
      SELECT ?tmdb ?p ?pLabel ?dob ?prec ?dod WHERE {
        VALUES ?tmdb { ${missing.map(i => `"${i}"`).join(' ')} }
        ?p wdt:P4985 ?tmdb .
        OPTIONAL {
          ?p p:P569/psv:P569 ?birth .
          ?birth wikibase:timeValue ?dob ; wikibase:timePrecision ?prec .
        }
        OPTIONAL { ?p wdt:P570 ?dod }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "${LANGS}". }
      }`).catch(() => []);

    const names = new Map(everyone.map(c => [String(c.id), c.name]));

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
        name: r.pLabel || null,
        born: day(r.dob),
        precision: Number(r.prec ?? 0),
        died: day(r.dod),
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
      wd: wikidata.get(id) || null,
      tmdb: tmdbDates.get(id) || null,
    }));

    /* Pass three — Wikidata again, by name, for anyone still standing. */
    const buried = await deathsByName(
      people.filter(p => bornYear(p) && statusOf(p) !== 'dead'), sparql);

    const alive = [];
    let unknown = 0;
    for (const person of people) {
      if (buried.has(person.id)) continue;   /* Wikidata knows better. */
      const status = statusOf(person);
      if (status === 'alive') alive.push(person.name);
      else if (status === 'unknown') unknown++;
    }

    return { alive, unknown };
  } catch {
    return { alive: [], unknown: 0 };
  }
}
