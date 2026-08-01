/* ==========================================================================
   PICTURE WRAP — poster/rebuild.js

   Re-derive a year's work records from its evidence. No network.

     node rebuild.js --year 1924
     node rebuild.js --years 1890-1913

   THE POINT

   works.jsonl is a conclusion. evidence.jsonl is what the conclusion was
   drawn from — every maker judged, both databases, dates and precisions.
   So anything the conclusion needs that we didn't think to write down the
   first time can be added later for the cost of reading a file, and a
   decision about how the archive presents itself stops being a decision
   about whether we can afford to re-fetch 300,000 pictures.

   This is the claim the whole pass was built on. Running it is the proof.

   What it adds today, and the reason it exists this evening: a closing
   with no day-precise death is not one thing. Sometimes a year is known
   and only the day is missing; sometimes nobody recorded a death at all
   and the picture is closed by arithmetic. Those want different places in
   a chronological archive, and nothing in the record distinguished them.
   Now `wrappedYear` and `dateBasis` do, and how they are SHOWN — sorted
   alphabetically inside a year, gathered into an undated tail, whatever —
   is a rendering choice somebody makes later in five minutes.
   ========================================================================== */

import { readFile, writeFile, rename, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { wrapDate } from '../verify.js';

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i === -1 ? fallback : args[i + 1];
};

const OUT = value('--out', process.env.PW_PASS || 'pass');
const single = Number(value('--year', 0));
const foldPeople = args.includes('--people');
const range = value('--years', null);

const years = single ? [single]
  : range ? (() => {
      const [from, to] = range.split('-').map(Number);
      return Array.from({ length: to - from + 1 }, (_, i) => from + i);
    })()
  : [];

if (!years.length && !foldPeople) {
  console.error('Usage: node rebuild.js --year 1924 | --years 1890-1913 | --people');
  process.exit(1);
}

/* Every year's people, folded into one file.

   The pass writes pass/people/<year>.jsonl and nothing else, so a year
   costs what a year learned rather than what the whole corpus knows. This
   is the merged view, built when somebody wants it: last writer wins per
   person, except that a record carrying a death always beats one that
   does not — a death is the one fact about a person that cannot be
   superseded. */
if (foldPeople) {
  const dir = join(OUT, 'people');
  let files = [];
  try { files = (await readdir(dir)).filter(f => f.endsWith('.jsonl')).sort(); }
  catch { console.error(`no ${dir} to fold`); process.exit(1); }

  const merged = new Map();
  /* An earlier merged file, from before the pass wrote per-year ones. */
  try {
    for (const line of (await readFile(join(OUT, 'people.jsonl'), 'utf8')).split('\n')) {
      if (line.trim()) { const p = JSON.parse(line); merged.set(p.key, p); }
    }
  } catch { /* none yet */ }

  for (const file of files) {
    for (const line of (await readFile(join(dir, file), 'utf8')).split('\n')) {
      if (!line.trim()) continue;
      const person = JSON.parse(line);
      const prior = merged.get(person.key);
      const priorKnowsDeath = prior?.wd?.died || prior?.tmdb?.died;
      const nowKnowsDeath = person.wd?.died || person.tmdb?.died;
      if (!prior || nowKnowsDeath || !priorKnowsDeath) merged.set(person.key, person);
    }
  }

  const out = join(OUT, 'people.jsonl');
  await writeFile(out + '.part',
    [...merged.values()].sort((a, b) => a.key.localeCompare(b.key))
      .map(p => JSON.stringify(p)).join('\n') + '\n');
  await rename(out + '.part', out);

  const dead = [...merged.values()].filter(p => p.wd?.died || p.tmdb?.died).length;
  console.log(`${files.length} year files folded → ${merged.size} people in ${out}`);
  console.log(`  ${dead} carry a death date and never need asking about again ` +
    `(${Math.round(100 * dead / merged.size)}%)`);
  if (!years.length) process.exit(0);
}

const lines = async path =>
  (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean).map(l => JSON.parse(l));

for (const year of years) {
  const dir = join(OUT, String(year));
  let works, evidence;
  try {
    works = await lines(join(dir, 'works.jsonl'));
    evidence = new Map((await lines(join(dir, 'evidence.jsonl'))).map(e => [e.id, e]));
  } catch {
    console.log(`${year} — no pass output, skipping`);
    continue;
  }

  const tally = { day: 0, year: 0, none: 0, open: 0, changed: 0 };
  const rebuilt = works.map(work => {
    const record = evidence.get(work.id);
    if (!record || work.verdict !== 'closed') {
      if (work.verdict === 'open') tally.open++;
      return work;
    }

    const dated = wrapDate(record.judged);
    tally[dated.dateBasis]++;
    if ((work.wrapped ?? null) !== (dated.wrapped ?? null)) tally.changed++;

    return { ...work, ...dated, rebuiltAt: new Date().toISOString() };
  });

  const path = join(dir, 'works.jsonl');
  await writeFile(path + '.part', rebuilt.map(w => JSON.stringify(w)).join('\n') + '\n');
  await rename(path + '.part', path);

  console.log(`${year}  ${works.length} pictures — dated to the day ${tally.day}, ` +
    `to the year ${tally.year}, undatable ${tally.none}, open ${tally.open}` +
    (tally.changed ? `  (${tally.changed} dates changed)` : ''));
}
