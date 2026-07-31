/* ==========================================================================
   PICTURE WRAP — poster/recheck.js

   Re-tests every picture in the Vault, now that we can resolve TMDB's cast
   list against Wikidata. Removes any that turn out to have a survivor.

     node recheck.js              re-test everything
     node recheck.js --limit 100  try it on a hundred first
     node recheck.js --dry-run    report only, change nothing

   Why it's needed: the Vault was built from Wikidata's cast lists alone.
   Those are often a fraction of the real cast — The Young Lions had 19 of
   76 — and a picture was called closed when those 19 had died. Wikidata
   usually DOES know the other 57 people; it just hadn't attached them to
   that film. Asking by TMDB id finds them, and finds the living ones.

   The Young Lions: 19 recorded, 28 more resolved, two of them alive. It
   should never have been in the Vault.

   Needs TMDB_KEY and PW_ARCHIVE. Backs up the Vault before writing.
   ========================================================================== */

import { writeFile } from 'node:fs/promises';
import {
  sparql, load, paths, sleep, VALUES, survivorsViaTmdb, saveArchive, saveState,
} from './lib.js';
import { couldBeLivingSparql } from '../verify.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIx = args.indexOf('--limit');
const limit = limitIx === -1 ? Infinity : Number(args[limitIx + 1]);

const CONCURRENCY = 4;
const CHECKPOINT = 200;

/* VALUES comes from shared.js. It used to be re-derived here as
   CREDITS.join(' ') — which was right until CREDITS became an array of
   [property, label] pairs, at which point the join silently produced
   "wdt:P57,Director wdt:P58,Screenplay" and every query 400'd. The run
   reported "2819 could not be checked" and changed nothing, which is the
   only reason it wasn't worse. Never re-derive a shared constant. */

if (!process.env.TMDB_KEY) {
  console.error('Set TMDB_KEY first.');
  process.exit(1);
}

/* --- the two questions asked of each picture --------------------------- */

/* 1. Does Wikidata itself now show a survivor? The Vault is a snapshot;
      someone may have added a living name since it was filed. */
const survivorQuery = film => `
SELECT ?p WHERE {
  VALUES ?prop { ${VALUES} }
  wd:${film} ?prop ?p .
  FILTER NOT EXISTS { ?p wdt:P570 ?d }
  ${couldBeLivingSparql('?p', `wd:${film}`)}
} LIMIT 1`;

/* 2. Does TMDB know anyone Wikidata doesn't, and are they alive?

   This file used to carry its own copy of that logic — the same three
   queries, written out again. The copy is why it kept the bug after the
   original was fixed: it resolved TMDB's cast against Wikidata and let
   everyone Wikidata couldn't place fall through as dead. It now calls the
   one implementation in lib.js, which asks TMDB for its own birth and
   death dates and reports the genuinely unanswerable separately. */

/* Returns { verdict, survivors, unknown } where verdict is
   'closed' | 'reopened' | 'unchecked'. */
async function recheck(entry) {
  const wdSurvivor = await sparql(survivorQuery(entry.id)).catch(() => null);
  if (wdSurvivor === null) return { verdict: 'unchecked' };
  if (wdSurvivor.length) {
    return { verdict: 'reopened', survivors: [{ name: '(in Wikidata cast list)' }], unknown: 0 };
  }

  /* No TMDB id, no verification possible — the entry stays, because the
     Wikidata test above did pass, but it must not be reported as checked.
     Counting these as 'closed' put 96 untested entries into the "still
     closed" total and set their unknownCount to 0, which reads as "nothing
     unaccounted for" on a picture nobody asked a second database about.
     Same species as every other bug here: silence presented as an answer. */
  if (!entry.tmdbId) return { verdict: 'unchecked' };

  /* `ok` is the difference between "asked and found nobody" and "never got
     an answer". Reading the second as the first is how a TMDB outage
     halfway through a re-check would quietly stamp hundreds of untested
     entries as verified — and overwrite their unknownCount with 0, which
     claims nothing is unaccounted for on a picture nothing examined.

     The no-id case above was fixed on its own and the other three failure
     modes were left behind: a null credits fetch, a film TMDB has no
     credits for, and any thrown error including a failed SPARQL call. All
     of them returned an empty survivor list, and an empty survivor list
     read as a clean bill of health. */
  const { alive, unknown, ok } = await survivorsViaTmdb(entry.id, entry.tmdbId, entry.year);
  if (!ok) return { verdict: 'unchecked' };

  return {
    verdict: alive.length ? 'reopened' : 'closed',
    survivors: alive,
    unknown,
  };
}

/* --- go ---------------------------------------------------------------- */

const archive = await load(paths.archive, []);
if (!archive.length) { console.log('Vault is empty.'); process.exit(0); }

if (!dryRun) {
  await writeFile(paths.archive + '.before-recheck', JSON.stringify(archive, null, 2) + '\n');
  console.log(`Backed up to ${paths.archive}.before-recheck`);
}

const todo = archive.slice(0, limit);
console.log(`${archive.length} in the vault, re-testing ${todo.length}.\n`);

const reopened = [];
let closed = 0, unchecked = 0, done = 0, sinceSave = 0;

/* A full pass takes hours, and until now it wrote once, at the very end.
   Killed at two hours it lost two hours — every verdict, including the
   removals. The backfill loses at most one year to the same accident,
   because it checkpoints; this had no such floor.

   So: save the archive as it stands every CHECKPOINT entries, with the
   removals found so far. Each save is a consistent state — those entries
   really did reopen — and there is no resume logic to get wrong, because
   re-testing an entry is idempotent. A kill costs the entries since the
   last save, not the run.

   Reuses the existing CHECKPOINT, which already paces the progress line —
   one interval, one meaning: this is how often the run reports and
   commits what it has. */
async function checkpoint() {
  if (dryRun || !reopened.length) return;
  const gone = new Set(reopened.map(r => r.entry.id));
  await saveArchive(archive.filter(f => !gone.has(f.id)));
}

for (let i = 0; i < todo.length; i += CONCURRENCY) {
  const chunk = todo.slice(i, i + CONCURRENCY);

  const results = await Promise.all(chunk.map(async entry => {
    const r = await recheck(entry);
    return { entry, ...r };
  }));

  for (const r of results) {
    if (r.verdict === 'reopened') {
      reopened.push({ entry: r.entry, survivors: r.survivors });
      console.log(`   REOPENED  ${r.entry.title} (${r.entry.year || '????'}) ` +
        `— ${r.survivors.slice(0, 3).map(x => x.name).join(', ')}` +
        `${r.survivors.length > 3 ? `, +${r.survivors.length - 3}` : ''}`);
    } else if (r.verdict === 'unchecked') unchecked++;
    else { closed++; r.entry.unknownCount = r.unknown ?? 0; }
  }

  done += chunk.length;
  sinceSave += chunk.length;

  if (sinceSave >= CHECKPOINT) {
    console.log(`   … ${done}/${todo.length} (${reopened.length} reopened so far)`);
    sinceSave = 0;
    await checkpoint();
  }
  await sleep(150);
}

/* --- write ------------------------------------------------------------- */

const drop = new Set(reopened.map(r => r.entry.id));
const kept = archive.filter(f => !drop.has(f.id));

console.log(`\n${closed} still closed, ${reopened.length} reopened, ${unchecked} could not be checked.`);

if (dryRun) {
  console.log('Dry run — nothing written.');
  process.exit(0);
}

await saveArchive( kept);

/* A reopened picture must be forgettable, or it can never close again:
   state.seen exists to stop re-offering, and would block the real closing
   when its last survivor finally dies. */
const state = await load(paths.state, { seen: [] });
const before = state.seen.length;
state.seen = state.seen.filter(id => !drop.has(id));
await saveState( state);

console.log(`Vault: ${archive.length} → ${kept.length}.`);
console.log(`Cleared ${before - state.seen.length} id(s) from state.seen so they can close again later.`);
