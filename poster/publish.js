/* ==========================================================================
   PICTURE WRAP — poster/publish.js

   Turns the corpus into static files a browser can serve itself from.

     node publish.js                     from pass/, into dist/
     node publish.js --in pass --out dist

   THE CONTRACT, WHICH IS THE WHOLE DESIGN

   Everything this writes is immutable and lives under a version. The only
   mutable object is manifest.json. A client fetches the manifest once with
   a short cache lifetime, and everything it fetches afterwards can be
   cached for a year, because a changed corpus produces a new version and
   therefore new paths. That is the entire cache-invalidation story and it
   never needs revisiting.

   The version is a hash of the content, not a timestamp: the same corpus
   publishes to the same paths, so a rebuild that changes nothing costs
   nothing and republishes nothing.

   ADDRESSING

   No file exists that a client has to read in order to find out which file
   it needs. Every surface is addressed by something the client already
   holds — a Wikidata id, a release year, a day of the year. That property
   is what separates "a forty megabyte dataset" from "a forty megabyte
   download", and it matters more than any of the file sizes.

     year/<year>.json    the closings of one release year
     day/<MM-DD>.json    every closing that ever happened on one date
     ids.bin             which pictures are closed at all
     summary.json        totals, enough to draw a landing page

   ids.bin is a sorted array of 32-bit Wikidata numbers, not JSON. A person
   page asks "is this film closed?" once per credit, up to sixty times, so
   it cannot fetch per lookup and cannot afford a megabyte of quoted
   strings. Binary and sorted, it is a quarter of the size and answers by
   binary search with no parsing at all.

   Nothing here decides anything. Every verdict was reached by the pass and
   this only arranges the results.
   ========================================================================== */

import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i === -1 ? fallback : args[i + 1];
};

const IN = value('--in', process.env.PW_PASS || 'pass');
const OUT = value('--out', 'dist');

const lines = async path =>
  (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean).map(l => JSON.parse(l));

/* --- gather ------------------------------------------------------------ */

const years = (await readdir(IN, { withFileTypes: true }))
  .filter(e => e.isDirectory() && /^\d{4}$/.test(e.name))
  .map(e => Number(e.name))
  .sort((a, b) => a - b);

if (!years.length) { console.error(`no judged years in ${IN}/`); process.exit(1); }

/* What a list row needs and nothing else. A picture's own page is computed
   live from Wikidata, so anything a reader sees only after clicking does
   not belong in a file every reader downloads. */
const row = w => ({
  id: w.id,
  title: w.title,
  year: w.year,
  wrapped: w.wrapped,
  wrappedYear: w.wrappedYear,
  dateBasis: w.dateBasis,
  last: w.last ? { name: w.last.name, died: w.last.died } : null,
  type: w.type,
  genres: w.genres?.length ? w.genres : undefined,
  makers: w.makerCount,
  coverage: w.coverage ?? undefined,
  unknown: w.unknownCount ?? undefined,
});

const byYear = new Map();
const byDay = new Map();
const ids = [];
let closed = 0, open = 0, unchecked = 0;

for (const year of years) {
  let works;
  try { works = await lines(join(IN, String(year), 'works.jsonl')); } catch { continue; }

  for (const w of works) {
    if (w.verdict === 'open') { open++; continue; }
    if (w.verdict !== 'closed') { unchecked++; continue; }
    closed++;

    const entry = row(w);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(entry);

    /* A picture with no day-precise death has no place on a calendar, and
       is not given one. It is reachable by release year like everything
       else. */
    if (w.wrapped) {
      const md = w.wrapped.slice(5);
      if (!byDay.has(md)) byDay.set(md, []);
      byDay.get(md).push(entry);
    }

    const n = Number(w.id.slice(1));
    if (Number.isFinite(n)) ids.push(n);
  }
}

ids.sort((a, b) => a - b);

/* Newest closing first, everywhere. A picture that closed without a date
   sorts by the year it closed in, and one that closed without even a year
   sorts last — it has no position, and pretending otherwise would put it
   somewhere a reader would read as a claim. */
const newestFirst = (a, b) =>
  (b.wrapped || b.wrappedYear || '0000').localeCompare(a.wrapped || a.wrappedYear || '0000')
  || a.title.localeCompare(b.title);

for (const list of byYear.values()) list.sort(newestFirst);
for (const list of byDay.values()) list.sort(newestFirst);

/* --- version ----------------------------------------------------------- */

/* Content, not clock. Same corpus, same version, same URLs — so a rebuild
   that changes nothing republishes nothing and invalidates nothing. */
const digest = createHash('sha256');
for (const year of [...byYear.keys()].sort((a, b) => a - b)) {
  digest.update(String(year));
  for (const e of byYear.get(year)) digest.update(`${e.id}:${e.wrapped ?? e.wrappedYear ?? ''}`);
}
const version = digest.digest('hex').slice(0, 12);

/* --- write ------------------------------------------------------------- */

const base = join(OUT, 'v', version);
await rm(OUT, { recursive: true, force: true });
await mkdir(join(base, 'year'), { recursive: true });
await mkdir(join(base, 'day'), { recursive: true });

const written = { year: 0, day: 0, bytes: 0 };
const put = async (path, body) => {
  await writeFile(path, body);
  written.bytes += body.length;
};

for (const [year, list] of byYear) {
  await put(join(base, 'year', `${year}.json`), JSON.stringify(list));
  written.year++;
}

for (const [md, list] of byDay) {
  await put(join(base, 'day', `${md}.json`), JSON.stringify(list));
  written.day++;
}

/* Little-endian by contract, because every platform a browser runs on is,
   and a client that has to ask would need a byte-order probe to read four
   bytes. */
const table = new Uint32Array(ids);
await put(join(base, 'ids.bin'), Buffer.from(table.buffer, table.byteOffset, table.byteLength));

const decades = {};
for (const [year, list] of byYear) {
  const d = Math.floor(year / 10) * 10;
  decades[d] = (decades[d] || 0) + list.length;
}

const recent = [...byDay.values()].flat()
  .sort((a, b) => (b.wrapped || '').localeCompare(a.wrapped || ''))
  .slice(0, 5);

await put(join(base, 'summary.json'), JSON.stringify({
  closed, open, unchecked,
  years: [...byYear.keys()].sort((a, b) => a - b),
  decades,
  recent,
}));

/* The only mutable file, and the only one that may not be cached for long.
   Everything it points at can be kept for a year. */
await put(join(OUT, 'manifest.json'), JSON.stringify({
  version,
  base: `v/${version}`,
  built: new Date().toISOString(),
  counts: { closed, open, unchecked, years: byYear.size, days: byDay.size },
  surfaces: {
    year: 'year/{year}.json',
    day: 'day/{MM-DD}.json',
    ids: 'ids.bin',
    summary: 'summary.json',
  },
  /* Stated rather than assumed, so a client never has to guess how to
     read the binary table. */
  idsFormat: { type: 'uint32', endian: 'little', sorted: true, count: ids.length },
}, null, 2));

const kb = n => `${(n / 1024).toFixed(0)} KB`;
const dayBytes = [...byDay.values()].map(l => JSON.stringify(l).length).sort((a, b) => a - b);
const yearBytes = [...byYear.values()].map(l => JSON.stringify(l).length).sort((a, b) => a - b);

console.log(`\npublished ${closed} closings, version ${version}\n`);
console.log(`  ${written.year} year files   median ${kb(yearBytes[yearBytes.length >> 1])}, largest ${kb(yearBytes.at(-1))}`);
console.log(`  ${written.day} day files    median ${kb(dayBytes[dayBytes.length >> 1])}, largest ${kb(dayBytes.at(-1))}`);
console.log(`  ids.bin           ${kb(table.byteLength)} for ${ids.length} pictures`);
console.log(`  total             ${(written.bytes / 1048576).toFixed(1)} MB in ${OUT}/\n`);
