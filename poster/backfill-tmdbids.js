/* ==========================================================================
   PICTURE WRAP — poster/backfill-tmdbids.js

   Fills in tmdbId for Vault entries that have none.

   Two causes, both worth repairing. The posting path in review.js used to
   drop the field, so every announced picture lost it. And some films have
   no P4947 on Wikidata at all, so it was never known.

   Without tmdbId, recheck.js cannot verify an entry — it reports
   'unchecked' and the entry stays in the Vault on the strength of
   Wikidata's cast list alone, which is the test this project proved wrong
   278 times. 1,077 entries are in that position.

     node backfill-tmdbids.js --dry-run --from 1950   the 327 that matter
     node backfill-tmdbids.js --dry-run               all 1,077
     node backfill-tmdbids.js --from 1950             write it

   Wikidata first, TMDB search second, and no id is accepted on title and
   year alone — see below.
   ========================================================================== */

import { sparql, load, paths, sleep, qid, saveArchive } from './lib.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fromIx = args.indexOf('--from');
const FROM = fromIx === -1 ? 0 : Number(args[fromIx + 1]);
const limitIx = args.indexOf('--limit');
const LIMIT = limitIx === -1 ? Infinity : Number(args[limitIx + 1]);

if (!process.env.TMDB_KEY) { console.error('Set TMDB_KEY first.'); process.exit(1); }

/* --- why a year match is not enough -------------------------------------

   The first version of this file accepted any search hit whose release
   year equalled the entry's year. That is a weaker test than it looks.
   TMDB's search is fuzzy and its catalogue is dense: query a common or
   translated title with &year= and you reliably get *a* film from that
   year which is not yours. Nothing downstream would ever notice, and this
   is the worst place in the project for a silent wrong answer — recheck.js
   would then fetch that other film's cast, find its people dead or alive,
   and write a verdict about a picture it never looked at. A wrong id does
   not leave an entry unverified; it makes an entry confidently wrong.

   So a candidate must also share a person with what Wikidata already
   records for the film. Every one of the 1,077 has at least five names on
   record — median six — so there is always something to corroborate
   against, and a film with no overlapping cast at all is not the film.

     exact year   + >=1 shared name  -> accept
     year +/- 1   + >=2 shared names -> accept
     anything else                   -> leave null, and say why

   The +/-1 band exists because release-year disagreement between the two
   databases is common and legitimate (festival vs general release, and
   the pre-1930 Danish material especially). Widening the year is only
   safe because the cast requirement tightens with it.

   The bias is deliberate and matches the file's original instinct: a
   missing id costs a re-check, a wrong one costs the truth. */

const EXACT_MIN_OVERLAP = 1;
const NEAR_MIN_OVERLAP = 2;
const YEAR_SLACK = 1;

/* Names are compared with diacritics stripped and punctuation dropped, so
   "Đoko Rosić" matches "Doko Rosic" and "Vassil Kazandjiev" matches
   "Vasil Kazandzhiev" only if the transliteration agrees on the letters.
   It often will not, which is why a failure to corroborate is reported as
   "could not confirm" rather than "wrong film" — the two are different and
   the operator needs to be able to tell them apart. */
const norm = s => String(s || '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const surname = s => norm(s).split(' ').filter(Boolean).pop() || '';

/* --- the work list ------------------------------------------------------ */

const archive = await load(paths.archive, []);

/* An empty Vault here means the path is wrong, not that the Vault is
   empty. paths.archive falls back to poster/archive.json, which does not
   exist — the real file lives at the site root and PW_ARCHIVE points at
   it. Without that variable load() returns the fallback [], and every
   count below is legitimately zero: "1,077 of 0 entries have no tmdb id",
   "Nothing to do", exit 0. A clean run that examined nothing, which is the
   one failure this project keeps having. Refuse instead. */
if (!archive.length) {
  console.error(`No entries at ${paths.archive}.`);
  console.error('Set PW_ARCHIVE to the archive the site serves, or run from where it lives.');
  process.exit(1);
}

const yearOf = e => Number(String(e.year || '').slice(0, 4)) || 0;

const missing = archive.filter(f => !f.tmdbId);

/* Television is skipped rather than guessed at. Series carry P4983, not
   P4947, and their credits live behind aggregate_credits — a series id
   written into tmdbId would be read back as a film id and quietly resolve
   to the wrong endpoint. There are single figures of these; they deserve
   their own pass, not a special case here. */
const TV = /television series|television play|film series/i;
const tv = missing.filter(f => TV.test(f.type || ''));

const todo = missing
  .filter(f => !TV.test(f.type || ''))
  .filter(f => yearOf(f) >= FROM)
  .slice(0, LIMIT);

console.log(`${missing.length} of ${archive.length} entries have no tmdb id.`);
if (FROM) console.log(`Restricted to ${FROM} and later: ${todo.length} entries.`);
if (tv.length) console.log(`Skipping ${tv.length} television entr${tv.length === 1 ? 'y' : 'ies'} — P4983, not P4947.`);
console.log(`${dryRun ? 'Dry run.' : 'Writing.'}\n`);

if (!todo.length) { console.log('Nothing to do.'); process.exit(0); }

/* --- pass one: Wikidata may simply not have been asked ----------------- */

const ids = todo.map(f => f.id);
const known = new Map();
for (let i = 0; i < ids.length; i += 150) {
  const chunk = ids.slice(i, i + 150);
  const rows = await sparql(`
    SELECT ?f ?t WHERE {
      VALUES ?f { ${chunk.map(x => `wd:${x}`).join(' ')} }
      ?f wdt:P4947 ?t .
    }`).catch(() => []);
  rows.forEach(r => known.set(qid(r.f), r.t));
  await sleep(150);
}
console.log(`  Wikidata supplied ${known.size}.`);

/* --- the corroboration set: who Wikidata says is in each film ---------- */

/* Batched, because one query per film would be 327 round trips to save a
   few seconds of query planning. Several Latin-script languages, not just
   English, because a Danish or Bulgarian film often has no English label
   for its cast while TMDB lists them in transliteration. */
const castOf = new Map();
const needCast = todo.filter(f => !known.has(f.id)).map(f => f.id);
for (let i = 0; i < needCast.length; i += 40) {
  const chunk = needCast.slice(i, i + 40);
  const rows = await sparql(`
    SELECT ?f ?name WHERE {
      VALUES ?f { ${chunk.map(x => `wd:${x}`).join(' ')} }
      ?f wdt:P161 ?p .
      ?p rdfs:label ?name .
      FILTER(LANG(?name) IN ("en","fr","de","it","es","pt","da","sv","no","nl","pl","cs","hu","ro","tr","id","ms"))
    }`).catch(() => []);
  for (const r of rows) {
    const f = qid(r.f);
    if (!castOf.has(f)) castOf.set(f, new Set());
    castOf.get(f).add(norm(r.name));
  }
  await sleep(150);
}

/* The entry's own `stars` are already Latin-script and cost nothing. */
for (const f of todo) {
  if (!castOf.has(f.id)) castOf.set(f.id, new Set());
  for (const s of f.stars || []) castOf.get(f.id).add(norm(s));
  if (f.last?.name) castOf.get(f.id).add(norm(f.last.name));
}

/* --- pass two: TMDB search, corroborated ------------------------------- */

const tmdb = async path => {
  try {
    const join = path.includes('?') ? '&' : '?';
    const res = await fetch(`https://api.themoviedb.org/3${path}${join}` +
      `api_key=${encodeURIComponent(process.env.TMDB_KEY)}`);
    return res.ok ? await res.json() : null;
  } catch { return null; }
};

/* How many people this candidate shares with Wikidata's record. Compared
   on the full normalised name, and on surname alone as a fallback, because
   given names are the part transliteration mangles most ("Vassil" /
   "Vasil"). Surname-only would be too loose on its own; as a second chance
   behind a year match it is proportionate. */
function overlap(wdNames, tmdbCast) {
  if (!wdNames.size || !tmdbCast.length) return 0;
  const surnames = new Set([...wdNames].map(n => n.split(' ').pop()).filter(s => s.length > 3));
  let hits = 0;
  for (const person of tmdbCast) {
    const n = norm(person.name);
    if (wdNames.has(n)) { hits++; continue; }
    const s = surname(person.name);
    if (s.length > 3 && surnames.has(s)) hits++;
  }
  return hits;
}

const accepted = [], unconfirmed = [], nothingFound = [], deferred = [];

for (const f of todo) {
  if (known.has(f.id)) {
    accepted.push({ f, id: known.get(f.id), how: 'P4947', shared: null, why: 'Wikidata' });
    continue;
  }

  const year = yearOf(f);
  const found = await tmdb('/search/movie' +
    `?query=${encodeURIComponent(f.title || '')}` +
    (year ? `&year=${year}` : ''));

  /* null is not "no such film" — it is a request that failed. Reported
     separately so a rate-limited run cannot read as a catalogue gap. */
  if (found === null) { deferred.push({ f, why: 'search request failed' }); await sleep(60); continue; }

  const candidates = (found.results || []).filter(r => {
    const ry = Number(String(r.release_date || '').slice(0, 4)) || 0;
    return ry && year && Math.abs(ry - year) <= YEAR_SLACK;
  }).slice(0, 5);

  if (!candidates.length) { nothingFound.push({ f, why: 'no hit within a year of ' + (year || '????') }); await sleep(60); continue; }

  const wdNames = castOf.get(f.id) || new Set();
  let best = null;

  for (const c of candidates) {
    const credits = await tmdb(`/movie/${c.id}/credits`);
    await sleep(60);
    if (credits === null) { best = best || { deferred: true }; continue; }
    const shared = overlap(wdNames, credits.cast || []);
    const exact = Number(String(c.release_date || '').slice(0, 4)) === year;
    const need = exact ? EXACT_MIN_OVERLAP : NEAR_MIN_OVERLAP;
    if (shared >= need && (!best || shared > best.shared)) {
      best = { id: String(c.id), shared, exact, title: c.title, ry: String(c.release_date || '').slice(0, 4) };
    }
  }

  if (best?.deferred && !best.id) { deferred.push({ f, why: 'credits request failed' }); continue; }

  if (best?.id) {
    accepted.push({ f, id: best.id, how: best.exact ? 'exact year' : 'year ±1',
      shared: best.shared, why: `${best.shared} shared cast, TMDB "${best.title}" (${best.ry})` });
  } else {
    unconfirmed.push({ f, why: `${candidates.length} candidate(s) in range, none sharing enough cast` });
  }
}

/* --- report ------------------------------------------------------------- */

console.log(`  TMDB search supplied ${accepted.filter(a => a.how !== 'P4947').length}.\n`);

if (accepted.length) {
  console.log(`ACCEPTED (${accepted.length}) — audit these before writing:`);
  for (const a of accepted) {
    console.log(`  ${String(yearOf(a.f)).padStart(4)}  ${(a.f.title || '').slice(0, 34).padEnd(34)}` +
      `  ${String(a.id).padStart(8)}  ${a.how.padEnd(10)}  ${a.why}`);
  }
  console.log('');
}

const bucket = (name, list) => {
  if (!list.length) return;
  console.log(`${name} (${list.length}):`);
  for (const x of list.slice(0, 15)) {
    console.log(`  ${String(yearOf(x.f)).padStart(4)}  ${(x.f.title || '').slice(0, 34).padEnd(34)}  ${x.why}`);
  }
  if (list.length > 15) console.log(`  … and ${list.length - 15} more`);
  console.log('');
};

bucket('COULD NOT CONFIRM — a candidate existed, the cast did not agree', unconfirmed);
bucket('NOTHING FOUND — TMDB has no film at that title and year', nothingFound);
bucket('DEFERRED — a lookup failed, so this is not an answer', deferred);

console.log(`${accepted.length} to fill, ${unconfirmed.length} unconfirmed, ` +
  `${nothingFound.length} absent, ${deferred.length} deferred.`);
if (deferred.length) console.log('Deferrals are failed lookups, not results. Re-run for those before believing the totals.');

if (dryRun) {
  console.log('\nDry run — nothing written.');
  process.exit(0);
}

for (const a of accepted) a.f.tmdbId = a.id;
await saveArchive(archive);
console.log(`\nRepaired ${accepted.length} entries. Now run recheck.js.`);
