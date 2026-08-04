/* ==========================================================================
   PICTURE WRAP — poster/archive-pass.js

   Re-seals finished years into the durable archive, without re-running
   anything.

     node archive-pass.js --years 1890-2026            refresh what is stale
     node archive-pass.js --years 1890-2026 --dry-run  say what it would do
     node archive-pass.js --years 1890-2026 --all      re-seal every year

   WHY THIS EXISTS

   `pass.js` seals each year into `$PW_PASS_ARCHIVE/<year>.jsonl.gz` the
   moment it finishes, so a hundred-hour run on an unbacked-up laptop has
   one year's worth of exposure rather than a hundred. `retest.js` and
   `provenance.js` re-seal after they change a year.

   `rebuild.js`, `dedupe.js` and `enrich.js` do not — and those are the
   three that ran on 3 August 2026, which is how the durable copy came to
   be a day behind every year in the working tree while every file that
   mattered had been rewritten. The gap was invisible because a stale
   archive and a current one look identical from the outside: 137 files,
   all present, all complete.

   Rather than teach three more scripts to archive — and the fourth, and
   the one after that — this makes re-sealing its own verb. Run it after
   any offline repair.

   IT IS NOT A BACKUP TOOL. It re-seals from what is on disk now. If the
   working tree is wrong, this copies the wrongness over the good copy —
   so `--dry-run` first, and `audit.js` before that, is the order.

   The bundle format is `pass.js`'s exactly: works, then evidence, then
   failures, each gzipped and concatenated. gzip decompresses concatenated
   members as one stream, so `gzcat <year>.jsonl.gz` reads them end to
   end. Written to `.part` and renamed, so an archive file that exists is
   always a complete one.
   ========================================================================== */

import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, stat, readdir } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { join } from 'node:path';

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i === -1 ? fallback : args[i + 1];
};

const OUT = value('--out', process.env.PW_PASS || 'pass');
const ARCHIVE = value('--archive', process.env.PW_PASS_ARCHIVE || null);
const dryRun = args.includes('--dry-run');
const all = args.includes('--all');
const single = Number(value('--year', 0));
const range = value('--years', null);

if (!ARCHIVE) {
  console.error('Set PW_PASS_ARCHIVE, or pass --archive <dir>.');
  process.exit(1);
}

const years = single ? [single]
  : range ? (() => {
      const [from, to] = range.split('-').map(Number);
      return Array.from({ length: to - from + 1 }, (_, i) => from + i);
    })()
  : [];

if (!years.length) {
  console.error('Usage: node archive-pass.js --years 1890-2026');
  process.exit(1);
}

const when = async path => {
  try { return (await stat(path)).mtimeMs; } catch { return null; };
};

/* Staleness is "the archive is older than the newest of the three files it
   holds". Not a content comparison: the archive is compressed and
   concatenated, so telling whether it matches means decompressing 133 MB
   to answer a question mtime answers for free. The cost of being wrong is
   an unnecessary re-seal, which is seconds. */
const plan = [];
for (const year of years) {
  const dir = join(OUT, String(year));
  const bundle = ['works', 'evidence', 'failures'].map(n => join(dir, `${n}.jsonl`));
  const times = await Promise.all(bundle.map(when));

  if (times[0] === null) continue;                    // year never passed
  const missing = bundle.filter((_, i) => times[i] === null);
  const newest = Math.max(...times.filter(Boolean));
  const sealed = await when(join(ARCHIVE, `${year}.jsonl.gz`));

  const why = sealed === null ? 'never archived'
    : newest > sealed ? 'stale'
    : all ? 'forced'
    : null;

  if (why) plan.push({ year, dir, bundle: bundle.filter((_, i) => times[i] !== null), why, missing });
}

const fresh = years.length - plan.length;
console.log(`${plan.length} to seal, ${fresh} already current, into ${ARCHIVE}\n`);

if (dryRun) {
  for (const p of plan) console.log(`  ${p.year}  ${p.why}`);
  console.log('\nDry run. Nothing written.');
  process.exit(0);
}

await mkdir(ARCHIVE, { recursive: true });

let sealed = 0;
for (const p of plan) {
  const target = join(ARCHIVE, `${p.year}.jsonl.gz`);
  const part = target + '.part';

  await pipeline(createReadStream(p.bundle[0]), createGzip(), createWriteStream(part));
  for (const extra of p.bundle.slice(1)) {
    await pipeline(createReadStream(extra), createGzip(),
      createWriteStream(part, { flags: 'a' }));
  }
  await rename(part, target);

  sealed++;
  const note = p.missing.length ? `  (no ${p.missing.map(m => m.split('/').pop()).join(', ')})` : '';
  if (sealed % 10 === 0 || p.missing.length) {
    console.log(`  ${p.year}  ${sealed}/${plan.length}${note}`);
  }
}

/* Every year the working tree has, against every year the archive has.
   A year in one and not the other is the failure this exists to prevent,
   so it is reported rather than left for somebody to notice. */
const onDisk = new Set((await readdir(OUT, { withFileTypes: true }))
  .filter(e => e.isDirectory() && /^\d{4}$/.test(e.name)).map(e => e.name));
const archived = new Set((await readdir(ARCHIVE))
  .filter(f => f.endsWith('.jsonl.gz')).map(f => f.replace('.jsonl.gz', '')));

const unsealed = [...onDisk].filter(y => !archived.has(y)).sort();
const orphaned = [...archived].filter(y => !onDisk.has(y)).sort();

console.log(`\n${sealed} sealed.`);
console.log(`  ${onDisk.size} years on disk, ${archived.size} in the archive`);
if (unsealed.length) console.log(`  NOT ARCHIVED: ${unsealed.join(' ')}`);
if (orphaned.length) console.log(`  in the archive only: ${orphaned.join(' ')}`);
if (!unsealed.length && !orphaned.length) console.log('  the two agree');
