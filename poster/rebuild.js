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

import { wrapDate, impossible, statusOf, verdictFor } from '../verify.js';

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

  const tally = { day: 0, month: 0, year: 0, none: 0, open: 0, changed: 0,
                  unclassified: 0, reclassified: 0, reopened: 0 };
  const rebuilt = works.map(work => {
    const record = evidence.get(work.id);
    /* Both directions, from the same evidence.

       This used to re-derive only from `closed`, which quietly made the
       reclassification one-way: a picture could leave the Vault for want
       of a death and could never come back when one arrived. Evidence is
       symmetric and so is this — a stored verdict of closed or
       unclassified is re-decided, and either may become the other.

       `unrecorded` is the name this state carried for about an hour on
       3 August before it was renamed; accepted here so no year has to be
       migrated by hand. */
    const rederivable = ['closed', 'unclassified', 'unrecorded'];
    if (!record || !rederivable.includes(work.verdict)) {
      if (work.verdict === 'open') tally.open++;
      return work;
    }

    /* Re-applied here, not just recorded by the pass, so that every year
       already on disk is corrected without asking anybody again. That is
       the whole bargain: a rule arrives late, and the corpus catches up
       for the cost of reading files. */
    /* Re-classify every person, rather than trusting the label the pass
       wrote beside them.

       This used to carry `p.status` through untouched and only re-derive
       the verdict over it, which made the file a re-decision about
       PICTURES and not about people. So a rule change reaching statusOf —
       exactly what happened on 4 August, when a birth year without day
       precision stopped meaning 'unknown' — passed straight through here
       and changed nothing. The first run after that change reported no
       reopenings at all, which is how it was found.

       Same order as audit.js, and for the same reasons: born after the
       picture leaves the reckoning, a name Wikidata buried is a death no
       re-reading of dates can rediscover, and everything else is
       statusOf's to decide. */
    const judged = record.judged.map(p => {
      const impossibleHere = p.impossible ?? impossible(p, record.releaseYear);
      const status = impossibleHere ? 'excluded'
        : p.buriedByName ? 'dead'
        : statusOf(p, record.releaseYear);
      return { ...p, impossible: impossibleHere, status };
    });
    const dated = wrapDate(judged, record.releaseYear);
    tally[dated.dateBasis]++;
    if ((work.wrapped ?? null) !== (dated.wrapped ?? null)) tally.changed++;

    /* Evidence arrived for something previously unclassified: it is a
       closing again, and says so rather than keeping the older label. */
    const reopened = work.verdict !== 'closed'
      ? { verdict: 'closed', reason: work.reason === 'nobody-dated' ? 'wikidata-only' : work.reason }
      : {};
    if (work.verdict !== 'closed') tally.reclassified++;

    /* Somebody in the stored evidence is now recorded living, so this is
       not a closing at all — it is running.

       This file could only ever move a picture between closed and
       unclassified, which was fine while every rule change was about
       whether a death had been RECORDED. The rule that arrived on
       4 August is about whether a person is ALIVE: a birth year and no
       death now places somebody among the living whatever the precision
       of the year, and 3,132 published closings held exactly such a
       person.

       Re-deriving `open` offline is sound HERE and would not be for a
       picture already stored as open. A closing's evidence is complete by
       construction — the survivor test ran over the whole population and
       found nobody — so re-reading it under a stricter rule is a
       re-decision, not a guess. A short-circuited `open` is the opposite:
       its population was never gathered (rule 19), which is why those are
       left alone above and belong to retest.js. */
    const verdict = verdictFor(judged, record.releaseYear);
    if (verdict === 'open') {
      tally.reopened++;
      tally.changed++;
      return {
        ...work,
        verdict: 'open',
        reason: 'living-recorded',
        tested: work.tested ?? false,
        wrapped: null, wrappedMonth: null, wrappedYear: null,
        dateBasis: null, last: null,
        rebuiltAt: new Date().toISOString(),
      };
    }

    /* A closing needs a death. Nobody living and nobody dead is not a
       wrap — it is a picture the record has nothing to say about, and it
       was reaching the Vault because the rule that unrecorded people never
       veto had nothing to push back against when EVERYONE was unrecorded.

       Re-derived here rather than re-fetched, which is the whole bargain
       this file exists to make: the rule arrived on 3 August and the
       corpus catches up for the cost of reading its own evidence. */
    if (verdict === 'unclassified') {
      tally.unclassified++;
      if (work.verdict === 'closed') tally.changed++;
      return {
        ...work,
        verdict: 'unclassified',
        reason: 'nobody-dated',
        wrapped: null, wrappedMonth: null, wrappedYear: null,
        dateBasis: null, last: null,
        rebuiltAt: new Date().toISOString(),
      };
    }

    return { ...work, ...reopened, ...dated, rebuiltAt: new Date().toISOString() };
  });

  /* The flag goes back into the evidence, not just into the conclusion.

     Leaving it derived means every future query has to remember to apply
     it, and the first ad-hoc question I asked of this corpus forgot —
     producing a list of "last living links to 1898" made entirely of
     people born in the 1950s. A rule that consumers must remember is a
     rule that will be forgotten. */
  const flagged = [...evidence.values()].map(record => ({
    ...record,
    judged: record.judged.map(p => ({
      ...p,
      impossible: p.impossible ?? impossible(p, record.releaseYear),
    })),
  }));
  const evPath = join(dir, 'evidence.jsonl');
  await writeFile(evPath + '.part', flagged.map(e => JSON.stringify(e)).join('\n') + '\n');
  await rename(evPath + '.part', evPath);

  const path = join(dir, 'works.jsonl');
  await writeFile(path + '.part', rebuilt.map(w => JSON.stringify(w)).join('\n') + '\n');
  await rename(path + '.part', path);

  console.log(`${year}  ${works.length} pictures — day ${tally.day}, month ${tally.month}, ` +
    `year ${tally.year}, unplaceable ${tally.none}, open ${tally.open}` +
    (tally.unclassified ? `, unclassified ${tally.unclassified}` : '') +
    (tally.reopened ? `, REOPENED ${tally.reopened}` : '') +
    (tally.changed ? `  (${tally.changed} changed)` : ''));
}
