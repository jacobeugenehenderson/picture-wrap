/* ==========================================================================
   PICTURE WRAP — poster/dedupe.js

   Collapses pictures that a year's files hold more than once.

     node dedupe.js --years 1890-2026            repair every year
     node dedupe.js --years 1890-2026 --dry-run  count, change nothing

   WHY THIS EXISTS

   `worksQuery` in pass.js grouped by `?typeLabel`, and Wikidata gives one
   picture several of the classes we ask about — 1,166 are both "film" and
   "short film", 731 are both "film" and "television film". Each came back
   as its own row and was judged as its own picture.

   The judgement was never in doubt: both rows carry the same credits, so
   across 3,924 duplicated groups not one disagrees about the verdict or
   the wrap date. What differed was the label. So this is not a
   re-decision and it needs no network — it is two records of one picture
   being made back into one.

   The query is fixed in pass.js, so nothing new arrives this way. This is
   for the 137 years already on disk, which would otherwise carry the
   damage until every one of them is passed again.

   Offline, idempotent, and it will not merge two records that disagree
   about anything that matters — if one is ever found, it is reported and
   left alone, because a rule this file cannot justify is a rule that
   belongs in front of a person.
   ========================================================================== */

import { readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';

import { mostSpecificType } from '../shared.js';

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i === -1 ? fallback : args[i + 1];
};

const OUT = value('--out', process.env.PW_PASS || 'pass');
const dryRun = args.includes('--dry-run');
const range = value('--years', null);
const single = Number(value('--year', 0));

const years = single ? [single]
  : range ? (() => {
      const [from, to] = range.split('-').map(Number);
      return Array.from({ length: to - from + 1 }, (_, i) => from + i);
    })()
  : [];

if (!years.length) { console.error('Usage: node dedupe.js --years 1890-2026'); process.exit(1); }

const lines = async path =>
  (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean).map(l => JSON.parse(l));

/* What may not differ between two records of one picture. Everything else
   is either a label (merged), a timestamp (latest wins) or derived from
   these (carried with the record that survives). */
const DECISIVE = ['verdict', 'reason', 'tested', 'wrapped', 'wrappedMonth',
                  'wrappedYear', 'dateBasis', 'year'];

const same = (a, b) => DECISIVE.every(k =>
  JSON.stringify(a[k] ?? null) === JSON.stringify(b[k] ?? null));

/* The surviving record. Latest check wins, so the merge inherits the most
   recent judgement rather than whichever row the query happened to emit
   first; then the type and the genres are put back, since those are the
   only two fields the duplicates were ever really carrying. */
const merge = group => {
  const newest = [...group].sort((a, b) =>
    String(a.checkedAt || '').localeCompare(String(b.checkedAt || ''))).pop();
  const genres = [...new Set(group.flatMap(w => w.genres || []))];
  return {
    ...newest,
    type: mostSpecificType(group.map(w => w.type)),
    ...(genres.length ? { genres } : {}),
  };
};

let totalWorks = 0, totalEvidence = 0, totalYears = 0, totalRefused = 0;

for (const year of years) {
  const dir = join(OUT, String(year));
  let works, evidence;
  try {
    works = await lines(join(dir, 'works.jsonl'));
    evidence = await lines(join(dir, 'evidence.jsonl'));
  } catch { continue; }

  const byId = new Map();
  for (const w of works) {
    if (!byId.has(w.id)) byId.set(w.id, []);
    byId.get(w.id).push(w);
  }

  let refused = 0;
  const nextWorks = [];
  const emitted = new Set();
  for (const w of works) {
    if (emitted.has(w.id)) continue;
    const group = byId.get(w.id);
    emitted.add(w.id);
    if (group.length === 1) { nextWorks.push(w); continue; }

    /* Disagreement about a verdict is not a duplicate, it is a finding.
       Left exactly as it was, and named, so it can be looked at. */
    if (!group.every(x => same(x, group[0]))) {
      refused++;
      console.log(`  ! ${year} ${w.id} ${w.title} — copies disagree, left alone`);
      nextWorks.push(...group);
      continue;
    }
    nextWorks.push(merge(group));
  }

  const seenEvidence = new Set();
  const nextEvidence = evidence.filter(e => {
    if (seenEvidence.has(e.id)) return false;
    seenEvidence.add(e.id);
    return true;
  });

  const droppedWorks = works.length - nextWorks.length;
  const droppedEvidence = evidence.length - nextEvidence.length;
  if (!droppedWorks && !droppedEvidence && !refused) continue;

  totalYears++;
  totalWorks += droppedWorks;
  totalEvidence += droppedEvidence;
  totalRefused += refused;
  console.log(`${year}  ${works.length} → ${nextWorks.length} works` +
    (droppedEvidence ? `, ${droppedEvidence} evidence rows` : '') +
    (refused ? `, ${refused} refused` : ''));

  if (dryRun) continue;

  for (const [name, rows] of [['works.jsonl', nextWorks], ['evidence.jsonl', nextEvidence]]) {
    const path = join(dir, name);
    await writeFile(path + '.part', rows.map(r => JSON.stringify(r)).join('\n') + '\n');
    await rename(path + '.part', path);
  }
}

console.log(`\n${totalYears} years touched${dryRun ? ' (dry run, nothing written)' : ''}`);
console.log(`  ${totalWorks} duplicate pictures collapsed`);
console.log(`  ${totalEvidence} duplicate evidence rows dropped`);
if (totalRefused) console.log(`  ${totalRefused} left alone — copies disagreed`);
