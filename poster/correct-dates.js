/* ==========================================================================
   PICTURE WRAP — poster/correct-dates.js

   Applies reviewed date corrections to the stored evidence.

     node correct-dates.js --years 1890-2026 --dry-run
     node correct-dates.js --years 1890-2026

   WHY THIS EXISTS, AND WHY IT IS THE ONLY THING LIKE IT

   Every other date in this archive comes from a database the pass read.
   This is the one path where a human decided that one of them was wrong,
   and it is deliberately not automatic: it reads
   `pass/date-corrections.tsv`, which is written by hand or generated and
   then read by a person, and it does exactly what that file says.

   The file was built on 4 August 2026 from `provenance-disputes.tsv` —
   337 people whose two sources give different death dates — narrowed to
   the ones where the disagreement is on the YEAR, and narrowed again to
   where Wikidata's date clears three bars:

     it is cited to something that is not another user-edited site
       (IMDb, Find a Grave and Discogs are somebody typing into a form,
       exactly like the value we already hold);
     Wikidata holds only ONE death date for the person, so taking it is a
       correction and not a preference between its own statements;
     and it is precise to a year or better, because a century cannot
       correct a date.

   61 people disagreed on the year. 18 cleared all three, and then FIVE of
   those eighteen turned out to be a different person entirely.

   THE TRAP, AND IT IS THE WHOLE REASON THIS FILE IS REVIEWED BY HAND.

   `provenance-disputes.tsv` was built by matching a name and a birth
   YEAR. That is the weakest key in the project, and it manufactures
   disagreements out of two people who merely share both. Paul J. Smith is
   the case: Q3371503 is the animator, born 1906-03-15, died 1980; ours is
   the Disney composer, born 1906-10-30, died 1985-01-25. Nothing was
   wrong. There were two men.

   So every row was checked against the Wikidata item's own birth date
   before being applied, and a mismatch is not automatically a rejection —
   Antonio Moreno is 09-24 to us and 09-26 to Wikidata, two days apart on
   a man both sides describe as the Spanish actor who died in 1967, and
   that is one person with two recorded birthdays. It is a question, and
   the answer goes in `pass/date-corrections-rejected.tsv` with a reason
   when the answer is no. Three were rejected there:

     Paul J. Smith    — the animator, not the composer
     Kathleen Butler  — Wikidata's is sourced to a British peerage
                        genealogy with no occupation and only a year of
                        birth; ours acted in 1913 Biograph shorts
     Charles Blackman — an Australian painter, born a month apart

   Fifteen were applied.

   WHAT IT CHANGES, AND WHAT IT DOES NOT

   Only the death date on the person, in `evidence.jsonl`. It does not
   touch a verdict or a wrap date — `rebuild.js` re-derives those from the
   corrected evidence afterwards, which is the whole reason the evidence
   is kept.

   It keys on the TMDB PERSON ID rather than the name. Antonio Moreno is
   why: the archive published both of his death dates, 1967 on pictures
   where Wikidata named him and 1987 on pictures where only TMDB did, and
   a name match cannot tell those rows apart from a different Antonio
   Moreno. Two people share a name more often than seems possible — see
   the two Mary Parkers on Hunted Men (1938).

   Idempotent: a row already carrying the corrected date is left alone and
   counted as already done, so running twice changes nothing.
   ========================================================================== */

import { readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i === -1 ? fallback : args[i + 1];
};

const OUT = value('--out', process.env.PW_PASS || 'pass');
const FILE = value('--corrections', join(OUT, 'date-corrections.tsv'));
const dryRun = args.includes('--dry-run');
const single = Number(value('--year', 0));
const range = value('--years', null);

const years = single ? [single]
  : range ? (() => {
      const [from, to] = range.split('-').map(Number);
      return Array.from({ length: to - from + 1 }, (_, i) => from + i);
    })()
  : [];

if (!years.length) {
  console.error('Usage: node correct-dates.js --years 1890-2026 [--dry-run]');
  process.exit(1);
}

const lines = async path =>
  (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean);

const rows = (await lines(FILE)).slice(1).map(l => {
  const [wikidataId, name, born, wrong, right, precision, sources] = l.split('\t');
  return { wikidataId, name, born, wrong, right, precision: Number(precision), sources };
});

console.log(`${rows.length} corrections to apply, from ${FILE}\n`);

/* Which TMDB person each correction is about. The disputes file names a
   Wikidata item; the rows carrying the wrong date name a TMDB id and
   nothing else. The link between them is in the evidence itself, on the
   rows where Wikidata DID name the person — so it is read from there
   rather than asked for again. */
const tmdbOf = new Map();
for (const year of years) {
  let ev;
  try { ev = await lines(join(OUT, String(year), 'evidence.jsonl')); } catch { continue; }
  for (const line of ev) {
    let record;
    try { record = JSON.parse(line); } catch { continue; }
    for (const p of record.judged || []) {
      if (!p.wikidataId || !p.tmdbId) continue;
      const hit = rows.find(r => r.wikidataId === p.wikidataId);
      if (hit) tmdbOf.set(hit.wikidataId, String(p.tmdbId));
    }
  }
}

const unresolved = rows.filter(r => !tmdbOf.has(r.wikidataId));
if (unresolved.length) {
  console.log(`  ${unresolved.length} have no TMDB id anywhere in the evidence; ` +
    'their Wikidata rows will still be corrected if they carry the wrong date');
}

let changed = 0, already = 0, touchedYears = 0;

for (const year of years) {
  const dir = join(OUT, String(year));
  let ev;
  try { ev = await lines(join(dir, 'evidence.jsonl')); } catch { continue; }

  let yearChanged = 0;
  const next = ev.map(line => {
    let record;
    try { record = JSON.parse(line); } catch { return line; }
    let touched = false;

    for (const p of record.judged || []) {
      for (const r of rows) {
        const sameTmdb = tmdbOf.has(r.wikidataId)
          && p.tmdbId && String(p.tmdbId) === tmdbOf.get(r.wikidataId);
        const sameItem = p.wikidataId && p.wikidataId === r.wikidataId;

        /* When no row anywhere links the item to a TMDB id, the id key is
           unavailable and the only thing left is the identity provenance.js
           matched on in the first place — and this tightens it. Not the
           name: the name AND the exact birth date AND the exact wrong
           death date, all three. Kathleen Butler is the case; she exists
           in this corpus only as TMDB 2379386 with no Wikidata row to link
           from, and 19 closings kept her wrong date because of it.

           Three exact fields is a far narrower key than the name-and-birth-
           YEAR rule that found these people, and it is applied to a list a
           human has already read. */
        const sameByIdentity = !tmdbOf.has(r.wikidataId)
          && p.name === r.name
          && (p.tmdb?.born === r.born || p.wd?.born === r.born)
          && (p.tmdb?.died === r.wrong || p.wd?.died === r.wrong);

        if (!sameTmdb && !sameItem && !sameByIdentity) continue;

        /* Correct wherever the wrong date sits. It can be on either side:
           the TMDB record is where it usually is, and a Wikidata row can
           carry it too when the item itself was edited since the pass. */
        for (const side of ['wd', 'tmdb']) {
          if (!p[side]?.died) continue;
          if (p[side].died === r.right) { already++; continue; }
          if (p[side].died !== r.wrong) continue;
          p[side].died = r.right;
          if (side === 'wd') p.wd.diedPrecision = r.precision;
          p.corrected = { from: r.wrong, to: r.right, on: '2026-08-04' };
          touched = true;
          changed++;
        }
        break;
      }
    }
    return touched ? JSON.stringify(record) : line;
  });

  yearChanged = next.filter((l, i) => l !== ev[i]).length;
  if (!yearChanged) continue;
  touchedYears++;
  console.log(`  ${year}  ${yearChanged} records`);

  if (dryRun) continue;
  const path = join(dir, 'evidence.jsonl');
  await writeFile(path + '.part', next.join('\n') + '\n');
  await rename(path + '.part', path);
}

console.log(`\n${changed} dates corrected across ${touchedYears} years` +
  (already ? `, ${already} already correct` : ''));
if (dryRun) console.log('Dry run. Nothing written.');
else console.log('Now run rebuild.js — verdicts and wrap dates come from the evidence.');
