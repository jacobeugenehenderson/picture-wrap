/* ==========================================================================
   PICTURE WRAP — poster/backfill-tmdbids.js

   Fills in tmdbId for Vault entries that have none.

   Two causes, both worth repairing. The posting path in review.js used to
   drop the field, so every announced picture lost it. And some films have
   no P4947 on Wikidata at all, so it was never known.

   Without tmdbId, recheck.js cannot verify an entry — it falls straight
   through to "closed". These were the least checked entries in the Vault
   and included every one we published.

     node backfill-tmdbids.js --dry-run
     node backfill-tmdbids.js

   Wikidata first, TMDB search second, matched on title AND release year.
   A wrong id is worse than none, so an unmatched entry stays null.
   ========================================================================== */

import { sparql, load, save, paths, sleep, qid, saveArchive,
} from './lib.js';

const dryRun = process.argv.includes('--dry-run');
if (!process.env.TMDB_KEY) { console.error('Set TMDB_KEY first.'); process.exit(1); }

const archive = await load(paths.archive, []);
const todo = archive.filter(f => !f.tmdbId);
console.log(`${todo.length} of ${archive.length} entries have no tmdb id.\n`);

/* Pass one: Wikidata may simply not have been asked. */
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

/* Pass two: TMDB search, but only trust an exact year match. */
async function search(title, year) {
  if (!title || !year) return null;
  try {
    const res = await fetch('https://api.themoviedb.org/3/search/movie' +
      `?api_key=${encodeURIComponent(process.env.TMDB_KEY)}` +
      `&query=${encodeURIComponent(title)}&year=${encodeURIComponent(year)}`);
    if (!res.ok) return null;
    const { results } = await res.json();
    const hit = (results || []).find(r =>
      String(r.release_date || '').slice(0, 4) === String(year));
    return hit ? String(hit.id) : null;
  } catch { return null; }
}

let fromSearch = 0, stillNone = 0;
for (const f of todo) {
  if (known.has(f.id)) { f.tmdbId = known.get(f.id); continue; }
  const found = await search(f.title, f.year);
  if (found) { f.tmdbId = found; fromSearch++; }
  else stillNone++;
  await sleep(60);
}

console.log(`  TMDB search supplied ${fromSearch}.`);
console.log(`  ${stillNone} still have none — they stay unverifiable.\n`);

if (dryRun) { console.log('Dry run — nothing written.'); process.exit(0); }
await saveArchive( archive);
console.log(`Repaired ${known.size + fromSearch} entries. Now run recheck.js.`);
