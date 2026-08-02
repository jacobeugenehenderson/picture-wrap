/* ==========================================================================
   PICTURE WRAP — poster/audit.js

   Does a pass keep enough to be worth having?

     node audit.js --year 1924
     node audit.js --year 1924 --ceiling 115     re-decide under another rule

   Three questions, all pass or fail, none of them opinion. Which rules
   each one exercises is tabulated in docs/VERIFICATION.md under "The
   canon" — the column marked *asserted* there is the list of rules
   nothing here can catch, and is the honest measure of this file's
   reach.

     1. REPRODUCTION.  Re-decide every verdict from the stored evidence
        alone. No network, no Wikidata, no TMDB. Every verdict must match
        what the pass concluded. A mismatch means a field the pass used
        and did not write down — which is the whole thing this is for.

     2. REPLAY.        Re-decide under a different age ceiling, again from
        the files. If that needs the network, the evidence is incomplete
        and every future rule change costs another full pass. Today's
        112-versus-122 argument should have been this, and was four hours
        of re-fetching instead.

     3. INTEGRITY.     Every closed picture carries a day-precise wrap
        date or none at all; every wrap date belongs to somebody in the
        evidence; unknown counts match the unknowns listed.

   This deliberately does not import survivors(). It re-runs the judgement
   over stored dates, which is all a re-decision needs — and if that is not
   enough to reproduce the answer, better to find out here than three
   hundred hours in.
   ========================================================================== */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { statusOf, wrapDate, impossible } from '../verify.js';

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i === -1 ? fallback : args[i + 1];
};

const YEAR = Number(value('--year', 0));
const OUT = value('--out', process.env.PW_PASS || 'pass');
const CEILING = value('--ceiling', null);

if (!YEAR) { console.error('Usage: node audit.js --year 1924'); process.exit(1); }

const lines = async path =>
  (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean).map(l => JSON.parse(l));

const dir = join(OUT, String(YEAR));
const works = await lines(join(dir, 'works.jsonl'));
const evidence = new Map((await lines(join(dir, 'evidence.jsonl'))).map(e => [e.id, e]));

/* Re-decide one picture from what was written down: anyone living leaves
   it open, nobody living closes it, and the wrap goes to whoever died
   last with a date precise enough to name a day. */
function decide(work, judged, ceiling) {
  const releaseYear = Number(work.year) || YEAR;

  const status = p => {
    /* Could not have been on the picture, so gets no vote either way. */
    if (p.impossible ?? impossible(p, releaseYear)) return 'excluded';
    /* Wikidata buried this person under their own name and birth year,
       which no amount of re-reading their dates can rediscover — the
       burial was a query, and the evidence records its result. Ignoring
       the flag made the audit re-decide 49 pictures in 1952 alone as
       still running, and report the pass as unreproducible when the pass
       was right and the checker was wrong. */
    if (p.buriedByName) return 'dead';
    if (!ceiling) return statusOf(p, releaseYear);
    /* Replay: the same evidence, a different line. Only the arithmetic
       moves — a recorded death is still a recorded death. */
    if (p.wd?.deathAsserted || p.wd?.died || p.tmdb?.died) return 'dead';
    const born = Number(String(p.wd?.born || p.tmdb?.born || '').slice(0, 4)) || releaseYear;
    if (born && (new Date().getUTCFullYear() - born) > ceiling) return 'dead';
    return statusOf(p, releaseYear);
  };

  const decided = judged.map(p => ({
    ...p, status: status(p),
    impossible: p.impossible ?? impossible(p, releaseYear),
  }));
  if (decided.some(p => p.status === 'alive')) return { verdict: 'open', wrapped: null };

  /* The same wrapDate() the pass and the rebuild use. An audit that
     re-implements what it is auditing tests only its own opinion. */
  return { verdict: 'closed', wrapped: wrapDate(decided, releaseYear).wrapped ?? null };
}

/* --- 1 and 2 ----------------------------------------------------------- */

let checked = 0, verdictMismatch = 0, dateMismatch = 0, missing = 0, stale = 0;
const examples = [];

for (const work of works) {
  if (work.verdict === 'unchecked') continue;      /* never had an answer */
  const record = evidence.get(work.id);
  if (!record) { missing++; continue; }
  checked++;

  const again = decide(work, record.judged, CEILING ? Number(CEILING) : null);

  if (again.verdict !== work.verdict) {
    /* Two very different things look identical here, and calling both a
       failure is how a real one gets lost in the noise.

       A picture the pass called OPEN without testing was short-circuited:
       the expensive TMDB question is skipped the moment Wikidata shows a
       survivor, so its evidence is a partial population BY CONSTRUCTION.
       If the rule that produced that survivor has since tightened, the
       stored verdict is stale and the picture is untested — not closed,
       and not evidence of anything missing from the record. It needs the
       network, which is what retest.js is for.

       Anything else is the real failure: a verdict that cannot be
       reproduced from evidence that should have been sufficient. */
    const shortCircuited = work.verdict === 'open' && !work.tested
      && record.judged.some(p => p.status === 'alive')
      && !record.judged.some(p => p.status === 'alive'
        && !(p.impossible ?? impossible(p, Number(work.year) || YEAR)));

    if (shortCircuited) {
      stale++;
    } else {
      verdictMismatch++;
      if (examples.length < 6) {
        examples.push(`   ${work.title}: ${work.verdict} → ${again.verdict}`);
      }
    }
  } else if (!CEILING && (again.wrapped ?? null) !== (work.wrapped ?? null)) {
    dateMismatch++;
    if (examples.length < 6) {
      examples.push(`   ${work.title}: dated ${work.wrapped}, evidence dates ${again.wrapped}`);
    }
  }
}

/* --- 3 ----------------------------------------------------------------- */

let undatedClosed = 0, orphanDate = 0, unknownMismatch = 0, imprecise = 0, beforeRelease = 0;
for (const work of works) {
  const record = evidence.get(work.id);
  if (!record) continue;

  if (work.verdict === 'closed' && !work.wrapped) undatedClosed++;

  if (work.wrapped) {
    /* Not the format — the claim. 2000-01-01 matches the shape of a date
       perfectly, which is exactly how the first pilot run dated a wrap on
       a bare year: the check tested the string and the string was fine.
       So ask the evidence instead: whoever this date belongs to must have
       a death Wikidata records to the day, or a TMDB date that isn't the
       1 January a year-only record collapses to. */
    /* A picture cannot wrap before it exists. Fifty-three did, on
       source authors, archival footage and one date TMDB spelled
       "7-9-1980". */
    if (Number(work.wrapped.slice(0, 4)) < (Number(work.year) || 0)) beforeRelease++;

    const owner = record.judged.find(p => (p.wd?.died || p.tmdb?.died) === work.wrapped);
    if (!owner) orphanDate++;
    else if (!owner.datesAWrap
      || (owner.wd?.died === work.wrapped && !(owner.wd.diedPrecision >= 11))) imprecise++;
  }

  if (work.unknownNames) {
    const fromEvidence = record.judged.filter(p => p.status === 'unknown').length;
    if (fromEvidence !== work.unknownNames.length) unknownMismatch++;
  }
}

/* --- say so ------------------------------------------------------------ */

const mark = (ok, good, bad) => `   ${ok ? 'pass  ' : 'FAIL  '}${ok ? good : bad}`;

console.log(`\n${YEAR} — ${works.length} pictures, ${checked} with a verdict to re-decide\n`);

if (CEILING) {
  console.log(`2. REPLAY at ceiling ${CEILING}, from the files only, network unplugged`);
  console.log(`   ${verdictMismatch} verdicts change`);
  if (examples.length) console.log(examples.join('\n'));
  console.log('\n   A rule change is now a re-decision, not a re-fetch.\n');
} else {
  console.log('1. REPRODUCTION — re-decided from evidence.jsonl, network unplugged');
  console.log(mark(verdictMismatch === 0, 'every verdict reproduces', `${verdictMismatch} verdicts do not reproduce`));
  console.log(mark(dateMismatch === 0, 'every wrap date reproduces', `${dateMismatch} wrap dates do not reproduce`));
  console.log(mark(missing === 0, 'every picture has an evidence line', `${missing} pictures have no evidence`));
  if (examples.length) console.log(examples.join('\n'));
  if (stale) {
    console.log(`   note  ${stale} short-circuited verdicts predate a rule change ` +
      `and need re-testing — run retest.js`);
  }

  console.log('\n3. INTEGRITY');
  console.log(mark(imprecise === 0, 'every wrap date rests on a death recorded to the day', `${imprecise} wrap dates rest on a year, not a day`));
  console.log(mark(beforeRelease === 0, 'no picture wraps before it was released', `${beforeRelease} wrap before release`));
  console.log(mark(orphanDate === 0, 'every wrap date belongs to someone in the evidence', `${orphanDate} wrap dates belong to nobody recorded`));
  console.log(mark(unknownMismatch === 0, 'unknown counts match the unknowns listed', `${unknownMismatch} unknown counts disagree`));
  console.log(`   note  ${undatedClosed} closed pictures have no day-precise death, so they close undated\n`);
}
