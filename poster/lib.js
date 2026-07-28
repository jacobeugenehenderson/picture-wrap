/* ==========================================================================
   PICTURE WRAP — poster/lib.js

   Shared queries and file handling. Nothing here posts anything; run.js
   finds candidates, review.js is the only path to Bluesky.
   ========================================================================== */

import { readFile, writeFile } from 'node:fs/promises';

import { measure, LIMIT } from './bluesky.js';
import {
  CREDITS, CREDIT_NOUNS, OCCUPATIONS, IN_LIST, VALUES, LANGS,
  qid, year, longDate, pickDemonym, slug, path, unnamed,
} from '../shared.js';

/* Re-export everything taken from shared.js, not a subset. IN_LIST, VALUES
   and LANGS were missing here, so recheck.js and recover.js re-derived
   them locally — and their derivation broke silently when CREDITS became
   an array of pairs. A partial re-export is an invitation to duplicate. */
export { CREDITS, CREDIT_NOUNS, OCCUPATIONS, IN_LIST, VALUES, LANGS,
         qid, year, longDate, pickDemonym, slug, path, unnamed };
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));

const WDQS = 'https://query.wikidata.org/sparql';

/* Wikidata asks for a descriptive agent on automated queries. Put a real
   contact in here — it's how they reach you instead of blocking you. */
const AGENT = 'PictureWrap/1.0 (https://picture-wrap.com; jacob@jacobhenderson.studio)';


/* A COST control for the backfill, and nothing else.

   It was once a correctness guard: the post said "X has wrapped", a bare
   claim that needed a rule deciding when it was safe. That rule is gone.
   The post states its own basis now — "all 51 people credited on Casablanca
   have now died" — which is true whatever Wikidata is missing, and a thin
   record announces its own thinness: "the 1 person credited on The Stone
   Boy has now died" tells a reader exactly what they are looking at.

   What remains is editorial, and both paths need it. The backfill would
   otherwise spend hours testing one-name stubs. The sweep would otherwise
   queue everything: a 45-day window produced 540 films, 397 with ZERO
   cast recorded — documentaries where Wikidata knows a director and no
   one else. Nothing false gets published without it, since the post
   states its own basis. But an unreadable queue defeats the only
   protection this project has, which is that a person looks. */
export const MIN_CAST = 5;

/* How many pictures a single post will name before deferring to the site.
   A fixed cap keeps posts a predictable shape; the person's page carries
   the complete list. */
export const MAX_LISTED = 5;


/* --- query ------------------------------------------------------------- */

export async function sparql(query, { retries = 3 } = {}) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(WDQS + '?query=' + encodeURIComponent(query), {
      headers: { Accept: 'application/sparql-results+json', 'User-Agent': AGENT },
    });

    if (res.ok) {
      const json = await res.json();
      return json.results.bindings.map(row => {
        const out = {};
        for (const k in row) out[k] = row[k].value;
        return out;
      });
    }

    /* 429 and 503 are the query service asking for patience. */
    if (attempt > retries || ![429, 500, 502, 503, 504].includes(res.status)) {
      throw new Error(`WDQS ${res.status} after ${attempt} attempt(s)`);
    }
    await sleep(attempt * 5000);
  }
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));

/* --- the two queries the sweep needs ----------------------------------- */

/* Everyone with a screen credit whose death was recorded in the window.
   These are the only people who can possibly have closed a film. */
export const recentDeathsQuery = days => `
SELECT ?p ?pLabel ?dod WHERE {
  ?p wdt:P570 ?dod .
  FILTER(?dod > (NOW() - "P${days}D"^^xsd:duration))
  FILTER(?dod <= NOW())
  VALUES ?prop { ${VALUES} }
  ?film ?prop ?p .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr,de,it,es,pt,nl,sv,da,no,fi,is,pl,cs,sk,hu,ro,bg,sr,hr,sl,uk,ru,el,tr,he,ar,fa,hi,bn,ta,te,ml,kn,mr,ur,th,vi,id,ms,ja,ko,zh,ca,eu,gl,et,lv,lt,ga,cy,sq,mk,ka,hy,az,kk,uz,af,sw,yi,la". }
} GROUP BY ?p ?pLabel ?dod ORDER BY DESC(?dod)`;

/* Films this person is credited on where nobody credited is still living.
   The nested FILTER NOT EXISTS is the whole test: no credited person
   lacking a death date. Runs in ~2.5s for a heavily-credited actor. */
export const wrappedFilmsQuery = id => `
SELECT ?film ?filmLabel (SAMPLE(?y) AS ?year)
       (COUNT(DISTINCT ?cm) AS ?castCount) (MAX(?dv) AS ?wrapped) WHERE {
  VALUES ?mine { ${VALUES} }
  ?film ?mine wd:${id} .
  FILTER NOT EXISTS {
    ?film ?a2 ?alive .
    FILTER(?a2 IN (${IN_LIST}))
    FILTER NOT EXISTS { ?alive wdt:P570 ?dd }
  }
  ?film ?any ?c .
  FILTER(?any IN (${IN_LIST}))
  ?c wdt:P570 ?dv .
  OPTIONAL { ?film wdt:P161 ?cm }
  OPTIONAL { ?film wdt:P577 ?rd . BIND(YEAR(?rd) AS ?y) }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr,de,it,es,pt,nl,sv,da,no,fi,is,pl,cs,sk,hu,ro,bg,sr,hr,sl,uk,ru,el,tr,he,ar,fa,hi,bn,ta,te,ml,kn,mr,ur,th,vi,id,ms,ja,ko,zh,ca,eu,gl,et,lv,lt,ga,cy,sq,mk,ka,hy,az,kk,uz,af,sw,yi,la". }
} GROUP BY ?film ?filmLabel`;

/* Who closed it. During a sweep this is usually the person we're already
   holding, but backfilled films need it looked up. */
/* The character comes back only when Wikidata carries the P453 qualifier,
   and coverage is uneven enough that the post must work without it:
   The Godfather has 28 of 40 named, Casablanca has 2 of 51. */
export const lastPersonQuery = film => `
SELECT ?p ?pLabel ?dod ?charLabel ?roleLabel WHERE {
  VALUES ?prop { ${VALUES} }
  wd:${film} ?prop ?p .
  ?p wdt:P570 ?dod .
  OPTIONAL { wd:${film} p:P161 ?st . ?st ps:P161 ?p . ?st pq:P453 ?char }
  OPTIONAL { wd:${film} wdt:P57 ?p . BIND(wd:Q2526255 AS ?role) }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr,de,it,es,pt,nl,sv,da,no,fi,is,pl,cs,sk,hu,ro,bg,sr,hr,sl,uk,ru,el,tr,he,ar,fa,hi,bn,ta,te,ml,kn,mr,ur,th,vi,id,ms,ja,ko,zh,ca,eu,gl,et,lv,lt,ga,cy,sq,mk,ka,hy,az,kk,uz,af,sw,yi,la". }
} ORDER BY DESC(?dod) LIMIT 1`;

/* The names you'd recognise. The person who closes a picture is almost by
   definition obscure — the last survivor is rarely the star — so a title
   and a stranger's name isn't enough to place a film. "Casablanca" needs
   "Bogart" beside it before it's THAT Casablanca.

   Sitelink count (how many Wikipedias carry an article) is a decent fame
   proxy and costs nothing extra: Casablanca returns Bergman and Bogart,
   The Godfather returns Brando and Pacino. */
export const detailsQuery = film => `
SELECT ?p ?pLabel ?n ?fame ?tmdb WHERE {
  wd:${film} wdt:P161 ?p .
  ?p wikibase:sitelinks ?n .
  OPTIONAL { wd:${film} wikibase:sitelinks ?fame }
  OPTIONAL { wd:${film} wdt:P4947 ?tmdb }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr,de,it,es,pt,nl,sv,da,no,fi,is,pl,cs,sk,hu,ro,bg,sr,hr,sl,uk,ru,el,tr,he,ar,fa,hi,bn,ta,te,ml,kn,mr,ur,th,vi,id,ms,ja,ko,zh,ca,eu,gl,et,lv,lt,ga,cy,sq,mk,ka,hy,az,kk,uz,af,sw,yi,la". }
} ORDER BY DESC(?n) LIMIT 5`;

/* How complete is Wikidata's cast list, actually?

   Every guard in this project used to be a guess at that question. It
   doesn't have to be: Wikidata carries the TMDB film id (P4947) for
   essentially every picture, and TMDB's cast lists are far fuller. So ask.

     The Stone Boy   Wikidata 1  / TMDB ~20  =   5%   a stub
     Casablanca      Wikidata 51 / TMDB ~60  =  85%   trustworthy

   Needs TMDB_KEY in the environment. Without it this returns null and
   everything carries on exactly as before — coverage simply isn't shown.
   This is the POSTER's key, read from the environment and never shipped
   anywhere; it is not the public one in the website's app.js. */
export async function tmdbCastCount(tmdbFilmId) {
  const key = process.env.TMDB_KEY;
  if (!key || !tmdbFilmId) return null;
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${encodeURIComponent(tmdbFilmId)}` +
      `/credits?api_key=${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    const { cast } = await res.json();
    return Array.isArray(cast) ? cast.length : null;
  } catch {
    return null;
  }
}

/* Wikidata's count over TMDB's, 0-1. Null when we couldn't ask. */
export function coverage(wikidataCast, tmdbCast) {
  if (!tmdbCast) return null;
  return Math.min(1, wikidataCast / tmdbCast);
}

/* What kind of thing this is, and where it's from. Kept as its own query
   rather than folded into detailsQuery: P31 and P495 both carry several
   values, and joining them would multiply the cast rows that query's
   LIMIT 5 depends on.

   Demonym rather than country name — "French film" not "France film".
   P1549 carries several forms; pickDemonym chooses the adjective. */
/* Wikidata lists several demonym forms and we want the adjective:
   "Danish film", not "Dane film" or "Danes film". Prefer the longest form
   that isn't a plural — that gives Danish over Dane, American over
   Americans, British over Briton — falling back to whatever exists for
   countries with only a plural-looking form (Swiss). */
export const kindQuery = film => `
SELECT (SAMPLE(?tyl) AS ?type) (GROUP_CONCAT(DISTINCT ?dem; separator="|") AS ?demonyms) WHERE {
  OPTIONAL { wd:${film} wdt:P31 ?ty . ?ty rdfs:label ?tyl . FILTER(LANG(?tyl) = "en") }
  OPTIONAL {
    { SELECT (MIN(?cc) AS ?c) WHERE { wd:${film} wdt:P495 ?cc } }
    ?c wdt:P1549 ?dem . FILTER(LANG(?dem) = "en")
  }
}`;

/* Two names, skipping whoever closed it — they're already named in the
   second post, and repeating them says nothing. `fame` is the film's own
   sitelink count, used to decide which pictures make the cut when someone
   closes more than a post can list. */
export async function detailsFor(film, closerId) {
  try {
    const [rows, kind] = await Promise.all([
      sparql(detailsQuery(film)),
      sparql(kindQuery(film)).then(r => r[0] || {}).catch(() => ({})),
    ]);
    return {
      type: kind.type || null,
      country: pickDemonym(kind.demonyms),
      stars: rows
        .filter(r => qid(r.p) !== closerId && !unnamed(r.pLabel))
        .slice(0, 2)
        .map(r => r.pLabel),
      fame: Number(rows[0]?.fame ?? 0),
      tmdbId: rows[0]?.tmdb ?? null,
    };
  } catch {
    return { stars: [], fame: 0, tmdbId: null, type: null, country: null };
  }
}

/* What would close if this person died today.

   Identical to wrappedFilmsQuery except it ignores this one person when
   checking for survivors. That's the trick that lets the watcher work
   ahead of Wikidata: everyone ELSE being dead is already on record, so
   the only unknown is the death we've just heard about. ~0.3s. */
export const wouldWrapQuery = id => `
SELECT ?film ?filmLabel (SAMPLE(?y) AS ?year)
       (COUNT(DISTINCT ?cm) AS ?castCount) WHERE {
  VALUES ?mine { ${VALUES} }
  ?film ?mine wd:${id} .
  FILTER NOT EXISTS {
    ?film ?a2 ?alive .
    FILTER(?a2 IN (${IN_LIST}))
    FILTER(?alive != wd:${id})
    FILTER NOT EXISTS { ?alive wdt:P570 ?dd }
  }
  OPTIONAL { ?film wdt:P161 ?cm }
  OPTIONAL { ?film wdt:P577 ?rd . BIND(YEAR(?rd) AS ?y) }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr,de,it,es,pt,nl,sv,da,no,fi,is,pl,cs,sk,hu,ro,bg,sr,hr,sl,uk,ru,el,tr,he,ar,fa,hi,bn,ta,te,ml,kn,mr,ur,th,vi,id,ms,ja,ko,zh,ca,eu,gl,et,lv,lt,ga,cy,sq,mk,ka,hy,az,kk,uz,af,sw,yi,la". }
} GROUP BY ?film ?filmLabel`;

/* Resolve a name to a Wikidata person, constrained to film occupations so
   a stray capitalised phrase doesn't match a town or a racehorse. */

export async function resolvePerson(name) {
  const filter = OCCUPATIONS.map(q => 'P106=' + q).join('|');
  const url = 'https://www.wikidata.org/w/api.php?' + new URLSearchParams({
    action: 'query', list: 'search', format: 'json',
    srsearch: `haswbstatement:${filter} ${name}`, srlimit: '1',
  });
  try {
    const res = await fetch(url, { headers: { 'User-Agent': AGENT } });
    if (!res.ok) return null;
    const hit = (await res.json()).query?.search?.[0];
    return hit ? hit.title : null;
  } catch {
    return null;
  }
}

/* Wikidata alone is not enough to declare a picture closed.

   Its cast lists are often a fraction of the real cast, and the people it
   omits are usually people it KNOWS — just not attached to that film. So
   ask TMDB who else was credited, resolve them by P4985, and look for a
   survivor. On a 45-day sweep this caught 14 of 60 candidates, including
   The Great Caruso, where George Chakiris is alive and 92.

   Returns the survivors it found; empty means genuinely closed. Needs
   TMDB_KEY — without it this returns [] and you are back to trusting
   Wikidata's cast list, which the Vault re-check proved wrong 278 times. */
/* TMDB person records, cached for the life of the process. The same bit
   player turns up across dozens of pictures in a single backfill year and
   there is no reason to ask twice. */
const personCache = new Map();

/* The age past which we stop claiming to know. Not "nobody has lived this
   long" — Jeanne Calment reached 122, and the comment that used to sit
   here saying otherwise was simply wrong. It is the age past which a birth
   date and no death record stops being evidence of anything in either
   direction, and the answer becomes 'unknown'.

   It is still a chosen number, which is the honest thing to say about it.
   The reason it is defensible is that it decides between 'alive' and
   'unknown' — never 'dead' — so being wrong here costs a picture its
   closing, not a false claim about a real person. */
const OLDEST = 112;

async function tmdbPerson(id) {
  if (personCache.has(id)) return personCache.get(id);
  let out = null;
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/person/${encodeURIComponent(id)}` +
      `?api_key=${encodeURIComponent(process.env.TMDB_KEY)}`);
    if (res.ok) {
      const p = await res.json();
      out = { name: p.name || null, born: p.birthday || null, died: p.deathday || null };
    }
  } catch { /* leave it null — the caller counts it as unknown */ }
  personCache.set(id, out);
  return out;
}

/* Is this date a real date, or a year with a placeholder stapled to it?

   Wikidata answers this properly: every time value carries a precision,
   and 11 means "to the day" while 9 means "only the year is known" — in
   which case it still serialises as 1 January, because it has to
   serialise as something. We ask for the precision rather than guessing
   from the string.

   TMDB publishes no precision at all, so there the 1 January ending is
   the only signal available and it is a proxy, not a fact. That is the
   limit of what the source supports, and it is why an uncorroborated
   TMDB birthday on 1 January is treated as a year rather than a date. */
const WD_PRECISION_DAY = 11;
const toTheDay = date => !/-01-01$/.test(String(date));

/* Dead, alive, or unknown — and the three are not interchangeable.

   'dead'    — a death date, from either database. Only a recorded death
               makes anyone dead. Nothing is inferred into this bucket.
   'alive'   — a birth date we can actually credit, and no death anywhere.
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
function statusOf(person) {
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
   good key, but it is the key we have, and it is far better than deciding
   from TMDB's silence alone.

   Guarded on the birth year matching exactly, which is why only people
   with a birth date are asked about. An exact name match is common enough
   to be dangerous on its own — there are several of most names — but a
   name and a birth year together is a different claim. If more than one
   person clears the guard we have found ambiguity, not an answer, and the
   caller keeps whatever it already believed.

   The guard used to allow two years either side, on the reasoning that
   sources disagree about birth years. They do — but "within two" is a
   number chosen to feel safe rather than derived from anything, and its
   effect is to widen a name match into a neighbourhood. A disagreement in
   the year now simply means no match, which leaves the person exactly as
   they were: still standing, still vetoing the picture. That is the
   direction to fail in.

   Takes { id, name, wd, tmdb } and returns the set of TMDB ids Wikidata
   buries. Any failure returns an empty set: this pass can only move
   someone out of 'alive', so losing it costs a closing, never a claim. */
const NAME_BATCH = 60;

async function deathsByName(people) {
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

/* The year either database gives, preferring Wikidata where both do. */
const bornYear = person =>
  Number(String(person?.wd?.born || person?.tmdb?.born || '').slice(0, 4)) || 0;

/* Wikidata hands back "1944-01-02T00:00:00Z"; TMDB hands back "1944-01-02".
   Everything downstream wants the second shape. */
const day = iso => (iso ? String(iso).slice(0, 10) : null);

async function mapLimit(items, limit, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...await Promise.all(items.slice(i, i + limit).map(fn)));
  }
  return out;
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

   Returns { alive, unknown }. A non-empty `alive` means DO NOT file.
   A non-zero `unknown` is not a veto — for a 1935 picture almost every
   unknown really is dead — but it is the honest measure of how much of
   the claim rests on nothing, and it belongs on the page. */
export async function survivorsViaTmdb(film, tmdbId) {
  if (!process.env.TMDB_KEY || !tmdbId) return { alive: [], unknown: 0 };
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${encodeURIComponent(tmdbId)}` +
      `/credits?api_key=${encodeURIComponent(process.env.TMDB_KEY)}`);
    if (!res.ok) return { alive: [], unknown: 0 };
    const { cast, crew } = await res.json();
    const everyone = [...(Array.isArray(cast) ? cast : []),
                      ...(Array.isArray(crew) ? crew : [])];
    if (!everyone.length) return { alive: [], unknown: 0 };

    const ids = [...new Set(everyone.map(c => String(c.id)))];

    const known = await sparql(`
      SELECT ?tmdb WHERE {
        VALUES ?prop { ${VALUES} }
        wd:${film} ?prop ?p . ?p wdt:P4985 ?tmdb .
      }`);
    const have = new Set(known.map(r => r.tmdb));
    const missing = ids.filter(id => !have.has(id));
    if (!missing.length) return { alive: [], unknown: 0 };

    /* Pass one — Wikidata by TMDB id, in a single query.

       Birth date as well as death date. An item with no P570 is not a
       person who is alive, it is a person nobody has buried in public, and
       reading the one as the other is this project's oldest mistake with
       the two databases swapped. Helen Hunt — hairdresser on Cover Girl,
       1944 — has a Wikidata item carrying no dates at all, and used to
       veto the picture on the strength of it.

       LANGS, not "en": the label service hands back the bare Q-number when
       a person has no label in the language asked for, and this list is
       largely people who don't. A survivor reported as "Q134235006" in the
       review queue is a name nobody can check.

       The birth date comes through the full statement path rather than
       `wdt:`, because that is the only way to reach its precision. A
       truncated value serialises as 1 January whether the editor knew the
       day or only the year, and those two are different evidence. */
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
       forty-two years after the picture vetoed it, and a re-check that had
       held twice reopened The Priest's Secret on the third run.

       Two items claiming one identifier is ambiguity, not evidence — the
       same rule the name matching already applies. We keep neither and let
       TMDB answer instead, which for an unresolved person means 'unknown'
       and no veto. */
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
       That is a wider net than "everyone Wikidata has never heard of",
       which is what this used to ask for, and the difference is where the
       errors were living: Robert Amon has a Wikidata item with no dates
       and a TMDB record saying he died in November 1992. Wikidata had
       claimed him, so TMDB was never asked, so he was a survivor. */
    const unburied = missing.filter(id => wikidata.get(id)?.died == null);
    const tmdb = new Map(
      await mapLimit(unburied, 8, async id => [id, await tmdbPerson(id)]));

    /* Both records, kept apart rather than merged. Whether two sources
       independently give the same birth year is itself evidence, and
       flattening them into one field throws that away — which is what a
       tuned age threshold was standing in for before. */
    const people = missing.map(id => ({
      id,
      name: wikidata.get(id)?.name || names.get(id) || id,
      wd: wikidata.get(id) || null,
      tmdb: tmdb.get(id) || null,
    }));

    /* Pass three — Wikidata again, by name, for anyone still standing.
       Only those with a birth date: it is the guard against name
       collisions, and without it this would be guessing rather than
       matching. */
    const buried = await deathsByName(
      people.filter(p => bornYear(p) && statusOf(p) !== 'dead'));

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

/* Candidate finder for backfill. Cast-only and therefore over-inclusive —
   every hit is re-tested with the full crew query above before it counts.
   Cast-only is the point: the crew-inclusive version of this times out. */
/* Both counts must be DISTINCT over PEOPLE. They weren't: cast was
   COUNT(DISTINCT ?c) but dead was SUM over rows, and rows multiply — a
   film with two P577 release dates matches every cast member twice, so
   ?dead came back double while ?cast stayed right. The caller's gate is
   cast === dead, so those films failed it and were never offered.

   It dropped about half of every year. The Wizard of Oz reported "20
   cast, 21 dead" and was skipped, which is why the most famous closed
   picture in the archive was never in it. */
export const candidatesByYearQuery = year => `
SELECT ?film (COUNT(DISTINCT ?c) AS ?cast) (COUNT(DISTINCT ?cd) AS ?dead) WHERE {
  ?film wdt:P31 wd:Q11424 ; wdt:P577 ?rd ; wdt:P161 ?c .
  FILTER(YEAR(?rd) = ${year})
  OPTIONAL { ?c wdt:P570 ?dod . BIND(?c AS ?cd) }
} GROUP BY ?film`;


/* --- files ------------------------------------------------------------- */

/* state.json  — films already seen, so nothing is offered twice
   queue.json  — awaiting your approval
   archive.json— approved and posted; this is what the website reads      */

/* archive.json has to end up where the website can fetch it. Set
   PW_ARCHIVE to write straight into the site root and skip the copy:

     export PW_ARCHIVE=/path/to/site/archive.json                       */
export const paths = {
  state:   join(HERE, 'state.json'),
  queue:   join(HERE, 'queue.json'),
  archive: process.env.PW_ARCHIVE || join(HERE, 'archive.json'),
};

export async function load(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

export async function save(path, data) {
  await writeFile(path, JSON.stringify(data, null, 2) + '\n');
}


/* --- formatting -------------------------------------------------------- */



/* --- who this person was ---------------------------------------------- */

/* "Barbara Adolph died 19 June 2026" tells a reader nothing. Wikidata
   knows she was German and 95 — the difference between a name and a
   person, and most people this account posts about will be strangers. */
export const personContextQuery = person => `
SELECT ?dob (GROUP_CONCAT(DISTINCT ?dem; separator="|") AS ?dems) WHERE {
  OPTIONAL { wd:${person} wdt:P569 ?dob }
  OPTIONAL {
    { SELECT (MIN(?cc) AS ?c) WHERE { wd:${person} wdt:P27 ?cc } }
    ?c wdt:P1549 ?dem . FILTER(LANG(?dem) = "en")
  }
} GROUP BY ?dob`;

/* Which of the credit properties actually links this person to this
   picture — asked directly, one query, highest-ranking wins. */
export async function creditNoun(person, films) {
  const list = (Array.isArray(films) ? films : [films]).filter(Boolean);
  if (!list.length) return null;
  try {
    /* Across ALL their pictures in this closing, not whichever happened to
       be first in the queue — someone who directed one and acted in
       another should read as a director. */
    const rows = await sparql(`
      SELECT DISTINCT ?prop WHERE {
        VALUES ?prop { ${CREDIT_NOUNS.map(([p]) => p).join(' ')} }
        VALUES ?film { ${list.map(f => `wd:${f}`).join(' ')} }
        ?film ?prop wd:${person} .
      }`);
    const held = new Set(rows.map(r => r.prop.replace(
      'http://www.wikidata.org/prop/direct/', 'wdt:')));
    return CREDIT_NOUNS.find(([p]) => held.has(p))?.[1] || null;
  } catch {
    return null;
  }
}



export async function personContext(person, diedISO, films) {
  try {
    const [row] = await sparql(personContextQuery(person));
    if (!row) return {};

    const occupation = await creditNoun(person, films);

    let age = null;
    if (row.dob && diedISO) {
      const born = new Date(row.dob), died = new Date(diedISO);
      if (!isNaN(born) && !isNaN(died)) {
        age = died.getUTCFullYear() - born.getUTCFullYear();
        const before = died.getUTCMonth() < born.getUTCMonth() ||
          (died.getUTCMonth() === born.getUTCMonth() && died.getUTCDate() < born.getUTCDate());
        if (before) age -= 1;
      }
    }

    /* pickDemonym needs ALL the forms to choose between — grouping by the
       demonym instead produced one row per form and took whichever came
       first, which is how Louise Lasser became "Americans". */
    return { nationality: pickDemonym(row.dems), occupation, age };
  } catch {
    return {};
  }
}

export const portraitQuery = person => `
SELECT ?img WHERE { wd:${person} wdt:P18 ?img } LIMIT 1`;

export async function portraitFor(person) {
  try {
    const rows = await sparql(portraitQuery(person));
    const img = rows[0]?.img;
    return img ? img.replace(/^http:/, 'https:') + '?width=800' : null;
  } catch {
    return null;
  }
}

export async function posterFor(tmdbId) {
  if (!process.env.TMDB_KEY || !tmdbId) return null;
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${encodeURIComponent(tmdbId)}` +
      `?api_key=${encodeURIComponent(process.env.TMDB_KEY)}`);
    if (!res.ok) return null;
    const { poster_path } = await res.json();
    return poster_path ? `https://image.tmdb.org/t/p/w500${poster_path}` : null;
  } catch {
    return null;
  }
}

/* Returns [imagesForPost1, imagesForPost2] — the face, then the posters.
   Bluesky allows four images per post. */
export async function imagesFor(group) {
  const { last, items } = group;

  const face = await portraitFor(last.id);
  const first = face ? [{ url: face, alt: last.name }] : [];

  /* A picture with a poster outranks one without, then fame decides.
     The list and the images must correspond — naming three films while
     showing posters for different ones reads as a mistake — and the two
     orderings barely conflict anyway: of 46 queued films, the only five
     without posters were the five most obscure. */
  const ordered = [...items].sort((a, b) =>
    (b.poster ? 1 : 0) - (a.poster ? 1 : 0) || (b.fame ?? 0) - (a.fame ?? 0));
  const second = [];
  for (const film of ordered.slice(0, 4)) {
    const poster = await posterFor(film.tmdbId);
    if (poster) {
      second.push({
        url: poster,
        alt: `Poster for ${film.title}${film.year ? ` (${film.year})` : ''}`,
      });
    }
    await sleep(120);
  }

  return [first, second];
}



/* --- post composition -------------------------------------------------- */

/* Where the film pages live. Used in every post link. */
const SITE = process.env.PW_SITE || 'https://picture-wrap.com';
/* Always two posts: the person, then the pictures.

   The person is the story — the feed is only ever fresh deaths — and a
   single picture is still a world that has closed, so it gets the same
   shape as seventeen. One post for who, one for what.

   On tone: "all 24 people credited have now died" is a coroner's
   sentence. What has actually happened is that the last living link to a
   picture is gone — nobody left who was there. The copy says that.

   No pronouns anywhere; we know these people only as database rows. */

const WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
               'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen',
               'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen',
               'Nineteen', 'Twenty'];

const and = names => (names.length === 2
  ? `${names[0]} and ${names[1]}`
  : names.join(', '));

/* howManyStars: 2, 1 or 0. Varying this rather than the number of
   pictures is what lets a list keep both — five titles is the agreed
   shape, and a name beside each is what makes them placeable. */
const named = (i, howManyStars = 0) => {
  const title = i.year ? `${i.title} (${i.year})` : i.title;
  const stars = (i.stars || []).slice(0, howManyStars);
  return stars.length ? `${title}, with ${and(stars)}` : title;
};

export function groupQueue(queue) {
  const groups = new Map();
  for (const item of queue) {
    const key = `${item.last.id}|${(item.last.died || '').slice(0, 10)}`;
    if (!groups.has(key)) groups.set(key, { last: item.last, items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()];
}

export function compose(group) {
  const { last, items } = group;
  const when = longDate(last.died);
  const url = `${SITE}/${path(last.name, last.id)}`;
  /* The visible text is the real address, minus the scheme. A label like
     "picture-wrap.com" is prettier but strands anyone reading the post as
     plain text — copied, screenshotted, syndicated — on the homepage with
     no way to reach the page it meant. The address has to be the thing on
     screen. */
  const bare = u => u.replace(/^https?:\/\//, '');
  const link = `[[${bare(url)}|${url}]]`;

  /* Name alone is a stranger. Nationality, trade and age are what make a
     reader able to place someone they've never heard of — which is most
     of the people this account will ever post about. */
  const c = last.context || {};
  const desc = [c.nationality, c.occupation].filter(Boolean).join(' ');
  const who = last.character
    ? `${last.name}, who played ${last.character}`
    : desc ? `${last.name}, ${/^[aeiou]/i.test(desc) ? 'an' : 'a'} ${desc}`
           : last.name;
  const aged = c.age ? ` aged ${c.age}` : '';

  /* --- one: the person --- */
  const lead = items.length === 1
    ? `${who}, died ${when}${aged}.\n\n` +
      `The last of the makers of ${named(items[0])}.\n\n${link}`
    : `${who}, died ${when}${aged}.\n\n` +
      `${WORDS[items.length] || items.length} pictures have lost the last ` +
      `of their makers.\n\n${link}`;

  /* --- two: the pictures --- */
  /* A picture with a poster outranks one without, then fame decides.
     The list and the images must correspond — naming three films while
     showing posters for different ones reads as a mistake — and the two
     orderings barely conflict anyway: of 46 queued films, the only five
     without posters were the five most obscure. */
  const ordered = [...items].sort((a, b) =>
    (b.poster ? 1 : 0) - (a.poster ? 1 : 0) || (b.fame ?? 0) - (a.fame ?? 0));

  const build = (howManyStars, count = MAX_LISTED) => {
    if (items.length === 1) {
      const film = items[0];
      const stars = (film.stars || []).slice(0, howManyStars || 2);
      const line = stars.length ? `\n\nWith ${and(stars)}.` : '';
      const fu = `${SITE}/${path(film.title, film.id)}`;
      return `${named(film)}${line}\n\n[[${bare(fu)}|${fu}]]`;
    }
    const listed = ordered.slice(0, count);
    const rest = ordered.length - listed.length;
    /* The "more" link goes to the PERSON, not the site root — it's the
       page that actually holds the rest of their pictures. */
    /* "+12 more" rather than "and 12 more at" — Ann Blyth's list came to
       301 of 300 characters with one star name each, and lost all five
       names over a single character. */
    const more = rest
      ? `\n\n+${rest} more\n[[${bare(url)}|${url}]]`
      : '';
    return listed.map(i => `\u00b7 ${named(i, howManyStars)}`).join('\n') + more;
  };

  /* Aim for two names per picture and list as many as fit — five when the
     titles are short, three when they run long. Naming who was in a film
     is what makes it placeable, and a post crammed to 300 characters
     reads worse than a shorter one that says more about each entry.
     Only if even three won't carry two names do we start thinning them. */
  const attempts = [
    [2, 5], [2, 4], [2, 3],
    [1, 5], [1, 4],
    [0, 5],
  ];
  for (const [stars, count] of attempts) {
    const text = build(stars, count);
    if (measure(text) <= LIMIT) return [lead, text];
  }
  return [lead, build(0, 3)];
}
