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
  fame: w.fame || undefined,
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
  /* Two databases, one date, and they do not agree. The date published
     is unchanged — nothing here adjudicates — but a reader is told, the
     same way an undated closing and an unnamed maker are already told.
     See provenance.js. */
  disputed: w.disputed || undefined,
  /* Whether TMDB was ever asked about this picture, which is the single
     biggest thing a reader could not previously tell about a closing.
     45.6% of them rest on Wikidata's own view of itself — usually because
     the picture carries no TMDB id, and there is nothing to ask.

     Derived from `tested` rather than copied from the stored `unverified`
     flag. The flag postdates most of the archive and undercounts, which
     FORTIFYING.md has said since 28 July: it records what we noticed, not
     what is unverifiable. `tested` records what was done.

     Present only when true, like `disputed`, so the common case costs
     nothing on the wire. */
  unverified: w.tested ? undefined : true,
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
let closed = 0, duplicated = 0;

/* Distinct pictures, by what became of them. A picture that closes under
   any release year is closed, whatever another year said before the
   evidence was complete — so these are resolved against `filed` once the
   years are all read, never as they go. */
const running = new Set();
const unchecked = new Set();

/* Every picture already filed, so a later release year cannot file it
   again. Ids, not titles — two different pictures share a title all the
   time, and one of them is usually a remake of the other. */
const filed = new Set();

for (const year of years) {
  let works;
  try { works = await lines(join(IN, String(year), 'works.jsonl')); } catch { continue; }

  for (const w of works) {
    /* Counted into sets, not incremented, for the same reason the
       closings are filed into one: a picture judged under two release
       years is one picture. Incrementing published a total that did not
       add up — 120,567 + 229,628 + 1,386 against 329,957 actually
       judged — and the count of what is still running is the second
       number this project quotes. */
    if (w.verdict === 'open') { running.add(w.id); continue; }
    if (w.verdict !== 'closed') { unchecked.add(w.id); continue; }

    /* One picture, one closing, however many times it was released.

       The pass is a batch job over a release year, and Wikidata gives a
       picture a release date per territory: Casablanca has four — the New
       York premiere in 1942, the American general release in 1943, Sweden
       in 1943, France in 1947. So the same item is judged under each year
       it touches, reaches the same verdict from the same credits, and is
       filed as many times as it was released. 1,557 pictures were doubled
       that way, Attack (1956, and again 1957) among them.

       A comment on `bestOfEach` below has said for weeks that Casablanca
       is in Wikidata twice as two items and that merging them is a claim
       about identity belonging upstream. That is not what this is. It is
       one item, Q132689, and we filed it twice — ours to fix, and no
       claim about anything.

       The earliest release wins because it is the one the picture is
       named by: Wikidata's own description of Q132689 is "1942 film". So
       this is not only a de-duplication, it puts Casablanca in 1942.

       Before the indexes rather than after, so the year lists, the Vault's
       closing axis, the day and month files, ids.bin, facts.bin and every
       count are all reading the same set. A dedupe applied to one of them
       would leave the others disagreeing, which is the failure this whole
       file is arranged to avoid. */
    if (filed.has(w.id)) { duplicated++; continue; }
    filed.add(w.id);

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
   that changes nothing republishes nothing and invalidates nothing.

   FORMAT is the other half of "content", and it was missing. The digest
   below reads the closings; it cannot see the shape they are written in.
   Add a field to summary.json and every closing hashes identically, the
   version does not move, and a reader holding last year's copy of an
   immutable URL never sees the new field — the landing page silently
   keeps the old one for a year.

   So: bump FORMAT whenever the layout of anything written here changes —
   a new key, a renamed surface, a different packing. Not when a comment
   or a threshold changes; those alter the closings, and the closings are
   already hashed. Same discipline as the ?v= on index.html, and the same
   failure if it is forgotten.

     1  the shape as first published
     2  summary.json gains `doors`
     3  the doors cross, and carry `picks`
     4  every crossing ranked three ways, over one film table
     5  a closing can carry `disputed`
     6  a closing can carry `unverified`, and flag bits 4-5 are written
     7  `open` and `unchecked` count pictures rather than rows, and the
        manifest carries `pictures` as their total
*/
const FORMAT = 7;

const digest = createHash('sha256');
digest.update(`format:${FORMAT}\n`);
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
/* Resolved now the years are all read. Closed beats running beats never
   checked, so nothing is counted under two headings. */
for (const id of filed) { running.delete(id); unchecked.delete(id); }
for (const id of running) unchecked.delete(id);
const stillRunning = running.size;
const neverChecked = unchecked.size;

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
  /* Bits 4 and 5 have been in the manifest's field list since this file
     was written and were never once set — the layout documented two
     columns that were always zero, and `corpus.js` did not decode them,
     so nothing noticed. A described field that is never written is worse
     than an absent one: it reads as measured and says nothing.

     They are complementary rather than redundant. `unverified` is the
     claim a reader cares about; `tested` is its positive form, and
     keeping both means a future third state — asked, and TMDB had no
     credits — has somewhere to go without moving anybody's bits. */
  if (e.unverified) flags |= 1 << 4; else flags |= 1 << 5;
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

/* The other way in.

   "Recently wrapped" is the feed and it is the right front door, but it
   answers a question nobody asked on their first visit: it shows five
   pictures they have never heard of, because most closings are obscure by
   the arithmetic of the thing — the famous ones close last.

   So the landing offers the same archive sorted by how widely a picture
   is known, which is the only sort that guarantees a reader recognises
   something. Sitelinks are the proxy, and they are a proxy: they measure
   how much has been written, which is not the same as importance and
   leans European, English-language and old. */
/* One picture per title.

   This comment used to say that Wikidata holds Casablanca twice, as two
   items dated 1942 and 1943, and that merging them was a claim about
   identity belonging upstream. That was wrong, and wrong in the direction
   that let it stand: it read the symptom as somebody else's problem.

   There is one Casablanca, Q132689, with four release dates. We filed it
   once per release year, and both copies carried 107 sitelinks because
   they were the same item. Attack, 1956 and 1957, is the same story.
   That is fixed where the closings are gathered, by id, so the whole
   corpus counts each picture once.

   What is left for this function is the genuine case: two DIFFERENT items
   that happen to share a title — a remake, a re-registration, an actual
   duplicate item somebody should merge on Wikidata. A door showing five
   picks reads as broken if two of them say "Attack", whatever the reason.
   So the title match stays, and it stays cosmetic and local to the picks:
   the pictures are still in the corpus, still counted and still findable,
   because deciding that two items are one work IS a claim about identity
   and does belong upstream. */
const bestOfEach = list => {
  const seen = new Set();
  return list.filter(e => {
    const key = e.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const bestKnown = bestOfEach(everyClosing
  .filter(e => e.fame)
  .sort((a, b) => b.fame - a.fame)).slice(0, 12);

/* The third way in, and the one that tells the story fastest: pictures
   that took longest to run out of people. A Manly Man waited 103 years,
   and the reason is a child on set who lived to 104 — which is the whole
   mechanism of this archive in one row. */
const longestWait = bestOfEach(everyClosing
  .filter(e => e.wrapped && e.year)
  .map(e => ({ ...e, wait: Number(e.wrapped.slice(0, 4)) - Number(e.year) }))
  .filter(e => e.wait > 0)
  .sort((a, b) => b.wait - a.wait)).slice(0, 12);

/* The doors.

   A reader who likes pictures does not arrive wanting "the archive". They
   arrive as somebody who likes Russian horror, or Danish documentaries,
   or Westerns, and the fastest way to make an archive of 120,567 closings
   legible is to let them say so in one click.

   Ten genres and ten regions, and **they cross**. "Russian horror" and
   "Danish documentaries" are two words each because that is how anybody
   says them; a picker that made you choose one word would be asking the
   reader to hold the other in their head while they scrolled.

   So every combination is precomputed: ten genres, ten regions, and the
   crossings between them that have anything in them. That is at most 120
   lists of five, about 55 KB, and it is the difference between a toy and
   a thing somebody uses. Crossings with nothing in them are not written,
   which is also what lets the page dim a door that leads nowhere rather
   than letting it be clicked into an empty room.

   Sorted by fame for the same reason the "Best known" list exists: a
   door that opens onto five titles nobody recognises is a door nobody
   opens twice. Not filtered by it, though — a thin crossing is exactly
   where every picture is obscure, and showing five obscure Danish
   Westerns beats showing none.

   Computed here, once, rather than in the browser: the facts table can
   answer this — it carries genre and country per row — but it is 3 MB
   and carries neither titles nor fame, so the landing page would fetch
   the whole corpus to draw ten buttons. */
const slim = e => ({
  id: e.id, title: e.title, year: e.year,
  wrapped: e.wrapped || undefined,
  wrappedYear: e.wrappedYear || undefined,
});

const topLabels = (labelsOf, howMany) => {
  const counts = new Map();
  for (const e of everyClosing) {
    for (const label of new Set(labelsOf(e))) counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, howMany);
};

/* How far down each list the doors go, and the answer is "past the point
   where a reader stops recognising them, not before".

   Ten of each was the first guess and it was wrong in a way the counts
   make obvious: the ten largest genres are silent, drama, documentary,
   comedy, crime, Western, musical, romance, adventure and war, and that
   list has no horror in it. Horror is sixteenth with 934 closings,
   thriller twentieth with 645, film noir 556, science fiction 543 —
   every genre somebody would actually name sits just below the cut,
   because size and recognisability are not the same axis. Twenty-three
   reaches all of them.

   `fiction film` is dropped, being a mode rather than a genre and true of
   most of the archive — the same objection rule 24 makes to a genre that
   only repeats the work's type.

   Fourteen regions rather than twenty-eight, which is where the same
   threshold would land. Doubling them takes summary.json from 175 KB to
   285 KB for labels nobody reaches for.

   Note while reading these counts that `Soviet` (2,515) and `Russian`
   (381) are different labels rather than two spellings of one, because
   the demonym belongs to whichever state still uses it. The same holds
   for British Raj and India. */
const doorGenres = topLabels(e => e.genres || [], 23).filter(([l]) => l !== 'fiction film');
const doorRegions = topLabels(e => e.countries || [], 14);

/* Bucketed once rather than filtered a hundred times: 124k closings
   against 120 combinations is 15 million comparisons the naive way, and
   two passes this way. */
const genreBuckets = new Map(doorGenres.map(([label]) => [label, []]));
const regionOf = new Map();
for (const e of everyClosing) {
  for (const g of new Set(e.genres || [])) genreBuckets.get(g)?.push(e);
  regionOf.set(e, new Set(e.countries || []));
}

/* Each combination is ranked three ways, because a sort and a door are
   different questions and answering only one of them made the landing
   page pretend otherwise. A door says *which* pictures; a sort says
   *which five of them*, and "the longest wait among French silents" is a
   better question than either half.

   The three are the same three the whole archive offers, so the row of
   sorts keeps meaning what it means when nothing is filtered. */
const ORDERS = {
  known: list => list.slice().sort((a, b) => (b.fame || 0) - (a.fame || 0)),
  recent: list => list.slice().sort((a, b) =>
    ((b.wrapped || b.wrappedMonth || b.wrappedYear || '') + '')
      .localeCompare((a.wrapped || a.wrappedMonth || a.wrappedYear || '') + '')),
  wait: list => list
    .filter(e => e.year && (e.wrapped || e.wrappedYear))
    .map(e => [e, Number(String(e.wrapped || e.wrappedYear).slice(0, 4)) - Number(e.year)])
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([e]) => e),
};

/* One table of films, and the lists are indices into it.

   Three orderings of 117 combinations is 1,755 slots, and they overlap
   heavily — Casablanca is the best-known American picture, the
   best-known drama, and the best-known American drama. Written out in
   full that is 150 KB of repeated titles; written once and pointed at,
   it is a third of that. Compact arrays rather than objects for the same
   reason: at this count the key names cost more than the values. */
const filmTable = [];
const filmIndex = new Map();
const intern = e => {
  if (!filmIndex.has(e.id)) {
    filmIndex.set(e.id, filmTable.length);
    const s = slim(e);
    filmTable.push([s.id, s.title, s.year ?? '', s.wrapped ?? s.wrappedYear ?? '']);
  }
  return filmIndex.get(e.id);
};

/* Keyed `<genre>||<region>`, either side empty for a single facet, so the
   page looks up one string whether the reader has chosen one door or two. */
const picks = {};
const record = (key, list) => {
  if (!list.length) return;
  const entry = { count: list.length };
  for (const [name, order] of Object.entries(ORDERS)) {
    entry[name] = bestOfEach(order(list)).slice(0, 5).map(intern);
  }
  picks[key] = entry;
};

for (const [label] of doorGenres) record(`${label}||`, genreBuckets.get(label));
for (const [label] of doorRegions) {
  record(`||${label}`, everyClosing.filter(e => regionOf.get(e).has(label)));
}
for (const [g] of doorGenres) {
  for (const [r] of doorRegions) {
    record(`${g}||${r}`, genreBuckets.get(g).filter(e => regionOf.get(e).has(r)));
  }
}

const doors = {
  genre: doorGenres.map(([label, count]) => ({ label, count })),
  region: doorRegions.map(([label, count]) => ({ label, count })),
  /* [id, title, releaseYear, wrapped] — wrapped is a date, a year, or ''. */
  films: filmTable,
  picks,
};

/* Counts over the whole corpus, not a filtered view, so a filter row does
   not rearrange itself as somebody clicks through it. */
const countryCounts = {};
for (const e of everyClosing) {
  for (const c of e.countries || []) countryCounts[c] = (countryCounts[c] || 0) + 1;
}
const countries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);

await put(join(base, 'summary.json'), JSON.stringify({
  closed, open: stillRunning, unchecked: neverChecked,
  countries,
  years: [...byYear.keys()].sort((a, b) => a - b),
  decades,
  closingDecades,
  bestKnown,
  longestWait,
  doors,
  /* Closings with no year at all: real, closed, and off every timeline. */
  unplaceable: closed - [...byClosingYear.values()].reduce((n, l) => n + l.length, 0),
  recent,
}));

/* The cache contract, written where the host can read it.

   Everything under v/<version>/ is immutable and may be kept for a year;
   manifest.json is the one file that changes and must not be. That has
   been true since this script was written and has lived only in a
   comment, which means every deploy has had to remember it by hand.

   Cloudflare Pages reads `_headers` from the root of the deployed
   directory, so the contract now ships with the files it governs.

   The CORS header is what lets picture-wrap.com fetch a corpus served
   from another origin at all. Star rather than a named origin because
   this is public, CC0-shaped, read-only data — and because a corpus that
   can only be read by one website is not much of an archive.

   The "immutable tree first, manifest last" ordering the header block
   above describes is for hosts that overwrite objects one at a time. A
   Pages deploy is atomic, so there is no half-finished state to be
   invisible — the requirement is met by the host rather than by the
   order. */
await put(join(OUT, '_headers'), `/*
  Access-Control-Allow-Origin: *

/v/*
  Cache-Control: public, max-age=31536000, immutable

/manifest.json
  Cache-Control: public, max-age=300, must-revalidate
`);

/* The only mutable file, and the only one that may not be cached for long.
   Everything it points at can be kept for a year. */
await put(join(OUT, 'manifest.json'), JSON.stringify({
  version,
  base: `v/${version}`,
  built: new Date().toISOString(),
  counts: { closed, open: stillRunning, unchecked: neverChecked,
            pictures: closed + stillRunning + neverChecked,
            years: byYear.size, days: byDay.size },
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

console.log(`\npublished ${closed} closings, version ${version}` +
  (duplicated ? `  (${duplicated} re-releases of a picture already filed)` : '') + '\n');
console.log(`  ${written.year} year files   median ${kb(yearBytes[yearBytes.length >> 1])}, largest ${kb(yearBytes.at(-1))}`);
console.log(`  ${written.day} day files    median ${kb(dayBytes[dayBytes.length >> 1])}, largest ${kb(dayBytes.at(-1))}`);
console.log(`  ${written.closed} closing years — the Vault's own axis`);
console.log(`  ${written.month} month files  known only to a month`);
console.log(`  ids.bin           ${kb(table.byteLength)} for ${ids.length} pictures`);
console.log(`  facts.bin         ${kb(facts.length)} — ${everyClosing.length} rows of ${ROW} bytes`);
console.log(`  facts.json        ${types.length} types, ${genreList.length} genres, ${countryList.length} countries, ${closers.length} closers`);
console.log(`  doors             ${doors.genre.length} genres x ${doors.region.length} regions, ${Object.keys(doors.picks).length} combinations, 3 orderings each, over ${filmTable.length} distinct films`);
console.log(`  total             ${(written.bytes / 1048576).toFixed(1)} MB in ${OUT}/\n`);
