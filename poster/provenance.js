/* ==========================================================================
   PICTURE WRAP — poster/provenance.js

   Asks Wikidata whether it already holds a death we recorded from TMDB.

     node provenance.js --years 1890-2026 --dry-run    what it would find
     node provenance.js --years 1890-2026              write it down

   WHY THIS EXISTS

   27,058 of 98,925 published closings are dated by a death only TMDB
   recorded. `METHOD.md` §2 says Wikidata is the source and TMDB the
   check. For a quarter of the archive that is backwards.

   It is not a broken join. All 27,058 are people never matched to a
   Wikidata item, and 26,787 of them have a TMDB birth date, so the
   name-and-birth-year rule could have fired. It never got the chance:
   `deathsByName` exists to find a death for somebody TMDB calls LIVING,
   and once TMDB answers 'dead' the person is settled and nothing asks
   further. Efficient for the verdict, wrong for the citation — the same
   shape as rule 19, a memo whose dependency is not recorded.

   Of the 60 closers that date the most pictures, 55 have a Wikidata item
   carrying a death date. Auguste Lumière is Q4272245, died 1954-04-10:
   the same date we credit to TMDB, sitting in a CC0 database the whole
   time.

   WHAT IT WILL NOT DO, AND WHY THAT IS THE WHOLE DESIGN

   It does not replace a date. `deathsByName` is documented in verify.js
   as a rule whose result is "good enough to stop claiming somebody is
   alive, and not good enough to put a day on the headline claim" — a
   name and a birth year is the weakest evidence this project acts on.
   That rule does not get relaxed because a different caller would find
   it convenient.

   So this only ever CORROBORATES:

     agrees      Wikidata's date equals the one we published. The fact is
                 now attributable to a CC0 source. Nothing moves.
     differs     Two sources disagree. Recorded, reported, and nothing
                 moves — this is a finding for a human, not a repair.
     no match    No single candidate. Nothing moves.

   No verdict changes. No wrap date changes. No closing appears or
   disappears. Run it twice and the second run is a no-op. What changes
   is one field per person: where the fact came from.

   It also writes nothing into Wikidata. Pushing TMDB's dates upstream
   and reading them back as CC0 was considered and is licence laundering;
   it would also manufacture a second apparent source for a single fact.
   See BACKLOG.md.
   ========================================================================== */

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { join } from 'node:path';

import { sparql, sleep } from './lib.js';
import { deathsByName } from '../verify.js';

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i === -1 ? fallback : args[i + 1];
};

const OUT = value('--out', process.env.PW_PASS || 'pass');
const ARCHIVE = value('--archive', process.env.PW_PASS_ARCHIVE || null);
const dryRun = args.includes('--dry-run');
/* Closers are what the corpus publishes — a picture's page names the last
   maker and nobody else. Everyone else's dates sit in the evidence, which
   is not published, so they are the lower priority and the longer run. */
const everyone = args.includes('--all');
const single = Number(value('--year', 0));
const range = value('--years', null);

const years = single ? [single]
  : range ? (() => {
      const [from, to] = range.split('-').map(Number);
      return Array.from({ length: to - from + 1 }, (_, i) => from + i);
    })()
  : [];

if (!years.length) {
  console.error('Usage: node provenance.js --years 1890-2026 [--all] [--dry-run]');
  process.exit(1);
}

const lines = async path =>
  (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean).map(l => JSON.parse(l));

/* A death we took from TMDB that Wikidata was never asked about. The birth
   date is required because the rule keys on it; without one there is no
   question to ask. */
const tmdbOnly = person =>
  person?.tmdb?.died && person?.tmdb?.born &&
  !person?.wd?.died && !person?.wikidataId;

/* One year at a time, twice over, rather than all of it once.

   The evidence is 1.7 GB on disk and several times that once parsed, so
   holding every year to avoid re-reading it is how this runs out of heap
   at about the 1950s. Reading each year twice costs a minute and bounds
   the memory at one year — the largest is 12 MB. */
const readYear = async year => {
  const dir = join(OUT, String(year));
  try {
    const works = await lines(join(dir, 'works.jsonl'));
    const closerOf = new Map();
    for (const w of works) {
      if (w.verdict === 'closed' && w.last?.name) closerOf.set(w.id, w.last.name);
    }
    return { dir, works, closerOf, evidence: await lines(join(dir, 'evidence.jsonl')) };
  } catch { return null; }
};

/* Every person this run will consider, in both passes, so the two passes
   cannot disagree about the population. */
const wanted = function* (file) {
  for (const record of file.evidence) {
    for (const person of record.judged || []) {
      if (!tmdbOnly(person)) continue;
      if (!everyone && file.closerOf.get(record.id) !== person.name) continue;
      yield person;
    }
  }
};

const keyOf = person => `${person.name}|${person.tmdb.born.slice(0, 4)}`;

/* ---- pass one: gather the distinct people, across every year --------- */

const asking = new Map();   /* "name|1904" -> { name, tmdb } */
const present = [];

for (const year of years) {
  const file = await readYear(year);
  if (!file) continue;
  present.push(year);
  for (const person of wanted(file)) {
    const key = keyOf(person);
    if (!asking.has(key)) asking.set(key, { id: key, name: person.name, tmdb: person.tmdb });
  }
}

const people = [...asking.values()];
console.log(`${people.length.toLocaleString('en')} distinct people to ask about` +
  ` (${everyone ? 'every credit' : 'closers only'}) across ${present.length} years\n`);

if (!people.length) process.exit(0);

/* ---- pass two: ask Wikidata, in the words verify.js already uses ------ */

/* Batched by deathsByName itself, sixty at a time. Handed over in slices
   so the run reports progress and so a long run can be watched, not
   because the rule needs help. */
const found = new Map();
const SLICE = 600;
const started = Date.now();

for (let i = 0; i < people.length; i += SLICE) {
  const slice = people.slice(i, i + SLICE);
  for (const [id, hit] of await deathsByName(slice, sparql)) found.set(id, hit);
  const done = Math.min(i + SLICE, people.length);
  const rate = (Date.now() - started) / done;
  console.log(`  asked ${done.toLocaleString('en')}/${people.length.toLocaleString('en')}` +
    ` — ${found.size.toLocaleString('en')} matched` +
    `, about ${Math.round((people.length - done) * rate / 1000)}s left`);
  await sleep(120);
}

/* ---- pass three: compare, and change only where they agree ----------- */

let agreed = 0, differed = 0, unmatched = 0, imprecise = 0;
const conflicts = [];
/* Every disagreement, not the first forty. 1,207 of them is a reading
   task rather than a console message, and each one is a date this
   archive currently publishes with no record that anything ever
   contradicted it. Deduplicated per person: one row is one dispute,
   however many pictures it dates. */
const disputes = new Map();

for (const year of present) {
  const file = await readYear(year);
  if (!file) continue;
  let touched = 0;
  /* Names whose date two sources disagree about, so the closings they
     date can be marked. Per year, because a name is only a key within
     the population the year already judged. */
  const disputedClosers = new Set();

  {
    for (const person of wanted(file)) {
      const hit = found.get(keyOf(person));
      if (!hit || !hit.died) { unmatched++; continue; }

      /* One side ending 1 January and the years agreeing is not two
         sources contradicting each other — it is one of them recording
         only a year. Wikidata says so explicitly with a precision;
         TMDB has no precision at all, so 1 January is the only signal
         there is. Calling that a dispute would put a warning on 135
         closings where nothing is actually in doubt, and this archive's
         whole habit is to distinguish "we disagree" from "we know less". */
      const yearOnly = d => /-01-01$/.test(d);
      const sameYear = hit.died.slice(0, 4) === person.tmdb.died.slice(0, 4);
      if (hit.died !== person.tmdb.died && sameYear &&
          (yearOnly(hit.died) || yearOnly(person.tmdb.died))) {
        imprecise++;
        person.corroboratedBy = {
          source: 'wikidata', died: hit.died, matchedOn: hit.matchedOn,
          note: 'agrees on the year; one source records only the year',
        };
        person.wikidataId = hit.wikidataId;
        person.source = 'both';
        touched++;
        continue;
      }

      if (hit.died !== person.tmdb.died) {
        differed++;
        disputedClosers.add(person.name);
        if (conflicts.length < 20) {
          conflicts.push(`${person.name}: TMDB ${person.tmdb.died}, ` +
            `Wikidata ${hit.died} (${hit.wikidataId})`);
        }
        const row = disputes.get(keyOf(person)) || {
          name: person.name, born: person.tmdb.born,
          tmdb: person.tmdb.died, wikidata: hit.died,
          wikidataId: hit.wikidataId, pictures: 0,
        };
        row.pictures++;
        disputes.set(keyOf(person), row);
        /* Recorded on the person so the disagreement survives this run,
           and deliberately not acted on. */
        person.disputedBy = { wikidataId: hit.wikidataId, died: hit.died };
        touched++;
        continue;
      }

      /* They agree. The date does not move — it was already right — but
         it is no longer a fact only TMDB holds, and the record now says
         so and says on what the identification rests. */
      agreed++;
      person.wikidataId = hit.wikidataId;
      person.corroboratedBy = { source: 'wikidata', died: hit.died, matchedOn: hit.matchedOn };
      person.source = 'both';
      touched++;
    }
  }

  /* The disagreement is a fact about the closing, not only about the
     person, so it travels to works.jsonl and from there into the corpus
     and onto the page. Nothing is corrected — the date stays exactly
     what it was — but a reader is told that the two databases do not
     agree about it, which is the same thing this archive already does
     with an undated closing and an unknown name.

     A picture whose dispute has since been resolved loses the flag, so
     a re-run after somebody edits Wikidata cleans up after itself. */
  let flagged = 0;
  for (const w of file.works) {
    const wasDisputed = !!w.disputed;
    const isDisputed = w.verdict === 'closed' && w.last?.name &&
      disputedClosers.has(w.last.name);
    if (isDisputed) {
      const hit = found.get(`${w.last.name}|${(w.last.born || '').slice(0, 4)}`) ||
        [...disputes.values()].find(d => d.name === w.last.name);
      w.disputed = { died: w.last.died, wikidata: hit?.wikidata ?? hit?.died ?? null };
      flagged++;
    } else if (wasDisputed) {
      delete w.disputed;
    }
    if (isDisputed !== wasDisputed) touched++;
  }
  if (flagged) console.log(`${year}  ${flagged} closings flagged: the two sources disagree on the date`);

  if (touched && !dryRun) {
    await writeFile(join(file.dir, 'works.jsonl.part'),
      file.works.map(w => JSON.stringify(w)).join('\n') + '\n');
    await rename(join(file.dir, 'works.jsonl.part'), join(file.dir, 'works.jsonl'));

    const path = join(file.dir, 'evidence.jsonl');
    await writeFile(`${path}.part`, file.evidence.map(e => JSON.stringify(e)).join('\n') + '\n');
    await rename(`${path}.part`, path);

    /* The Desktop copy has to follow. A year rewritten here and not there
       leaves the durable artefact silently disagreeing with the working
       one, and the backup is only worth what its agreement is worth.
       Written to .part and renamed, so a file that exists is a whole
       year. Same shape as retest.js, which had the same obligation. */
    if (ARCHIVE) {
      await mkdir(ARCHIVE, { recursive: true });
      const target = join(ARCHIVE, `${year}.jsonl.gz`);
      const bundle = ['works.jsonl', 'evidence.jsonl', 'failures.jsonl']
        .map(f => join(file.dir, f));
      await pipeline(createReadStream(bundle[0]), createGzip(),
        createWriteStream(`${target}.part`));
      for (const extra of bundle.slice(1)) {
        try {
          await pipeline(createReadStream(extra), createGzip(),
            createWriteStream(`${target}.part`, { flags: 'a' }));
        } catch { /* failures.jsonl may not exist */ }
      }
      await rename(`${target}.part`, target);
    }
  }
  if (touched) console.log(`${year}  ${touched} people re-sourced`);
}

console.log(`\n${agreed.toLocaleString('en')} deaths Wikidata records identically` +
  ` — no longer TMDB's alone`);
console.log(`${imprecise.toLocaleString('en')} where they agree on the year and one records only a year` +
  ` — corroborated, not disputed`);
console.log(`${differed.toLocaleString('en')} where the two sources disagree — left alone, flagged`);
console.log(`${unmatched.toLocaleString('en')} with no single Wikidata candidate — left alone`);

if (conflicts.length) {
  console.log(`\nDisagreements (first ${conflicts.length}):`);
  for (const c of conflicts) console.log(`  ${c}`);
}

if (disputes.size) {
  const path = join(OUT, 'provenance-disputes.tsv');
  const rows = [...disputes.values()].sort((a, b) => b.pictures - a.pictures);
  await writeFile(path, 'name\tborn\ttmdb\twikidata\twikidataId\tpictures\n' +
    rows.map(r => [r.name, r.born, r.tmdb, r.wikidata, r.wikidataId, r.pictures].join('\t'))
      .join('\n') + '\n');
  console.log(`\n${disputes.size.toLocaleString('en')} disputed people written to ${path}`);
}

console.log(dryRun
  ? '\nDry run. Nothing written.'
  : '\nWritten. Nothing was re-judged: run audit.js to confirm every verdict still reproduces.');
