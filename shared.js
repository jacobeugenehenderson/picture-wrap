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

/* What the archive is allowed to consider a picture, as Wikidata's own
   P31 values.

   KINDS above answers a different question — what search should offer —
   and using it, or Q11424 alone, to enumerate a year is how the corpus
   went wrong. The backfill has only ever asked for Q11424, and Wikidata
   does not file the silent era under it:

       1912   short film   2,326        1924   film          1,057
              film           597               short film      102
              silent film     30               silent film      19
              animated short   5               animated short   20

   Four fifths of 1912 was invisible. Not a judgement about one-reelers —
   the pipeline never saw them, so nothing about them was ever judged.

   Only moving pictures. Wikidata files albums, sheet music, pamphlets and
   video games against these same credit properties — a composer credit is
   a credit — and none of them have a cast to outlive. Television series
   episodes are excluded too: this project's unit is the work, and 1,911
   episodes in 2015 alone would make it something else. */
export const WORK_CLASSES = [
  'Q11424',      // film
  'Q24862',      // short film
  'Q226730',     // silent film
  'Q202866',     // animated film
  'Q17517379',   // animated short film
  'Q20650540',   // anime film
  'Q7751682',    // serial film
  'Q506240',     // television film
  'Q7697093',    // television play
  'Q1259759',    // miniseries
  'Q5398426',    // television series
  'Q117467246',  // animated television series
];

/* The same classes as English labels, in the same order, which is
   general to specific. Both facts matter.

   Wikidata gives one picture several of these at once — 1,166 are both
   "film" and "short film", 731 are both "film" and "television film" —
   and the pass's query grouped by the label, so each one became a
   separate row judged separately. Same verdict every time, because the
   credits are the same; different type, and one picture in the Vault
   twice. 1,302 closings were doubled that way.

   Collapsing them needs a rule for which label survives, and the order
   of this list IS the rule: later wins. "Animated short film" beats
   "film" because it says more, and nothing has to guess. A string-length
   heuristic would get the same answer for most of these and would be a
   coincidence rather than a reason.

   Kept beside WORK_CLASSES and asserted to line up, because the whole
   value of this list is that its order matches. */
export const WORK_CLASS_LABELS = [
  'film',
  'short film',
  'silent film',
  'animated film',
  'animated short film',
  'anime film',
  'serial film',
  'television film',
  'television play',
  'miniseries',
  'television series',
  'animated television series',
];

/* Which of several type labels to keep. Unknown labels are more specific
   than anything we named — they came from Wikidata and we have no basis
   to rank them — so they win over a known one, and ties fall to the
   first seen so the answer never depends on iteration order. */
export function mostSpecificType(labels) {
  const rank = label => {
    const i = WORK_CLASS_LABELS.indexOf(label);
    return i === -1 ? WORK_CLASS_LABELS.length : i;
  };
  let best = null;
  for (const label of labels) {
    if (!label) continue;
    if (best === null || rank(label) > rank(best)) best = label;
  }
  return best;
}

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
   "Danish film", not "Dane film" or "Danes film". Prefer the longest form
   that isn't a plural — that gives Danish over Dane, American over
   Americans, British over Briton — falling back to whatever exists for
   countries with only a plural-looking form (Swiss).

   PREFERRED overrides that, because longest-adjective is a rule of thumb
   and rules of thumb have a tail. Two kinds of entry, and the difference
   is worth keeping straight:

   Argentina is the one that is wrong today. Wikidata offers "Argentine"
   and "Argentinian"; the heuristic takes the longer, and 83 Vault entries
   read "Argentinian film" where a film writer would put "Argentine".

   The rest are right at the moment and would break if Wikidata gained a
   longer form. Each of these countries currently publishes exactly one
   English demonym, none of which matches the adjective pattern — Swiss,
   Thai, Dutch, Slovak, Czechoslovak all fail it and survive only because
   the code falls through to "whatever is in the pool". Add "Swissish" or
   "Czechoslovakian" upstream and the heuristic would take it. Naming them
   here costs nothing and removes the trapdoor.

   Checked against Wikidata on 28 July 2026. Anything added later should
   be checked the same way rather than assumed. */
const PREFERRED = new Set([
  'Argentine',      /* not Argentinian — the only one currently wrong */
  'Yugoslav',       /* the rest are protective, not corrective */
  'Czechoslovak',
  'Slovak',
  'Swiss',
  'Thai',
  'Dutch',
]);

export function pickDemonym(forms) {
  const all = String(forms || '').split('|').map(s => s.trim()).filter(Boolean);
  if (!all.length) return null;

  const preferred = all.find(f => PREFERRED.has(f));
  if (preferred) return preferred;

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

/* The hash path for an entity. Omits the slug when there isn't one —
   27 Vault titles are in Arabic, Cyrillic or Tamil and slug to nothing,
   which would otherwise produce "#//Q12292564". */
export function path(name, id) {
  const s = slug(name);
  return s ? `#/${s}/${id}` : `#/${id}`;
}

/* Does a label contain no Latin letters at all? Used to spot names the
   language fallback rendered in another script — Robert Preston, an
   American actor, arrived as "Роберт Престон" because Q451811 has no
   English label and no English alias, so "ru" was the first list entry
   that matched. Wikidata is missing the data; the fallback did its job.

   Deliberately narrow. A French or Swedish label is left alone: it's
   readable, and it may be the only name the person ever had. This is
   only about scripts an English reader cannot even sound out. */
export const nonLatin = s => !!s && !/[A-Za-z]/.test(s);

/* An English Wikipedia URL, turned back into a name. The article title is
   the English name when the label is missing, and its disambiguator is
   noise here — "Robert_Preston_(actor)" is on a page that already says he
   was an actor. */
export function nameFromArticle(url) {
  if (!url) return '';
  try {
    const title = decodeURIComponent(String(url).split('/wiki/').pop() || '');
    return title.replace(/_/g, ' ').replace(/\s*\([^)]*\)\s*$/, '').trim();
  } catch {
    return '';
  }
}

/* Sentence case, for Wikidata's lowercase type labels. */
export const sentence = s => (s ? s[0].toUpperCase() + s.slice(1) : '');
