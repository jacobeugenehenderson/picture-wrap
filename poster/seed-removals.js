/* ==========================================================================
   PICTURE WRAP — poster/seed-removals.js

   Opens the retraction record with the departures we already know about.

     node seed-removals.js --before <dir> --left 2026-08-03
     node seed-removals.js --before <dir> --left 2026-08-03 --dry-run

   WHY THIS EXISTS, AND WHY IT IS A ONE-OFF

   `build-corpus.js` keeps the record from now on: it holds a roll of what
   is published and writes a line whenever something leaves. It can only
   report departures it witnessed, which is correct — we must not claim to
   have seen something we did not.

   But the record would then open empty on the very day 136 pictures left
   it, which reads as "nothing has ever been retracted" and is the exact
   false impression the record exists to prevent. The largest retraction
   this archive has made would be the one thing missing from it.

   So this seeds the ledger from a snapshot of `pass/` taken before the
   repair, comparing what was closed then against what is closed now.
   Anything that was closed and is no longer closed anywhere left.

   `entered` is null on every seeded line and stays null. These pictures
   were published across many builds before any roll existed, and the date
   each first appeared is not recoverable. A retraction that guesses when
   the claim began is worse than one that says it does not know.

   Run once. After that `build-corpus.js` owns the file.
   ========================================================================== */

import { readFile, writeFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i === -1 ? fallback : args[i + 1];
};

const IN = value('--in', process.env.PW_PASS || 'pass');
const BEFORE = value('--before', null);
const LEFT = value('--left', new Date().toISOString().slice(0, 10));
const dryRun = args.includes('--dry-run');

if (!BEFORE) {
  console.error('Usage: node seed-removals.js --before <snapshot-dir> --left YYYY-MM-DD');
  process.exit(1);
}

const lines = async path =>
  (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean).map(l => JSON.parse(l));

const yearsIn = async dir => (await readdir(dir, { withFileTypes: true }))
  .filter(e => e.isDirectory() && /^\d{4}$/.test(e.name))
  .map(e => e.name).sort();

/* What the snapshot had closed. */
const was = new Map();
for (const year of await yearsIn(BEFORE)) {
  let works;
  try { works = await lines(join(BEFORE, year, 'works.jsonl')); } catch { continue; }
  for (const w of works) if (w.verdict === 'closed' && !was.has(w.id)) was.set(w.id, w);
}

/* What is closed now, and what the pass says about everything else. */
const now = new Map();
for (const year of await yearsIn(IN)) {
  let works;
  try { works = await lines(join(IN, year, 'works.jsonl')); } catch { continue; }
  for (const w of works) {
    if (!now.has(w.id)) now.set(w.id, []);
    now.get(w.id).push(w);
  }
}

const stillClosed = id => (now.get(id) || []).some(w => w.verdict === 'closed');
const departed = [...was.keys()].filter(id => !stillClosed(id));

/* Who was found living. `heldOpenBy` where Wikidata settled it; the
   evidence where TMDB did. */
const wanted = new Set(departed);
const living = new Map();
for (const year of await yearsIn(IN)) {
  let evidence;
  try { evidence = await lines(join(IN, year, 'evidence.jsonl')); } catch { continue; }
  for (const e of evidence) {
    if (!wanted.has(e.id) || living.has(e.id)) continue;
    const alive = (e.judged || [])
      .filter(p => p.status === 'alive' && !p.impossible)
      .map(p => ({ name: p.name, wikidataId: p.wikidataId ?? null }));
    if (alive.length) living.set(e.id, alive);
  }
}

const departures = departed.map(id => {
  const before = was.get(id);
  const openRow = (now.get(id) || []).find(w => w.verdict === 'open');
  return {
    id,
    title: before.title,
    year: before.year,
    published: {
      wrapped: before.wrapped ?? before.wrappedYear ?? null,
      closer: before.last?.name ?? null,
    },
    /* Not recoverable for these; see the header. */
    entered: null,
    left: LEFT,
    verdict: openRow?.verdict ?? 'absent',
    reason: openRow?.reason ?? 'no longer in the pass',
    living: openRow?.heldOpenBy?.map(p => ({ name: p.name, wikidataId: p.wikidataId ?? null }))
      ?? living.get(id) ?? [],
  };
}).sort((a, b) => (a.year || '').localeCompare(b.year || ''));

console.log(`${departed.length} departures reconstructed from ${BEFORE}`);
const named = departures.filter(d => d.living.length).length;
console.log(`  ${named} name at least one living person`);
console.log(`  ${departures.length - named} left without a name attached`);
for (const d of departures.slice(0, 5)) {
  console.log(`  ${d.year}  ${d.title} — was ${d.published.wrapped} by ` +
    `${d.published.closer}; ${d.living.map(p => p.name).join(', ') || d.reason}`);
}

if (dryRun) { console.log('\ndry run, nothing written'); process.exit(0); }

const path = join(IN, 'removed.jsonl');
let existing = [];
try { existing = await lines(path); } catch { /* first run */ }

const seen = new Set(existing.map(d => `${d.id}|${d.left}`));
const fresh = departures.filter(d => !seen.has(`${d.id}|${d.left}`));

await writeFile(path, [...existing, ...fresh].map(d => JSON.stringify(d)).join('\n') + '\n');
console.log(`\n${fresh.length} appended to ${path} (${existing.length} already there)`);

/* Opening the roll from a corpus that is already published.

   `build-corpus.js` can only report a departure it witnessed, and it
   witnesses by diffing against the roll. With no roll, the first build
   after this reports nothing — including the eleven pictures that the
   living-person veto is about to remove, which are real retractions and
   would vanish unrecorded.

   So the roll is opened from what is on the origin now. Every entry
   carries `entered: null`: we know these were published and we do not
   know the day each first appeared, and the build is careful to leave
   that null rather than restamp it. */
const ROLL_FROM = value('--roll-from', null);
if (ROLL_FROM) {
  const { readdir: rd } = await import('node:fs/promises');
  const versions = (await rd(join(ROLL_FROM, 'v'), { withFileTypes: true }))
    .filter(e => e.isDirectory()).map(e => e.name);
  if (versions.length !== 1) {
    console.error(`expected one version in ${ROLL_FROM}/v, found ${versions.length}`);
    process.exit(1);
  }
  const yearDir = join(ROLL_FROM, 'v', versions[0], 'year');
  const rollEntered = {};
  for (const file of await rd(yearDir)) {
    for (const e of JSON.parse(await readFile(join(yearDir, file), 'utf8'))) {
      rollEntered[e.id] = {
        entered: null,
        title: e.title, year: e.year,
        wrapped: e.wrapped ?? e.wrappedYear ?? null,
        closer: e.last?.name ?? null,
      };
    }
  }
  await writeFile(join(IN, 'published.json'),
    JSON.stringify({ at: LEFT, entered: rollEntered }));
  console.log(`roll opened from ${ROLL_FROM} — ${Object.keys(rollEntered).length} pictures, ` +
    `entry dates unknown and recorded as such`);
}
