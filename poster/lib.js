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

/* Wikidata alone is not enough to declare a picture closed.

   Its cast lists are often a fraction of the real cast, and the people it
   omits are usually people it KNOWS — just not attached to that film. So
   ask TMDB who else was credited, resolve them by P4985, and look for a
   survivor. On a 45-day sweep this caught 14 of 60 candidates, including
   The Great Caruso, where George Chakiris is alive and 92.

   Returns the survivors it found; empty means genuinely closed. Needs
   TMDB_KEY — without it this returns [] and you are back to trusting
   Wikidata's cast list, which the Vault re-check proved wrong 278 times. */
export async function survivorsViaTmdb(film, tmdbId) {
  if (!process.env.TMDB_KEY || !tmdbId) return [];
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${encodeURIComponent(tmdbId)}` +
      `/credits?api_key=${encodeURIComponent(process.env.TMDB_KEY)}`);
    if (!res.ok) return [];
    const { cast } = await res.json();
    if (!Array.isArray(cast) || !cast.length) return [];

    const known = await sparql(`
      SELECT ?tmdb WHERE {
        VALUES ?prop { ${VALUES} }
        wd:${film} ?prop ?p . ?p wdt:P4985 ?tmdb .
      }`);
    const have = new Set(known.map(r => r.tmdb));
    const missing = cast.map(c => String(c.id)).filter(id => !have.has(id));
    if (!missing.length) return [];

    const rows = await sparql(`
      SELECT ?tmdb ?pLabel ?dod WHERE {
        VALUES ?tmdb { ${missing.map(i => `"${i}"`).join(' ')} }
        ?p wdt:P4985 ?tmdb .
        OPTIONAL { ?p wdt:P570 ?dod }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }`);

    const seen = new Set(), alive = [];
    for (const r of rows) {
      if (seen.has(r.tmdb)) continue;
      seen.add(r.tmdb);
      if (!r.dod) alive.push(r.pLabel || r.tmdb);
    }
    return alive;
  } catch {
    return [];
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


/* --- who this person was ------------------------------------------------ */

/* "Barbara Adolph died 19 June 2026" tells a reader nothing. Wikidata
   knows she was German, an actor, and 95 — the difference between a name
   and a person.

   Occupation is taken in a fixed priority order rather than alphabetically,
   because everyone has half a dozen and only one is the reason they're
   here. "actor" is used regardless of gender; guessing gendered nouns from
   P21 is a choice this project doesn't need to make. */
/* Taken from how they are credited on THIS picture, not from P106.

   P106 lists everything a person ever was, and picking from it means
   guessing what they are known for — which gets Woody Allen wrong, since
   an alphabetical or actor-first order calls a director an actor.

   Crew outranks cast: if you directed a picture and appeared in it, you
   are its director. */
const CREDIT_NOUNS = [
  ['wdt:P57',   'director'],
  ['wdt:P58',   'screenwriter'],
  ['wdt:P344',  'cinematographer'],
  ['wdt:P86',   'composer'],
  ['wdt:P162',  'producer'],
  ['wdt:P1040', 'editor'],
  ['wdt:P2554', 'production designer'],
  ['wdt:P4805', 'costume designer'],
  ['wdt:P161',  'actor'],
  ['wdt:P725',  'voice actor'],
];

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

/* A readable tail on an otherwise opaque URL. The router splits the hash
   and reads only the first two segments, so anything after the Q-id is
   decoration — but it turns /#/person/Q807328 into something a person can
   read before clicking. */
export function slug(name) {
  return String(name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}


/* --- pictures for the posts -------------------------------------------- */

/* The first post carries the person's face, the second carries the
   posters of what they closed. Words alone don't stop a thumb.

   Portraits come from Wikidata's P18, which points at Wikimedia Commons —
   mostly CC-BY, so the photographer's name goes in the alt text where
   there is room for it. Posters come from TMDB at w500, 60-120 KB each. */

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
  const url = `${SITE}/#/person/${last.id}/${slug(last.name)}`;
  /* A label, not a fake address. See linkFacets in bluesky.js. */
  const link = `[[${last.name} at picture-wrap.com|${url}]]`;

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
      const fu = `${SITE}/#/film/${film.id}/${slug(film.title)}`;
      return `${named(film)}${line}\n\n[[${named(film)} at picture-wrap.com|${fu}]]`;
    }
    const listed = ordered.slice(0, count);
    const rest = ordered.length - listed.length;
    /* The "more" link goes to the PERSON, not the site root — it's the
       page that actually holds the rest of their pictures. */
    /* "+12 more" rather than "and 12 more at" — Ann Blyth's list came to
       301 of 300 characters with one star name each, and lost all five
       names over a single character. */
    const more = rest
      ? `\n\n[[+${rest} more at picture-wrap.com|${url}]]`
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
