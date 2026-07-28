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

const OLDEST = 112;   /* no verified human has passed this */

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

/* Was this person, as far as TMDB is concerned, alive?

   'dead'    — TMDB has a death date, or a birth date so old that no living
               person could match it (a missing death date, not a survivor).
   'alive'   — a birth date within a human lifespan and no death date.
   'unknown' — TMDB has neither date, or the lookup failed. NOT an answer.
               This is the honest bucket and it must never be read as 'dead'. */
function statusOf(person) {
  if (!person) return 'unknown';
  if (person.died) return 'dead';
  if (!person.born) return 'unknown';
  const born = Number(String(person.born).slice(0, 4));
  if (!born) return 'unknown';
  return (new Date().getUTCFullYear() - born) > OLDEST ? 'dead' : 'alive';
}

async function mapLimit(items, limit, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...await Promise.all(items.slice(i, i + limit).map(fn)));
  }
  return out;
}

/* Everyone TMDB credits who might still be alive, and a count of the ones
   nobody can answer for.

   Two passes, because the two databases are good at different things.
   Wikidata resolves the people it knows, with real death dates. TMDB
   answers for the rest — and it CAN answer, which is the part this got
   wrong for a long time: it asked TMDB who was in a film and then asked
   Wikidata whether they were alive, discarding the birth and death dates
   TMDB was already holding. Anyone Wikidata couldn't match was silently
   counted as dead. That is how a picture with a living bit player in it
   ends up in the Vault.

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

    /* Pass one — Wikidata, in a single query. */
    const rows = await sparql(`
      SELECT ?tmdb ?pLabel ?dod WHERE {
        VALUES ?tmdb { ${missing.map(i => `"${i}"`).join(' ')} }
        ?p wdt:P4985 ?tmdb .
        OPTIONAL { ?p wdt:P570 ?dod }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }`).catch(() => []);

    const alive = [];
    const resolved = new Set();
    for (const r of rows) {
      if (resolved.has(r.tmdb)) continue;
      resolved.add(r.tmdb);
      if (!r.dod) alive.push(r.pLabel || r.tmdb);
    }

    /* Pass two — TMDB itself, for everyone Wikidata could not place.
       This used to be where people quietly became dead. */
    const orphans = missing.filter(id => !resolved.has(id));
    let unknown = 0;
    const names = new Map(everyone.map(c => [String(c.id), c.name]));

    await mapLimit(orphans, 8, async id => {
      const status = statusOf(await tmdbPerson(id));
      if (status === 'alive') alive.push(names.get(id) || id);
      else if (status === 'unknown') unknown++;
    });

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
