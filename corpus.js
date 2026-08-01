/* corpus.js — reading a published corpus from a browser
   ==========================================================================

   The other half of poster/publish.js. Small on purpose: the whole point
   of publishing static, versioned, self-addressing files is that the
   client needs almost no logic to read them.

     import { openCorpus } from './corpus.js';

     const corpus = await openCorpus('/');
     await corpus.has('Q18153746');    // is this picture closed?
     await corpus.year(1924);          // that year's closings, newest first
     await corpus.day('10-05');        // every closing on 5 October, ever
     corpus.summary;                   // totals, decades, recent

   WHAT IT DOES AND DOES NOT DO

   It fetches the manifest once, resolves keys to versioned URLs, and
   remembers what it has already fetched. That is all. There is no cache
   policy here because there is nothing to decide: everything under a
   version is immutable, so the browser's own cache is correct forever and
   a change of corpus changes the URLs.

   It does not know anything about pictures, people or wraps. Given a
   different publish.js writing the same manifest shape, this file works
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
  const table = () => {
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
      return (await table())(n);
    },

    year: year => json(manifest.surfaces.year.replace('{year}', String(year))),
    day: md => json(manifest.surfaces.day.replace('{MM-DD}', md)),
  };
}
