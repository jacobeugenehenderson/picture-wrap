/* ==========================================================================
   PICTURE WRAP — poster/build-corpus.js

   Turns the corpus into static files a browser can serve itself from.

     node build-corpus.js                 from pass/, into dist/
     node build-corpus.js --in pass --out dist

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

     closed/<YYYY>.json  every closing of one calendar year — the Vault
     year/<year>.json    the closings of one RELEASE year
     day/<MM-DD>.json    every closing that ever happened on one date
     month/<YYYY-MM>.json  closings known only to a month
     ids.bin             which pictures are closed at all
     summary.json        totals, enough to draw a landing page
     facts.bin           every closing as one packed row, for crossing
     facts.json          the dictionaries those rows index into

   TWO YEAR AXES, AND THEY ARE NOT THE SAME AXIS

   `closed/` is by the year a picture closed and `year/` is by the year it
   was released. The Vault browses the first — it has always been "newest
   closing first" — and questions about cinema ask the second. Holding
   both is the whole reason any comparison in FINDINGS.md is honest, since
   plotting one while meaning the other is the first rule in that file.

   A closing decade is too large to hand over whole: the 2010s hold 16,015
   closings, about 6 MB. As year shards the same decade is 600 KB a file
   and the busiest year in the corpus — 2022, with 1,980 — is 773 KB. So a
   drawer opens onto years and a year opens onto pictures.

   THE RESIDUES, WHICH ARE NOT AN AFTERTHOUGHT

   A closing is placed at the resolution its source actually recorded:
   88.2% to the day, 0.5% to a month, 4.1% to a year, and 7.3% nowhere at
   all. Only the first can appear on a calendar day, and the older habit —
   putting the rest nowhere — threw away a real fact to avoid stating an
   imprecise one.

   So a month of the calendar can carry, underneath the dated closings, a
   note that these other pictures wrapped somewhere in it; and a year can
   carry the ones known only to that year. The residues are separate files
   rather than mixed in, so nothing that draws a date can accidentally
   draw an approximation.

   ids.bin is a sorted array of 32-bit Wikidata numbers, not JSON. A person
   page asks "is this film closed?" once per credit, up to sixty times, so
   it cannot fetch per lookup and cannot afford a megabyte of quoted
   strings. Binary and sorted, it is a quarter of the size and answers by
   binary search with no parsing at all.

   THE FACTS TABLE, AND WHY IT IS ONE FILE

   The surfaces above each answer one question. Nothing built from them can
   answer a crossed one — "documentaries with fewer than five makers whose
   last survivor was behind the camera" needs every row at once, and every
   result this archive has produced that was worth anything came from
   crossing two columns rather than reading one.

   So the whole corpus also ships as a single packed table: 24 bytes a
   picture, about 2.5 MB for a hundred thousand of them, one fetch, filter
   in memory. That is the price of a photograph for arbitrary cross-tabs
   with no query engine and no server.

   Two columns exist purely to keep whoever uses it honest.

   `closer` is the index of the person whose death closed the picture.
   Pictures are not independent observations — one death closes up to 812
   of them — so any count over this table has to report distinct closers
   beside distinct pictures or it will overstate its evidence by up to
   sevenfold. See METHOD §3.

   `makers` is how many people the record held. Nearly every apparent
   trend in this archive is that number changing over time rather than
   anything about cinema, and a cross-tab that does not carry it will
   rediscover the same artefact in a new costume.

   DEPLOYING IT

   Everything under v/<version>/ is immutable, so a deploy is a copy and
   never a replacement. Only manifest.json is overwritten, and it is
   written last — until it points at a version, that version is invisible,
   which makes a half-finished upload harmless.

     rclone copy dist/v r2:picture-wrap/v        # the immutable tree
     rclone copy dist/manifest.json r2:picture-wrap/   # last, and only then

   Old versions can be deleted whenever nothing references them; nothing
   in the client resolves a version it was not told about.

   NOT TO BE CONFUSED WITH THE publish.js THE BACKLOG WANTS

   This was called publish.js for an afternoon, which collided with a name
   already spoken for: the backlog's Desk entry reserves poster/publish.js
   for the single publish-and-file path that review.js and the desk would
   share. That one sends posts. This one builds files. Naming them the
   same thing would have put "publish" on the two most different verbs in
   the project.

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
  wrappedMonth: w.wrappedMonth,
  wrappedYear: w.wrappedYear,
  dateBasis: w.dateBasis,
  /* `onScreen` travels with the closer so a reader can ask for the
     pictures whose last maker was in front of the camera, or behind it.
     null where neither database said which. */
  last: w.last
    ? {
        name: w.last.name, died: w.last.died,
        onScreen: w.last.onScreen ?? null,
        /* So a closing can link to the person, and so two pictures closed
           by the same death group together without matching on a name. */
        id: w.last.wikidataId ?? null,
      }
    : null,
  countries: w.countries?.length ? w.countries : undefined,
  type: w.type,
  genres: w.genres?.length ? w.genres : undefined,
  makers: w.makerCount,
  coverage: w.coverage ?? undefined,
  unknown: w.unknownCount ?? undefined,
});

const byYear = new Map();
const byClosingYear = new Map();
const byDay = new Map();
const byMonth = new Map();
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

    /* The Vault's own axis. A closing with no year at all — nobody's
       death was recorded, so the picture is closed by arithmetic — has no
       place on it, and is reachable by release year like everything
       else. */
    if (w.wrappedYear) {
      if (!byClosingYear.has(w.wrappedYear)) byClosingYear.set(w.wrappedYear, []);
      byClosingYear.get(w.wrappedYear).push(entry);
    }

    /* The calendar's own axes. A day file spans every year, which is what
       makes "on this day" possible, so it cannot be derived from a
       closing year. The month file is the residue for a given month —
       pictures known to have closed in it but not on any day of it.

       Anything known only to a year needs no file of its own: it is in
       `closed/<YYYY>.json` already, carrying its dateBasis, and a view
       wanting the residue filters for it there. */
    if (w.dateBasis === 'day') {
      const md = w.wrapped.slice(5);
      if (!byDay.has(md)) byDay.set(md, []);
      byDay.get(md).push(entry);
    } else if (w.dateBasis === 'month') {
      if (!byMonth.has(w.wrappedMonth)) byMonth.set(w.wrappedMonth, []);
      byMonth.get(w.wrappedMonth).push(entry);
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

for (const list of [...byYear.values(), ...byClosingYear.values(),
                    ...byDay.values(), ...byMonth.values()]) list.sort(newestFirst);

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
await mkdir(join(base, 'month'), { recursive: true });
await mkdir(join(base, 'closed'), { recursive: true });

const written = { year: 0, closed: 0, day: 0, month: 0, bytes: 0 };
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

for (const [ym, list] of byMonth) {
  await put(join(base, 'month', `${ym}.json`), JSON.stringify(list));
  written.month++;
}

for (const [y, list] of byClosingYear) {
  await put(join(base, 'closed', `${y}.json`), JSON.stringify(list));
  written.closed++;
}

/* Little-endian by contract, because every platform a browser runs on is,
   and a client that has to ask would need a byte-order probe to read four
   bytes. */
const table = new Uint32Array(ids);
await put(join(base, 'ids.bin'), Buffer.from(table.buffer, table.byteOffset, table.byteLength));

/* --- the packed table -------------------------------------------------- */

/* Fixed 24-byte rows, little-endian, described in the manifest so a reader
   never has to infer the layout:

     0   uint32  Wikidata number
     4   uint16  release year
     6   uint16  wrap year, 0 when the closing cannot be placed
     8   uint8   flags — bits 0-1 date basis, 2 on-screen known,
                  3 on-screen, 4 unverified, 5 tested against TMDB
     9   uint8   makers on record, capped at 255
     10  uint8   coverage percent, 255 when not measurable
     11  uint8   type, 255 when absent
     12  uint32  closer, 0xFFFFFFFF when nobody is named
     16  uint32  genre bits 0-31
     20  uint32  genre bits 32-63
     24  uint8   country, 255 when absent

   Two 32-bit halves rather than one 64-bit field, so a browser reading
   this never needs BigInt for what is a set of checkboxes. */
const ROW = 25;
const BASIS = { none: 0, year: 1, month: 2, day: 3 };

const everyClosing = [...byYear.values()].flat();

const dictionary = (values, limit = Infinity) => {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([v]) => v);
};

const types = dictionary(everyClosing.map(e => e.type).filter(Boolean));
/* 64 because that is what fits the bitset, and they cover 97% of all
   genre tags in the corpus; the long tail of 372 rarer labels is in the
   per-picture files where nothing has to be packed. */
const genreList = dictionary(everyClosing.flatMap(e => e.genres || []), 64);
const genreBit = new Map(genreList.map((g, i) => [g, i]));

/* One byte, so one country, and a co-production has to choose. The first
   named is kept and the per-picture files carry the complete list — the
   packed table is for crossing, and a reader who needs to know that a
   picture is Franco-Italian rather than French is asking about that
   picture rather than about a trend. 254 countries fit; the archive has
   far fewer. */
const countryList = dictionary(everyClosing.flatMap(e => e.countries || []), 254);
const countryIndex = new Map(countryList.map((c, i) => [c, i]));

/* Named rather than numbered, because a quarter of closers have no
   Wikidata id in the record and would otherwise collapse into one
   another — which is exactly the count this column exists to protect. */
const closerKey = e => (e.last ? (e.last.wikidataId || `name:${e.last.name}`) : null);
const closers = dictionary(everyClosing.map(closerKey).filter(Boolean));
const closerIndex = new Map(closers.map((c, i) => [c, i]));
const closerNames = new Map();
for (const e of everyClosing) if (e.last) closerNames.set(closerKey(e), e.last.name);

const facts = Buffer.alloc(everyClosing.length * ROW);
everyClosing.forEach((e, i) => {
  const at = i * ROW;
  facts.writeUInt32LE(Number(String(e.id).slice(1)) || 0, at);
  facts.writeUInt16LE(Number(e.year) || 0, at + 4);
  facts.writeUInt16LE(Number(e.wrappedYear) || 0, at + 6);

  let flags = BASIS[e.dateBasis] ?? 0;
  if (e.last && e.last.onScreen !== null && e.last.onScreen !== undefined) {
    flags |= 1 << 2;
    if (e.last.onScreen) flags |= 1 << 3;
  }
  facts.writeUInt8(flags, at + 8);
  facts.writeUInt8(Math.min(255, e.makers ?? 0), at + 9);
  facts.writeUInt8(e.coverage == null ? 255 : Math.min(255, Math.round(e.coverage * 100)), at + 10);
  facts.writeUInt8(types.indexOf(e.type) === -1 ? 255 : types.indexOf(e.type), at + 11);

  const ci = closerKey(e) === null ? 0xFFFFFFFF : closerIndex.get(closerKey(e));
  facts.writeUInt32LE(ci ?? 0xFFFFFFFF, at + 12);

  let lo = 0, hi = 0;
  for (const g of e.genres || []) {
    const bit = genreBit.get(g);
    if (bit === undefined) continue;
    if (bit < 32) lo |= 1 << bit; else hi |= 1 << (bit - 32);
  }
  facts.writeUInt32LE(lo >>> 0, at + 16);
  facts.writeUInt32LE(hi >>> 0, at + 20);

  const country = countryIndex.get((e.countries || [])[0]);
  facts.writeUInt8(country === undefined ? 255 : country, at + 24);
});

await put(join(base, 'facts.bin'), facts);
await put(join(base, 'facts.json'), JSON.stringify({
  rows: everyClosing.length,
  rowBytes: ROW,
  basis: Object.keys(BASIS),
  types,
  genres: genreList,
  countries: countryList,
  closers: closers.map(c => closerNames.get(c) ?? c),
}));

/* Release decades, and closing decades broken down by year — the second
   is what a drawer needs in order to open onto anything. */
const decades = {};
for (const [year, list] of byYear) {
  const d = Math.floor(year / 10) * 10;
  decades[d] = (decades[d] || 0) + list.length;
}

const closingDecades = {};
for (const [y, list] of byClosingYear) {
  const d = Math.floor(Number(y) / 10) * 10;
  closingDecades[d] ??= { total: 0, years: {} };
  closingDecades[d].total += list.length;
  closingDecades[d].years[y] = list.length;
}

const recent = [...byDay.values()].flat()
  .sort((a, b) => (b.wrapped || '').localeCompare(a.wrapped || ''))
  .slice(0, 5);

/* Counts over the whole corpus, not a filtered view, so a filter row does
   not rearrange itself as somebody clicks through it. */
const countryCounts = {};
for (const e of everyClosing) {
  for (const c of e.countries || []) countryCounts[c] = (countryCounts[c] || 0) + 1;
}
const countries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);

await put(join(base, 'summary.json'), JSON.stringify({
  closed, open, unchecked,
  countries,
  years: [...byYear.keys()].sort((a, b) => a - b),
  decades,
  closingDecades,
  /* Closings with no year at all: real, closed, and off every timeline. */
  unplaceable: closed - [...byClosingYear.values()].reduce((n, l) => n + l.length, 0),
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
    month: 'month/{YYYY-MM}.json',
    closed: 'closed/{YYYY}.json',
    ids: 'ids.bin',
    summary: 'summary.json',
    facts: 'facts.bin',
    factsDictionary: 'facts.json',
  },
  /* The layout, stated rather than left to be inferred. */
  factsFormat: {
    rows: everyClosing.length,
    rowBytes: ROW,
    endian: 'little',
    fields: {
      qid: { at: 0, type: 'uint32' },
      releaseYear: { at: 4, type: 'uint16' },
      wrapYear: { at: 6, type: 'uint16', zeroMeans: 'unplaceable' },
      flags: { at: 8, type: 'uint8', bits: ['basis0', 'basis1', 'onScreenKnown', 'onScreen', 'unverified', 'tested'] },
      makers: { at: 9, type: 'uint8' },
      coverage: { at: 10, type: 'uint8', unit: 'percent', sentinel: 255 },
      type: { at: 11, type: 'uint8', sentinel: 255 },
      closer: { at: 12, type: 'uint32', sentinel: 4294967295 },
      genresLo: { at: 16, type: 'uint32' },
      genresHi: { at: 20, type: 'uint32' },
      country: { at: 24, type: 'uint8', sentinel: 255, note: 'first named; full list is in the per-picture files' },
    },
  },
  /* Published so a client can say what it is showing and what it is not.
     A calendar that silently omits 11.9% of the archive is worse than one
     that says which part it cannot place. */
  resolution: everyClosing.reduce((tally, e) => {
    tally[e.dateBasis ?? 'none'] = (tally[e.dateBasis ?? 'none'] || 0) + 1;
    return tally;
  }, { day: 0, month: 0, year: 0, none: 0 }),
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
console.log(`  ${written.closed} closing years — the Vault's own axis`);
console.log(`  ${written.month} month files  known only to a month`);
console.log(`  ids.bin           ${kb(table.byteLength)} for ${ids.length} pictures`);
console.log(`  facts.bin         ${kb(facts.length)} — ${everyClosing.length} rows of ${ROW} bytes`);
console.log(`  facts.json        ${types.length} types, ${genreList.length} genres, ${countryList.length} countries, ${closers.length} closers`);
console.log(`  total             ${(written.bytes / 1048576).toFixed(1)} MB in ${OUT}/\n`);
