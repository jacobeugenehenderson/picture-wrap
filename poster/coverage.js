/* ==========================================================================
   PICTURE WRAP — poster/coverage.js

   Asks TMDB how many cast members each Vault picture really had, and
   records it. Wikidata says "all 5 people credited have died"; TMDB knows
   whether 5 was the whole cast or a fifth of it.

     node coverage.js            measure everything not yet measured
     node coverage.js --recheck  re-measure entries already done
     node coverage.js --limit 50 stop after 50 (try it before the full run)

   Needs a key:

     export TMDB_KEY="..."       themoviedb.org → Settings → API

   Free for non-commercial use. This is the POSTER's key, read from the
   environment; it is not the public one in the website's app.js.

   Nothing here changes what has wrapped. Coverage is context for a human
   reading the queue, and a number on the page. It never gates anything.
   ========================================================================== */

import { load, paths, sleep, tmdbCastCount, coverage, saveArchive,
} from './lib.js';

const args = process.argv.slice(2);
const recheck = args.includes('--recheck');
const limitIx = args.indexOf('--limit');
const limit = limitIx === -1 ? Infinity : Number(args[limitIx + 1]);

const CONCURRENCY = 4;
const CHECKPOINT = 200;

if (!process.env.TMDB_KEY) {
  console.error('Set TMDB_KEY first:\n  export TMDB_KEY="..."   (themoviedb.org → Settings → API)');
  process.exit(1);
}

const archive = await load(paths.archive, []);
if (!archive.length) { console.log('Vault is empty.'); process.exit(0); }

const todo = archive.filter(f =>
  f.tmdbId && (recheck || f.tmdbCast === undefined)).slice(0, limit);

const noId = archive.filter(f => !f.tmdbId).length;

console.log(`${archive.length} in the vault.`);
console.log(`${todo.length} to measure${noId ? `, ${noId} have no TMDB id and can't be` : ''}.\n`);

let done = 0, measured = 0, sinceSave = 0;

for (let i = 0; i < todo.length; i += CONCURRENCY) {
  const chunk = todo.slice(i, i + CONCURRENCY);

  await Promise.all(chunk.map(async film => {
    const count = await tmdbCastCount(film.tmdbId);
    /* null means TMDB didn't answer — a missing film, a rate limit, a
       network blip. Record it so we don't retry forever, but distinguish
       it from a real zero. */
    film.tmdbCast = count;
    if (count) measured++;
  }));

  done += chunk.length;
  sinceSave += chunk.length;

  if (sinceSave >= CHECKPOINT) {
    await saveArchive( archive);
    sinceSave = 0;
    console.log(`   ${done}/${todo.length} measured (saved)`);
  }

  await sleep(200);
}

await saveArchive( archive);

/* --- what it found ----------------------------------------------------- */

const withCoverage = archive.filter(f => f.tmdbCast);
const ratios = withCoverage.map(f => coverage(f.castCount, f.tmdbCast));
const thin = withCoverage.filter(f => coverage(f.castCount, f.tmdbCast) < 0.5);

const median = ratios.length
  ? [...ratios].sort((a, b) => a - b)[Math.floor(ratios.length / 2)]
  : null;

console.log(`\n${measured} measured, ${archive.length - measured} unmeasured.`);
if (median !== null) {
  console.log(`median coverage: ${Math.round(median * 100)}%`);
  console.log(`under 50%:       ${thin.length} picture(s)`);
  console.log('\nthinnest records in the vault:');
  for (const f of [...thin].sort((a, b) =>
      coverage(a.castCount, a.tmdbCast) - coverage(b.castCount, b.tmdbCast)).slice(0, 10)) {
    console.log(`   ${String(Math.round(coverage(f.castCount, f.tmdbCast) * 100)).padStart(3)}%  ` +
      `${f.title.slice(0, 34).padEnd(36)}${f.castCount} of ${f.tmdbCast}`);
  }
}
