/* ==========================================================================
   PICTURE WRAP — shared.js

   The single source of truth for anything the website and the poster both
   need to agree about. Imported by app.js in the browser and by
   poster/lib.js in Node, as a native ES module — no build step, no
   bundler, no package manager. Both runtimes read this same file.

   What belongs here: constants, and pure functions with no environment
   behind them. What does NOT: anything that fetches. The two halves talk
   to Wikidata differently — the poster sends a User-Agent and retries on
   429, the browser can do neither — so their transport stays separate.

   Why it exists: these definitions had already drifted. The site listed
   eight crew properties with display labels; the poster listed ten
   including cast, in a different shape. Nothing warned about it, and a
   mismatch means the site and the poster can disagree about whether a
   picture has wrapped, which is the most confusing bug this project can
   produce.
   ========================================================================== */


/* --- what counts as a credit ------------------------------------------- */

/* Every property that puts a person on a picture, with the label the site
   shows for it. Cast first — it is the roster; the rest is the crew fold.

   Below-the-line crew (grips, gaffers, sound, second unit) is not in
   Wikidata at all and never will be, so "everyone" always means everyone
   recorded. The colophon says so. */
export const CAST = [
  ['wdt:P161', 'Cast'],
  ['wdt:P725', 'Voice'],        // animation records its cast here, not P161
];

export const CREW = [
  ['wdt:P57',   'Director'],
  ['wdt:P58',   'Screenplay'],
  ['wdt:P344',  'Cinematography'],
  ['wdt:P86',   'Music'],
  ['wdt:P162',  'Producer'],
  ['wdt:P1040', 'Editor'],
  ['wdt:P2554', 'Production design'],
  ['wdt:P4805', 'Costume design'],
];

/* Everyone, in the order that decides what someone is called when they
   hold several credits on one picture: crew outranks cast, so directing a
   film you also appeared in makes you its director. */
export const CREDITS = [...CREW, ...CAST];

export const CREDIT_PROPS = CREDITS.map(([p]) => p);
export const IN_LIST = CREDIT_PROPS.join(', ');   // FILTER(?p IN (…))
export const VALUES  = CREDIT_PROPS.join(' ');    // VALUES ?prop { … }

/* Singular nouns for the same properties, used in prose. */
export const CREDIT_NOUNS = [
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


/* --- searching --------------------------------------------------------- */

/* What counts as a picture. Animated series are a SEPARATE item from
   television series, which is why BoJack Horseman was once invisible. */
export const KINDS = [
  'Q11424',      // film
  'Q5398426',    // television series
  'Q1259759',    // miniseries
  'Q117467246',  // animated television series
  'Q202866',     // animated film
];

/* Occupations worth searching. Generous on purpose: Wikidata carries a
   dozen overlapping occupation items and tagging is inconsistent between
   them. Catherine Deneuve is "film actor" but NOT "actor", so a filter
   built on Q33999 alone returned nothing for her. If someone is missing
   from search, check their P106 first. */
export const OCCUPATIONS = [
  'Q33999',     // actor
  'Q10800557',  // film actor  — commoner than Q33999 in practice
  'Q10798782',  // television actor
  'Q2259451',   // stage actor
  'Q2405480',   // voice actor
  'Q948329',    // character actor
  'Q2526255',   // film director
  'Q3455803',   // director
  'Q28389',     // screenwriter
  'Q222344',    // cinematographer
  'Q3282637',   // film producer
  'Q36834',     // composer
  'Q7042855',   // film editor
];


/* --- labels ------------------------------------------------------------ */

/* In preference order. The label service walks this list and takes the
   first hit, which is the whole point — an earlier version aggregated
   SAMPLE() tiers instead, and SAMPLE has no preference, so Meryl Streep
   (who has no English label at all) came out in Chinese. */
export const LANGS = [
  'en', 'fr', 'de', 'it', 'es', 'pt', 'nl', 'sv', 'da', 'no', 'fi', 'is',
  'pl', 'cs', 'sk', 'hu', 'ro', 'bg', 'sr', 'hr', 'sl', 'uk', 'ru', 'el',
  'tr', 'he', 'ar', 'fa', 'hi', 'bn', 'ta', 'te', 'ml', 'kn', 'mr', 'ur',
  'th', 'vi', 'id', 'ms', 'ja', 'ko', 'zh', 'ca', 'eu', 'gl', 'et', 'lv',
  'lt', 'ga', 'cy', 'sq', 'mk', 'ka', 'hy', 'az', 'kk', 'uz', 'af', 'sw',
  'yi', 'la',
].join(',');

/* Wikidata's label service returns the Q-number when an item has no label
   in any requested language. A picture we can't name isn't one we can
   announce. */
export const unnamed = label => !label || /^Q\d+$/.test(label);


/* --- pure helpers ------------------------------------------------------ */

export const qid = uri => String(uri).split('/').pop();

export const year = iso => (iso ? String(iso).slice(0, 4) : '');

/* Day first — "24 June 2026". It reads better beside an age ("died 24
   June 2026 aged 98" versus "died June 24, 2026 aged 98") and puts no
   comma inside the wrap stamp. */
export function longDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return year(iso);
  return d.toLocaleDateString('en-GB',
    { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/* Wikidata lists several demonym forms and we want the adjective:
   "Danish film", not "Dane film" or "Danes film". Prefer the longest
   non-plural form with an adjective ending — length alone isn't enough,
   since "Spaniard" is longer than "Spanish". */
export function pickDemonym(forms) {
  const all = String(forms || '').split('|').map(s => s.trim()).filter(Boolean);
  if (!all.length) return null;
  const singular = all.filter(f => !f.endsWith('s'));
  const pool = singular.length ? singular : all;
  const adjective = pool.filter(f => /(ish|ian|ean|ese|an|ch|sh|ic)$/i.test(f));
  return (adjective.length ? adjective : pool)
    .reduce((a, b) => (b.length > a.length ? b : a));
}

/* A readable tail on an otherwise opaque URL. The router reads only the
   first two hash segments, so anything after the Q-id is decoration —
   but it turns /#/person/Q807328 into something legible before a click.

   Deliberately NOT a replacement for the Q-id: 27 films in the Vault have
   titles in Arabic, Cyrillic or Tamil and slug to nothing at all. */
export function slug(name) {
  return String(name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/* Sentence case, for Wikidata's lowercase type labels. */
export const sentence = s => (s ? s[0].toUpperCase() + s.slice(1) : '');
