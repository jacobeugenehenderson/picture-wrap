/* ==========================================================================
   PICTURE WRAP — poster/pass.js

   One release year, judged and written down.

     node pass.js --year 1924
     node pass.js --year 1924 --limit 50        try it small first
     node pass.js --year 1924 --out pass/       where it writes

   WHY THIS EXISTS AND recheck.js DOES NOT DO IT

   Every pass this project has run so far kept the verdict and threw away
   everything that produced it. The archive records that a picture closed;
   it does not record who was judged, on what dates, from which database,
   or when. So every question — is that date right, what would a different
   age ceiling do, how complete is that cast list — has to be bought again
   at four hours a time, and a rule change costs a full re-fetch.

   This writes the working out. Four files per year:

     works.jsonl      one line per picture: the verdict and how it was made
     evidence.jsonl   one line per picture: EVERY maker judged, with dates
     people.jsonl     one line per person, merged across years
     failures.jsonl   what did not answer, so a re-run knows what to retry

   The test of whether that is enough is not opinion. It is: can the year's
   verdicts be reproduced from the files alone, with the network unplugged?
   That is what audit.js asks, and until it passes the schema is a guess.

   NOTHING HERE FILES OR POSTS. It reads Wikidata and TMDB and writes to
   its own directory. The Vault is untouched.
   ========================================================================== */

import { writeFile, readFile, mkdir, appendFile, rename } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

import { sparql, qid, sleep, HERE } from './lib.js';
import { WORK_CLASSES, IN_LIST, LANGS, mostSpecificType } from '../shared.js';
/* The judgement itself lives in judge.js, shared with retest.js. A second
   copy of it is the mistake this project has made three times. */
import { creditsQuery, judge } from './judge.js';

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i === -1 ? fallback : args[i + 1];
};

const YEAR = Number(value('--year', 0));
/* Where the working out lands, and it should not be here.

   The repository lives under Desktop/dev.nosync — a folder named for the
   fact that iCloud is kept out of it — and `pass/` is gitignored on top
   of that, on a machine with no Time Machine destination configured. All
   three are right for source code, which git and GitHub already protect.
   All three are wrong for the one artifact whose whole purpose is not
   having to compute it again.

     export PW_PASS=/somewhere/that/is/actually/backed/up

   Same shape as PW_ARCHIVE. --archive additionally drops a gzipped copy
   of each finished year somewhere else the moment it is done, so a run
   that dies at hour ninety loses the year in flight and nothing else. */
const OUT = value('--out', process.env.PW_PASS || 'pass');
const ARCHIVE = value('--archive', process.env.PW_PASS_ARCHIVE || null);
const LIMIT = Number(value('--limit', Infinity));
const CONCURRENCY = Number(value('--concurrency', 4));

if (!YEAR) { console.error('Usage: node pass.js --year 1924'); process.exit(1); }
if (!process.env.TMDB_KEY) { console.error('Set TMDB_KEY first.'); process.exit(1); }

const TMDB_KEY = process.env.TMDB_KEY;

/* Which rules produced these verdicts. Stored on every line, because the
   point of keeping evidence is to re-decide later — and a re-decision is
   meaningless if you cannot tell what the first decision was made under. */
const RULES = {
  oldest: 112,
  maximumAge: 122,
  code: (() => {
    try { return execSync('git rev-parse --short HEAD').toString().trim(); }
    catch { return 'unknown'; }
  })(),
};

/* --- what happened in this year ---------------------------------------- */

/* Every moving picture released in the year with at least one credited
   maker. WORK_CLASSES rather than Q11424: see shared.js — asking only for
   "film" hid four fifths of 1912.

   All release dates, not a sample. A picture with a premiere and a
   re-release has two, and which one you take changes who could have
   worked on it. The latest is the permissive reading, which is the one to
   fail toward: it drops the fewest people from the reckoning. */
const worksQuery = year => `
SELECT ?film ?filmLabel ?typeLabel (MAX(?y) AS ?year)
       (GROUP_CONCAT(DISTINCT ?y; separator=",") AS ?years)
       (SAMPLE(?tmdbFilm) AS ?tmdb) (SAMPLE(?tmdbTv) AS ?tv) WHERE {
  VALUES ?type { ${WORK_CLASSES.map(c => `wd:${c}`).join(' ')} }
  ?film wdt:P31 ?type ; wdt:P577 ?rd .
  BIND(YEAR(?rd) AS ?y)
  FILTER(?y = ${year})
  FILTER EXISTS { ?film ?anyProp ?anyone . FILTER(?anyProp IN (${IN_LIST})) }
  OPTIONAL { ?film wdt:P4947 ?tmdbFilm }
  OPTIONAL { ?film wdt:P4983 ?tmdbTv }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${LANGS}". }
} GROUP BY ?film ?filmLabel ?typeLabel`;

/* --- reaching TMDB ----------------------------------------------------- */

const tmdbGet = async path => {
  const join2 = path.includes('?') ? '&' : '?';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3${path}${join2}api_key=${encodeURIComponent(TMDB_KEY)}`);
      if (res.status === 429) { await sleep(2000); continue; }
      if (!res.ok) return null;
      return await res.json();
    } catch { await sleep(500); }
  }
  return null;
};

/* People who asked not to be named, honoured here as well as on the site.

   A suppression that covered only the pages would be theatre: the name
   would sit in the evidence, in the person table, and in any copy handed
   to a researcher. It takes the name and never the vote — the person is
   still judged, still holds their picture open, and is still counted.
   What goes is only the identity. */
const withheld = new Set(
  JSON.parse(await readFile(join(HERE, '..', 'vault', 'suppressed.json'), 'utf8')
    .catch(() => '[]')));

const anonymise = person => (person.wikidataId && withheld.has(person.wikidataId)
  ? { ...person, name: null, tmdbId: null, suppressed: true }
  : person);

/* --- go ---------------------------------------------------------------- */

const dir = join(OUT, String(YEAR));
await mkdir(dir, { recursive: true });
await mkdir(join(OUT, 'people'), { recursive: true });

const worksPath    = join(dir, 'works.jsonl');
const evidencePath = join(dir, 'evidence.jsonl');
const failuresPath = join(dir, 'failures.jsonl');
const peoplePath   = join(OUT, 'people', `${YEAR}.jsonl`);

for (const path of [worksPath, evidencePath, failuresPath]) await writeFile(path, '');

console.log(`\n${YEAR} — asking what was released…`);
const rows = await sparql(worksQuery(YEAR));

/* One row per picture, whatever Wikidata calls it.

   The query groups by ?typeLabel, so a picture holding two of the classes
   we ask about comes back twice — 1,166 are both "film" and "short film"
   — and the pass judged each row as if it were a separate picture. Same
   credits, so the same verdict, so the same closing filed twice: 1,302
   doubled entries in the Vault, Casablanca and Attack among them.

   Grouping by the label was the mistake, but SAMPLE would only replace a
   duplicate with a coin toss. The classes are ranked general-to-specific
   in shared.js and the most specific one wins, so the row that survives
   is the one that says the most. Merged here rather than in the query
   because the reason is a project rule, and it belongs where the rule
   is written down. */
const merged = new Map();
for (const r of rows) {
  const id = qid(r.film);
  const seen = merged.get(id);
  if (seen) { seen.types.push(r.typeLabel || null); continue; }
  merged.set(id, { ...r, types: [r.typeLabel || null] });
}
const duplicated = rows.length - merged.size;

const works = [...merged.values()]
  .slice(0, LIMIT === Infinity ? undefined : LIMIT)
  .map(r => ({
    id: qid(r.film),
    title: r.filmLabel || qid(r.film),
    type: mostSpecificType(r.types),
    year: r.year || String(YEAR),
    years: (r.years || '').split(',').filter(Boolean),
    tmdb: r.tmdb || null,
    tv: r.tv || null,
  }));
console.log(`  ${works.length} pictures with at least one credited maker` +
  (duplicated ? `  (${duplicated} extra rows merged on type)` : '') + '\n');

/* Credits for everything first, in one batched sweep. Cheaper than a
   query per picture by a factor of twenty, and it means the expensive
   half runs against data already in hand. */
const credits = new Map(works.map(w => [w.id, []]));
for (let i = 0; i < works.length; i += 20) {
  const batch = works.slice(i, i + 20);
  try {
    for (const row of await sparql(creditsQuery(batch.map(w => w.id)))) {
      const film = qid(row.film);
      if (credits.has(film)) credits.get(film).push(row);
    }
  } catch (err) {
    for (const w of batch) {
      await appendFile(failuresPath,
        JSON.stringify({ id: w.id, stage: 'credits', error: String(err.message) }) + '\n');
    }
  }
  if (i && i % 200 === 0) console.log(`  credits … ${i}/${works.length}`);
}

/* One file per year, folded together on demand.

   The person table is the asset the whole exercise is for: 63% of
   everyone judged is dead, dead is final, and a person written down once
   never has to be asked about again. But it was being held as one merged
   file that every year read whole and rewrote whole — fine at 13,000
   people and a 240 MB rewrite per year by the 1970s, for a file that
   barely changes.

   So each year writes only what it learned. `rebuild.js --people` folds
   them into pass/people.jsonl whenever the merged view is wanted, which
   is the same bargain as the rest of this design: keep the parts, derive
   the whole, and never pay for the whole while doing the parts. */
const people = new Map();

const tally = { closed: 0, open: 0, unchecked: 0, unverified: 0, dated: 0, undated: 0 };
let done = 0;

for (let i = 0; i < works.length; i += CONCURRENCY) {
  const chunk = works.slice(i, i + CONCURRENCY);

  const results = await Promise.all(chunk.map(async work => {
    try {
      return { work, ...(await judge(work, credits.get(work.id) || [], { sparql, tmdb: tmdbGet })) };
    }
    catch (err) { return { work, verdict: 'unchecked', reason: 'threw', ok: false,
                           error: String(err.message), recorded: [], resolved: [] }; }
  }));

  for (const r of results) {
    const judged = [...(r.recorded || []), ...(r.resolved || [])].map(anonymise);

    await appendFile(worksPath, JSON.stringify({
      id: r.work.id, title: r.work.title, type: r.work.type,
      year: r.work.year, releaseYears: r.work.years,
      tmdbId: r.work.tv || r.work.tmdb || null, media: r.work.tv ? 'tv' : 'movie',
      verdict: r.verdict, reason: r.reason, tested: r.tested ?? false,
      unverified: r.unverified ?? false,
      heldOpenBy: r.heldOpenBy ?? null,
      wrapped: r.wrapped ?? null, wrappedYear: r.wrappedYear ?? null,
      dateBasis: r.dateBasis ?? null,
      /* Through the same filter as everyone else. The last of a picture's
         makers is by definition dead, so this should never fire — but a
         suppression that holds everywhere except one field is the field
         that leaks. */
      last: r.last ? anonymise(r.last) : null,
      makerCount: (r.recorded || []).length,
      tmdbCredited: r.tmdbCredited ?? null,
      coverage: r.tmdbCredited ? +((r.recorded.length / r.tmdbCredited).toFixed(3)) : null,
      unknownCount: r.unknownCount ?? null,
      unknownNames: judged.filter(p => p.status === 'unknown').map(p => p.name),
      checkedAt: new Date().toISOString(),
      rules: RULES,
    }) + '\n');

    await appendFile(evidencePath, JSON.stringify({
      id: r.work.id, releaseYear: Number(r.work.year) || YEAR, judged,
    }) + '\n');

    if (!r.ok) {
      await appendFile(failuresPath, JSON.stringify({
        id: r.work.id, title: r.work.title, stage: 'judge',
        reason: r.reason, error: r.error ?? null,
      }) + '\n');
    }

    /* One row per human, merged across pictures. A bit player turns up in
       thirty of them, and 63% of everyone judged is dead — which is final,
       so the row is written once and read for ever. */
    for (const p of judged) {
      const key = p.tmdbId ? `tmdb:${p.tmdbId}` : `wd:${p.wikidataId}`;
      const prior = people.get(key);
      if (!prior || (!prior.wd?.died && p.wd?.died)) {
        people.set(key, {
          key, name: p.name,
          wikidataId: p.wikidataId || null, tmdbId: p.tmdbId || null,
          wd: p.wd || null, tmdb: p.tmdb || null,
          status: p.status, buriedByName: p.buriedByName ?? false,
          checkedAt: new Date().toISOString(),
        });
      }
    }

    if (r.verdict === 'closed') {
      tally.closed++;
      if (r.wrapped) tally.dated++; else tally.undated++;
      if (r.unverified) tally.unverified++;
    } else if (r.verdict === 'open') tally.open++;
    else tally.unchecked++;
  }

  done += chunk.length;
  if (done % 100 < CONCURRENCY) {
    console.log(`  ${done}/${works.length} — ${tally.closed} closed, ${tally.open} open, ${tally.unchecked} unchecked`);
  }
  await sleep(120);
}

await writeFile(peoplePath,
  [...people.values()].sort((a, b) => a.key.localeCompare(b.key))
    .map(p => JSON.stringify(p)).join('\n') + '\n');

console.log(`\n${YEAR} done.`);
console.log(`  closed        ${tally.closed}  (${tally.dated} dated, ${tally.undated} with no day-precise death)`);
console.log(`  open          ${tally.open}`);
console.log(`  unchecked     ${tally.unchecked}`);
console.log(`  unverified    ${tally.unverified}  (no TMDB id, Wikidata's word alone)`);
console.log(`  people kept   ${people.size}`);
console.log(`  written to    ${dir}/ and ${peoplePath}`);

/* The year, sealed into one compressed file somewhere else, the moment it
   is finished. A hundred-hour run on an unbacked-up laptop otherwise has
   a hundred hours of single points of failure; with this it has one
   year's worth. Written to a temporary name and renamed, so an archive
   file that exists is always a complete one. */
if (ARCHIVE) {
  await mkdir(ARCHIVE, { recursive: true });
  const target = join(ARCHIVE, `${YEAR}.jsonl.gz`);
  const bundle = [worksPath, evidencePath, failuresPath];
  const source = createReadStream(bundle[0]);
  const out = createWriteStream(target + '.part');
  await pipeline(source, createGzip(), out);
  for (const extra of bundle.slice(1)) {
    await pipeline(createReadStream(extra), createGzip(),
      createWriteStream(target + '.part', { flags: 'a' }));
  }
  await rename(target + '.part', target);
  console.log(`  archived to   ${target}`);
}

console.log(`  beyondLiving cutoff in force: born before ${2026 - RULES.maximumAge}\n`);
