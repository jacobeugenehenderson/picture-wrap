/* ==========================================================================
   PICTURE WRAP — poster/lib.js

   Shared queries and file handling. Nothing here posts anything; run.js
   finds candidates, review.js is the only path to Bluesky.
   ========================================================================== */

import { readFile, writeFile } from 'node:fs/promises';

import { measure, LIMIT } from './bluesky.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));

const WDQS = 'https://query.wikidata.org/sparql';

/* Wikidata asks for a descriptive agent on automated queries. Put a real
   contact in here — it's how they reach you instead of blocking you. */
const AGENT = 'PictureWrap/1.0 (https://picture-wrap.com; jacob@jacobhenderson.studio)';

/* Same credit set as the website. Keep the two in step. */
export const CREDITS = [
  'wdt:P161',   // cast
  'wdt:P725',   // voice actor — animation's cast lives here
  'wdt:P57',    // director
  'wdt:P58',    // screenwriter
  'wdt:P344',   // cinematographer
  'wdt:P86',    // composer
  'wdt:P162',   // producer
  'wdt:P1040',  // editor
  'wdt:P2554',  // production designer
  'wdt:P4805',  // costume designer
];

const IN_LIST = CREDITS.join(', ');
const VALUES  = CREDITS.join(' ');

/* A COST control for the backfill, and nothing else.

   It was once a correctness guard: the post said "X has wrapped", a bare
   claim that needed a rule deciding when it was safe. That rule is gone.
   The post states its own basis now — "all 51 people credited on Casablanca
   have now died" — which is true whatever Wikidata is missing, and a thin
   record announces its own thinness: "the 1 person credited on The Stone
   Boy has now died" tells a reader exactly what they are looking at.

   What remains is arithmetic. The backfill runs an expensive per-film test
   on every candidate, and testing films with one or two names on record
   costs hours to learn nothing. This trims that. The daily sweep does NOT
   use it — a handful of extra stubs a year is not worth a rule, and
   review.js shows TMDB coverage so you can see what you're looking at. */
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

export const qid = uri => uri.split('/').pop();

/* Wikidata's label service hands back the Q-number when an item has no
   English label. A film we can't name isn't one we can announce — the
   post would read "Q3285451 has wrapped." Skip it and say so. */
export const unnamed = label => !label || /^Q\d+$/.test(label);


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
export function pickDemonym(forms) {
  const all = String(forms || '').split('|').map(s => s.trim()).filter(Boolean);
  if (!all.length) return null;
  const singular = all.filter(f => !f.endsWith('s'));
  const pool = singular.length ? singular : all;
  /* Prefer an adjective ending. Length alone isn't enough — "Spaniard" is
     longer than "Spanish", and "Briton" competes with "British". */
  const adjective = pool.filter(f => /(ish|ian|ean|ese|an|ch|sh|ic)$/i.test(f));
  return (adjective.length ? adjective : pool)
    .reduce((a, b) => (b.length > a.length ? b : a));
}

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
export const OCCUPATIONS = [
  'Q33999', 'Q10800557', 'Q10798782', 'Q2259451', 'Q2405480', 'Q948329',
  'Q2526255', 'Q3455803', 'Q28389', 'Q222344', 'Q3282637', 'Q36834', 'Q7042855',
];

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

/* Candidate finder for backfill. Cast-only and therefore over-inclusive —
   every hit is re-tested with the full crew query above before it counts.
   Cast-only is the point: the crew-inclusive version of this times out. */
export const candidatesByYearQuery = year => `
SELECT ?film (COUNT(DISTINCT ?c) AS ?cast) (SUM(IF(BOUND(?dod),1,0)) AS ?dead) WHERE {
  ?film wdt:P31 wd:Q11424 ; wdt:P577 ?rd ; wdt:P161 ?c .
  FILTER(YEAR(?rd) = ${year})
  OPTIONAL { ?c wdt:P570 ?dod }
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

export const year = iso => (iso ? iso.slice(0, 4) : '');

export function longDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return year(iso);
  return d.toLocaleDateString('en-GB',
    { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}


/* --- post composition -------------------------------------------------- */

/* Where the film pages live. Used in the post link. */
const SITE = process.env.PW_SITE || 'https://picture-wrap.com';

/* A prolific career takes several pictures over the line at once — Mary
   Carlisle's death closed four, Margaret Booth's three. Posting those
   separately would be a burst of near-identical skeets that buries the
   actual story, which is the person rather than the films.

   So the queue is reviewed and posted by person-and-date, not by film. */
export function groupQueue(queue) {
  const groups = new Map();
  for (const item of queue) {
    const key = `${item.last.id}|${(item.last.died || '').slice(0, 10)}`;
    if (!groups.has(key)) groups.set(key, { last: item.last, items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()];
}

const WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
               'Eight', 'Nine', 'Ten'];

const and = names => (names.length === 2
  ? `${names[0]} and ${names[1]}`
  : names.join(', '));

const named = (i, withStars) => {
  const title = i.year ? `${i.title} (${i.year})` : i.title;
  return withStars && i.stars?.length ? `${title}, with ${and(i.stars)}` : title;
};

/* The person first, then the pictures.

   The feed is now only ever fresh deaths — backfill is filed straight to
   the vault — so the news is the person. "X died today, and these pictures
   wrapped with them" is the sentence; leading with a film list buries it.

   One picture needs only one post. Several need two: the death, then the
   list, because four titles with their stars ran to 292 of 300 characters
   crammed into a single post.

   Deliberately plain throughout: the facts are doing the work, and
   anything added reads as the project being pleased with itself.
   No pronouns anywhere — we know these people only as database rows. */
export function compose(group) {
  const { last, items } = group;
  const when = longDate(last.died);

  const who = last.character
    ? `${last.name}, who played ${last.character},`
    : `${last.name}`;
  const died = `${who} died ${when}.`;

  /* --- one picture: one post --- */
  if (items.length === 1) {
    const film = items[0];
    const link = `${SITE}/#/film/${film.id}`;
    const n = Number(film.castCount) || 0;
    const credited = n === 1
      ? `The 1 person credited on ${named(film, false)} has now died.`
      : `All ${n} people credited on ${named(film, false)} have now died.`;

    const withStars = film.stars?.length
      ? `${died}\n\n${credited}\n\nWith ${and(film.stars)}.\n\n${link}`
      : null;

    return [withStars && measure(withStars) <= LIMIT
      ? withStars
      : `${died}\n\n${credited}\n\n${link}`];
  }

  /* --- several: the death, then the list --- */
  const count = WORDS[items.length] || String(items.length);
  const link = `${SITE}/#/person/${last.id}`;

  const lead =
    `${died}\n\n${count} pictures now have no surviving credited ` +
    `name on record:\n\n${link}`;

  /* Ordered by the film's own sitelink count, so when someone closes
     fourteen pictures the five a reader would recognise are the five that
     show — not whichever five the query happened to return first. */
  const ordered = [...items].sort((a, b) => (b.fame ?? 0) - (a.fame ?? 0));
  const listed = ordered.slice(0, MAX_LISTED);
  const rest = ordered.length - listed.length;

  const build = withStars => {
    const lines = listed.map(i => `\u00b7 ${named(i, withStars)}`);
    if (rest) lines.push(`\u00b7 and ${rest} more`);
    return lines.join('\n');
  };

  /* Stars are the first thing dropped if long titles overrun the budget. */
  const starred = build(true);
  return [lead, measure(starred) <= LIMIT ? starred : build(false)];
}
