/* corpus.js — reading a published corpus from a browser
   ==========================================================================

   The other half of poster/build-corpus.js. Small on purpose: the whole point
   of publishing static, versioned, self-addressing files is that the
   client needs almost no logic to read them.

     import { openCorpus } from './corpus.js';

     const corpus = await openCorpus('/');
     await corpus.has('Q18153746');    // is this picture closed?
     await corpus.closed(1974);        // everything that closed in 1974
     await corpus.year(1924);          // everything RELEASED in 1924
     await corpus.day('10-05');        // every closing on 5 October, ever
     corpus.summary;                   // totals, decades, recent

   `closed` and `year` are two different axes and confusing them is the
   first mistake FINDINGS.md warns about. The Vault browses `closed`.

   WHAT IT DOES AND DOES NOT DO

   It fetches the manifest once, resolves keys to versioned URLs, and
   remembers what it has already fetched. That is all. There is no cache
   policy here because there is nothing to decide: everything under a
   version is immutable, so the browser's own cache is correct forever and
   a change of corpus changes the URLs.

   It does not know anything about pictures, people or wraps. Given a
   different builder writing the same manifest shape, this file works
   unchanged — which is the point of keeping it separate.
   ========================================================================== */

/* Reads the sorted table of Wikidata numbers written by publish.js.

   A person page asks "is this picture closed?" once per credit, up to
   sixty times on a long filmography. Sixty requests is out of the
   question and a megabyte of quoted strings is worse, so membership
   travels as 32-bit little-endian integers, sorted, and is answered here
   by binary search over a typed array — no parsing, no allocation, and
   about a quarter of the bytes JSON would need.

   The manifest states the format rather than leaving it to be assumed. If
   it ever says something this cannot read, that is a corpus this client
   does not understand, and saying so is better than guessing. */
function membership(buffer, format) {
  if (format?.type !== 'uint32' || format?.endian !== 'little' || !format?.sorted) {
    throw new Error('corpus.js: unrecognised ids.bin format');
  }

  const table = new Uint32Array(buffer);

  return function contains(n) {
    let low = 0;
    let high = table.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const at = table[mid];
      if (at === n) return true;
      if (at < n) low = mid + 1; else high = mid - 1;
    }
    return false;
  };
}

/* The packed table of closings, read through a DataView.

   Nothing is decoded up front: a hundred thousand objects would cost more
   memory and more time than the fetch did, and most questions touch a few
   columns. Rows are read on demand and the caller filters. */
function factsTable(buffer, dict, format) {
  const view = new DataView(buffer);
  const { rowBytes, rows } = format;
  const genreBit = new Map(dict.genres.map((g, i) => [g, i]));

  const at = i => {
    const o = i * rowBytes;
    const flags = view.getUint8(o + 8);
    const coverage = view.getUint8(o + 10);
    const type = view.getUint8(o + 11);
    const closer = view.getUint32(o + 12, true);
    const country = view.getUint8(o + 24);
    return {
      qid: `Q${view.getUint32(o, true)}`,
      releaseYear: view.getUint16(o + 4, true),
      wrapYear: view.getUint16(o + 6, true) || null,
      basis: dict.basis[flags & 0b11],
      onScreen: (flags & 0b100) ? Boolean(flags & 0b1000) : null,
      /* Whether TMDB was asked. Both bits are read rather than one
         inferred from the other, so a row from a corpus built before
         either was written — where both are zero — comes back
         `unverified: false, tested: false` and is visibly neither, rather
         than silently claiming to have been tested. */
      unverified: Boolean(flags & 0b10000),
      tested: Boolean(flags & 0b100000),
      makers: view.getUint8(o + 9),
      coverage: coverage === 255 ? null : coverage / 100,
      type: type === 255 ? null : dict.types[type],
      closer: closer === 0xFFFFFFFF ? null : closer,
      closerName: closer === 0xFFFFFFFF ? null : dict.closers[closer],
      country: country === 255 ? null : dict.countries[country],
    };
  };

  const hasGenre = (i, name) => {
    const bit = genreBit.get(name);
    if (bit === undefined) return false;
    const o = i * rowBytes + (bit < 32 ? 16 : 20);
    return Boolean(view.getUint32(o, true) & (1 << (bit % 32)));
  };

  return {
    rows,
    genres: dict.genres,
    types: dict.types,
    countries: dict.countries,
    row: at,
    hasGenre,

    /* Every row matching a predicate, as objects. */
    where(fn) {
      const out = [];
      for (let i = 0; i < rows; i++) {
        const r = at(i);
        if (fn(r, i)) out.push(r);
      }
      return out;
    },

    /* Pictures AND the deaths behind them. Never one without the other. */
    count(fn) {
      let pictures = 0;
      const deaths = new Set();
      for (let i = 0; i < rows; i++) {
        const r = at(i);
        if (!fn(r, i)) continue;
        pictures++;
        if (r.closer !== null) deaths.add(r.closer);
      }
      return { pictures, deaths: deaths.size };
    },
  };
}

export async function openCorpus(root = '/') {
  const at = path => new URL(path, new URL(root, location.href)).href;

  /* The one mutable object, and so the one fetch that must not be served
     from a stale cache. Everything it points at is immutable. */
  const manifest = await fetch(at('manifest.json'), { cache: 'no-cache' })
    .then(res => { if (!res.ok) throw new Error(`manifest ${res.status}`); return res.json(); });

  const from = path => at(`${manifest.base}/${path}`);
  const cache = new Map();

  const json = path => {
    if (!cache.has(path)) {
      cache.set(path, fetch(from(path))
        .then(res => (res.ok ? res.json() : []))
        .catch(() => []));
    }
    return cache.get(path);
  };

  let ids = null;
  const membershipTable = () => {
    ids ??= fetch(from(manifest.surfaces.ids))
      .then(res => res.arrayBuffer())
      .then(buffer => membership(buffer, manifest.idsFormat))
      /* A failed membership table must not turn every picture into a
         closed one, so the fallback answers no to everything. Missing a
         closing understates the archive; inventing one is a false claim
         about the living. */
      .catch(() => () => false);
    return ids;
  };

  const summary = await json(manifest.surfaces.summary.replace('{}', ''));

  return {
    version: manifest.version,
    built: manifest.built,
    counts: manifest.counts,
    summary,

    /* `qid` as it appears everywhere else — "Q18153746" — because making
       every caller strip the Q is how one of them forgets. */
    async has(qid) {
      const n = Number(String(qid).replace(/^Q/i, ''));
      if (!Number.isFinite(n)) return false;
      return (await membershipTable())(n);
    },

    year: year => json(manifest.surfaces.year.replace('{year}', String(year))),
    day: md => json(manifest.surfaces.day.replace('{MM-DD}', md)),

    /* The residues: pictures placed at a coarser resolution than a day,
       because that is all their source recorded. They are asked for
       separately so that nothing which draws a date can accidentally draw
       an approximation, and `resolution` says how many of each exist so a
       view can state what it is not showing. */
    month: ym => json(manifest.surfaces.month.replace('{YYYY-MM}', ym)),
    closed: y => json(manifest.surfaces.closed.replace('{YYYY}', String(y))),
    resolution: manifest.resolution,

    /* Pictures nobody could date: no death on record for anyone credited,
       and not old enough for arithmetic to settle it. Keyed by RELEASE
       year, which is the only date they have — every other surface here
       is keyed by a closing, and these have none. */
    unclassified: y => (manifest.surfaces.unclassified
      ? json(manifest.surfaces.unclassified.replace('{YYYY}', String(y)))
      : Promise.resolve([])),

    /* What has been retracted, and when.

       Fetched whole and once. It is small by construction — a corpus that
       retracts often is one nobody should be citing — and a reader
       checking whether a claim still stands is asking about a specific
       picture, which means the answer has to be a lookup rather than a
       shard they must guess at.

       Cached as the promise, not the result, so ten pictures asking at
       once is one request. Missing from an older corpus is an empty list
       and not an error: a corpus built before the record existed has
       nothing to say about retractions, which is different from saying
       there were none — but no reader can be shown what was never kept. */
    async removed() {
      if (!manifest.surfaces.removed) return [];
      return json(manifest.surfaces.removed);
    },

    /* Every closing at once, packed, for questions the shards cannot
       answer — anything that crosses two columns. One fetch of about
       2.5 MB, then filtering happens in memory.

       `count()` is deliberately the only aggregate offered, and it
       deliberately returns two numbers. Pictures are not independent
       observations: one death closes up to 812 of them, so a count of
       pictures overstates the evidence behind it by up to sevenfold. Any
       figure taken from this table should be reported as "n pictures,
       from m deaths", and making that the easiest thing to do is the
       point of not offering a bare total. */
    async facts() {
      const [buffer, dict] = await Promise.all([
        fetch(from(manifest.surfaces.facts)).then(r => r.arrayBuffer()),
        json(manifest.surfaces.factsDictionary),
      ]);
      return factsTable(buffer, dict, manifest.factsFormat);
    },
  };
}
