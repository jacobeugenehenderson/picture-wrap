/* ==========================================================================
   PICTURE WRAP — poster/retest.js

   Re-examines pictures whose stored verdict predates a rule change.

     node retest.js --years 1890-2026        everything stale
     node retest.js --year 1924 --dry-run    what it would do

   WHY THIS EXISTS

   The pass short-circuits: the moment Wikidata shows a living person, it
   returns "open" without asking TMDB, because the TMDB test is four
   seconds a picture and this skips it for two in three. That is what
   makes a corpus of this size affordable.

   It is also a memo whose validity depends on the rule that produced the
   survivor. Tighten `alive` — a lower age ceiling, a stricter
   corroboration test, a new way to bury somebody — and those pictures do
   not become closed. They become UNTESTED, because the population was
   never gathered. On 2 August the born-after-release rule reached
   Wikidata's own credits and left 965 pictures in exactly that state,
   held open by people who could not have been on them.

   `rebuild.js` cannot fix these: re-deciding from stored evidence is
   sound only where the pass gathered the full evidence, and here it
   deliberately did not. This is the one repair that needs the network.

   It judges with judge.js — the same code the pass uses, not a second
   copy — and merges its results into the year rather than rewriting it.
   ========================================================================== */

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { join } from 'node:path';

import { sparql, qid, sleep } from './lib.js';
import { impossible } from '../verify.js';
import { creditsQuery, judge } from './judge.js';

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i === -1 ? fallback : args[i + 1];
};

const OUT = value('--out', process.env.PW_PASS || 'pass');
const ARCHIVE = value('--archive', process.env.PW_PASS_ARCHIVE || null);
const dryRun = args.includes('--dry-run');
const single = Number(value('--year', 0));
const range = value('--years', null);
const CONCURRENCY = Number(value('--concurrency', 5));

const years = single ? [single]
  : range ? (() => {
      const [from, to] = range.split('-').map(Number);
      return Array.from({ length: to - from + 1 }, (_, i) => from + i);
    })()
  : [];

if (!years.length) { console.error('Usage: node retest.js --years 1890-2026'); process.exit(1); }
if (!process.env.TMDB_KEY && !dryRun) { console.error('Set TMDB_KEY first.'); process.exit(1); }

const TMDB_KEY = process.env.TMDB_KEY;
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

const lines = async path =>
  (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean).map(l => JSON.parse(l));

/* Two kinds of stale, and they arrive from opposite directions.

   Open, never tested, and every living person it rested on has since been
   excluded. `heldOpenBy` makes this a lookup for anything judged after
   2 August; for older records the same question is asked of the evidence. */
const heldOpenByNobody = (work, record) => {
  if (work.verdict !== 'open' || work.tested) return false;
  const releaseYear = Number(work.year) || 0;
  const alive = (record?.judged ?? []).filter(p => p.status === 'alive');
  if (!alive.length) return false;
  return alive.every(p => p.impossible ?? impossible(p, releaseYear));
};

/* And closed, never tested, with a TMDB id that was never asked.

   This class exists because of a bug in this file: it handed judge.js the
   stored record while judge.js read the query's field names, so the id
   went unseen and every picture came back closed on Wikidata alone. See
   `tmdbRef` in judge.js. Those verdicts are not wrong-in-principle — they
   are unasked, and the question is still there to ask.

   `wikidata-only` on a picture that HAS an id is the signature, and it is
   one judge.js can no longer produce: with the id readable, a picture
   with an id now goes to TMDB or comes back `unchecked`. So this clause
   is self-clearing — it selects the wreckage and, once re-run, matches
   nothing. Entries with no id are genuinely unverifiable and stay out. */
const closedUnasked = work =>
  work.verdict === 'closed' && !work.tested &&
  work.reason === 'wikidata-only' && Boolean(work.tmdbId);

const isStale = (work, record) =>
  heldOpenByNobody(work, record) || closedUnasked(work);

let totalStale = 0, totalReopened = 0, totalClosed = 0, totalUntested = 0, totalFailed = 0;

for (const year of years) {
  const dir = join(OUT, String(year));
  let works, evidence;
  try {
    works = await lines(join(dir, 'works.jsonl'));
    evidence = new Map((await lines(join(dir, 'evidence.jsonl'))).map(e => [e.id, e]));
  } catch { continue; }

  const stale = works.filter(w => isStale(w, evidence.get(w.id)));
  if (!stale.length) continue;
  totalStale += stale.length;

  if (dryRun) {
    console.log(`${year}  ${stale.length} stale: ${stale.slice(0, 3).map(w => w.title).join(', ')}` +
      (stale.length > 3 ? `, +${stale.length - 3}` : ''));
    continue;
  }

  /* Credits for the stale set only, batched as the pass batches them. */
  const credits = new Map(stale.map(w => [w.id, []]));
  for (let i = 0; i < stale.length; i += 20) {
    const batch = stale.slice(i, i + 20);
    try {
      for (const row of await sparql(creditsQuery(batch.map(w => w.id)))) {
        const film = qid(row.film);
        if (credits.has(film)) credits.get(film).push(row);
      }
    } catch { /* the judge will report what it could not do */ }
  }

  const judged = new Map();
  for (let i = 0; i < stale.length; i += CONCURRENCY) {
    const chunk = stale.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(async work => {
      try {
        return { work, ...(await judge(work, credits.get(work.id) || [], { sparql, tmdb: tmdbGet })) };
      } catch (err) {
        return { work, verdict: 'unchecked', reason: 'threw', ok: false, error: String(err.message) };
      }
    }));
    for (const r of results) judged.set(r.work.id, r);
    await sleep(120);
  }

  /* Merged in, never rewritten wholesale: every other picture in the year
     keeps the record it already had, including its checkedAt. */
  /* `untested` counted separately from `closed`, because the two were
     indistinguishable in the log and that is how 965 unasked closings
     went by unremarked. A re-test that asked nobody anything should say
     so in the line it prints. */
  let reopened = 0, closed = 0, untested = 0, failed = 0;
  const nextWorks = works.map(w => {
    const r = judged.get(w.id);
    if (!r) return w;
    if (!r.ok) { failed++; return w; }
    if (r.verdict === 'open') reopened++;
    else if (r.tested) closed++;
    else untested++;

    return {
      ...w,
      verdict: r.verdict, reason: r.reason, tested: r.tested ?? false,
      unverified: r.unverified ?? false,
      heldOpenBy: r.heldOpenBy ?? null,
      wrapped: r.wrapped ?? null, wrappedMonth: r.wrappedMonth ?? null,
      wrappedYear: r.wrappedYear ?? null, dateBasis: r.dateBasis ?? null,
      last: r.last ?? null,
      makerCount: (r.recorded || []).length,
      tmdbCredited: r.tmdbCredited ?? null,
      coverage: r.tmdbCredited ? +((r.recorded.length / r.tmdbCredited).toFixed(3)) : null,
      unknownCount: r.unknownCount ?? null,
      unknownNames: [...(r.recorded || []), ...(r.resolved || [])]
        .filter(p => p.status === 'unknown').map(p => p.name),
      checkedAt: new Date().toISOString(),
      retestedAt: new Date().toISOString(),
    };
  });

  const nextEvidence = works.map(w => {
    const r = judged.get(w.id);
    if (!r || !r.ok) return evidence.get(w.id);
    return {
      id: w.id,
      releaseYear: Number(w.year) || year,
      judged: [...(r.recorded || []), ...(r.resolved || [])],
    };
  }).filter(Boolean);

  await writeFile(join(dir, 'works.jsonl.part'), nextWorks.map(w => JSON.stringify(w)).join('\n') + '\n');
  await rename(join(dir, 'works.jsonl.part'), join(dir, 'works.jsonl'));
  await writeFile(join(dir, 'evidence.jsonl.part'), nextEvidence.map(e => JSON.stringify(e)).join('\n') + '\n');
  await rename(join(dir, 'evidence.jsonl.part'), join(dir, 'evidence.jsonl'));

  /* The Desktop copy has to follow, or the durable artefact silently
     disagrees with the working one. */
  if (ARCHIVE) {
    await mkdir(ARCHIVE, { recursive: true });
    const target = join(ARCHIVE, `${year}.jsonl.gz`);
    const bundle = ['works.jsonl', 'evidence.jsonl', 'failures.jsonl'].map(f => join(dir, f));
    await pipeline(createReadStream(bundle[0]), createGzip(), createWriteStream(target + '.part'));
    for (const extra of bundle.slice(1)) {
      try {
        await pipeline(createReadStream(extra), createGzip(),
          createWriteStream(target + '.part', { flags: 'a' }));
      } catch { /* failures.jsonl may not exist */ }
    }
    await rename(target + '.part', target);
  }

  totalReopened += reopened; totalClosed += closed;
  totalUntested += untested; totalFailed += failed;
  console.log(`${year}  ${stale.length} re-tested — ${closed} closed, ${reopened} still open` +
    (untested ? `, ${untested} closed untested` : '') +
    (failed ? `, ${failed} could not be checked` : ''));
}

console.log(`\n${totalStale} stale verdicts${dryRun ? ' found' : ''}`);
if (!dryRun) {
  console.log(`  ${totalClosed} closed against TMDB`);
  console.log(`  ${totalReopened} genuinely still open`);
  if (totalUntested) {
    console.log(`  ${totalUntested} closed on Wikidata alone — no TMDB id to ask`);
  }
  if (totalFailed) console.log(`  ${totalFailed} could not be checked — TMDB did not answer`);
}
