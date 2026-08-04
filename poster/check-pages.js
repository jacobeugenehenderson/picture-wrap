/* ==========================================================================
   PICTURE WRAP — poster/check-pages.js

   Does the film page agree with the corpus?

     node check-pages.js --years 1890-2026
     node check-pages.js --year 1945 --show 20

   WHY THIS EXISTS

   Canon rule 27 is the only rule whose subject is the code rather than the
   data: the film and person pages ask Wikidata directly and apply the
   rules themselves, in the browser, in a second implementation the audit
   never reaches. It has to be a second implementation — a filmography
   spans release years the pass may never have run, and the corpus is a
   snapshot while Wikidata is live — so the page cannot read a verdict off
   the corpus. That is a constraint, not a shortcut.

   It drifted three times before anything checked it: rule 6 missing on
   Gidget, the third state missing on Women of the World, and Philip Glass
   holding Dracula (1931) open on his co-workers' pages by counting
   credits instead of classifying people.

   WHAT IT COMPARES, AND WHY IT IS OFFLINE

   `BACKLOG.md` proposed sampling: run the page's logic over the LIVE
   filmography for a few hundred pictures and explain away the
   differences. That test cannot separate the two things it would find.
   Wikidata moves, so a disagreement might be drift in our code or simply a
   credit added last Tuesday, and telling those apart means a second
   judgement about every result.

   So this asks a narrower question that has an exact answer: **given the
   same people, do the two implementations reach the same verdict?** It
   feeds the page's own `classifyRoster` the corpus's stored evidence,
   shaped into the flat rows the page works on, and compares its verdict
   with the one the pass reached. Same input, so a disagreement is drift
   and nothing else.

   It is therefore offline, complete rather than sampled, and runs in the
   time it takes to read the evidence. What it cannot see is whether the
   page's live QUERY gathers the same people the pass did — that is the
   irreducible half of rule 27, and no offline test reaches it.

   EXPECTED DISAGREEMENTS

   Two, and they are reported separately because they are not bugs:

     the page has no TMDB. The pass resolves people TMDB names and
     Wikidata never attached; the page gets them live from the survivor
     test, which this cannot replay. Where the corpus closed a picture on
     somebody only TMDB knew, the page's rows do not contain them.

     the page cannot see a death Wikidata asserts without dating, nor a
     burial by name, both of which the pass records as facts about a
     person rather than as a date on a row.
   ========================================================================== */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { rosterVerdict } from '../verify.js';
import { creditRows } from '../shared.js';

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i === -1 ? fallback : args[i + 1];
};

const OUT = value('--out', process.env.PW_PASS || 'pass');
const SHOW = Number(value('--show', 8));
const single = Number(value('--year', 0));
const range = value('--years', null);

const years = single ? [single]
  : range ? (() => {
      const [from, to] = range.split('-').map(Number);
      return Array.from({ length: to - from + 1 }, (_, i) => from + i);
    })()
  : [];

if (!years.length) {
  console.error('Usage: node check-pages.js --years 1890-2026');
  process.exit(1);
}

const lines = async path =>
  (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean).map(l => JSON.parse(l));

/* A judged person, as the roster would have received them.

   The page reads SPARQL rows: a birth date, a death date, character or job
   strings. The pass holds two databases and a precision. This takes the
   facts the page WOULD have had and drops the rest, which is the whole
   point — testing the page's rules on a richer record than the page can
   ever have would prove nothing.

   `deathAsserted` is deliberately not turned into a date. Wikidata can
   record that somebody died without recording when, and the page has no
   way to represent that: a roster row has a `dod` or it does not. Pictures
   turning on one are counted and set aside rather than silently failed. */
const asRosterRow = person => ({
  dob: person.wd?.born || person.tmdb?.born || null,
  dod: person.wd?.died || person.tmdb?.died || null,
  credits: person.roles || [],
});

const invisible = person =>
  /* the page never saw this person: TMDB named them, Wikidata did not */
  (person.source === 'tmdb' && !person.wikidataId)
  /* a death with no date, or one found by name — neither fits a row */
  || Boolean(person.wd?.deathAsserted && !person.wd?.died)
  || Boolean(person.buriedByName);

let checked = 0, agreed = 0, unreachable = 0;
let personChecked = 0, personAgreed = 0;
const drift = [];
const personDrift = [];

/* The person page does not receive rows. It receives one string per
   credit — `Qid#birthyear#death`, with empty parts where Wikidata holds
   nothing — and parses it with `creditRows`. That parse is the only
   person-page-specific code left, and therefore the only place its drift
   could now live, so it is exercised rather than assumed: the corpus's
   people are rendered back into the string the query would have produced
   and the page's own path is run over it.

   A birth YEAR, not a date, because a year is all the query asks for. If
   the two surfaces ever disagree because one has a day and the other only
   a year, that is a real difference and shows up here. */

for (const year of years) {
  const dir = join(OUT, String(year));
  let works, evidence;
  try {
    works = await lines(join(dir, 'works.jsonl'));
    evidence = new Map((await lines(join(dir, 'evidence.jsonl'))).map(e => [e.id, e]));
  } catch { continue; }

  for (const work of works) {
    if (work.verdict === 'unchecked') continue;
    const record = evidence.get(work.id);
    if (!record) continue;

    const people = record.judged || [];

    /* If the corpus used somebody the page cannot see, the two are not
       looking at the same picture and a disagreement says nothing. */
    if (people.some(invisible)) { unreachable++; continue; }

    checked++;
    const releaseYear = Number(work.year) || year;
    const mine = rosterVerdict(people.map(asRosterRow), releaseYear);

    if (mine === work.verdict) agreed++;
    else if (drift.length < SHOW) {
      drift.push(`   ${work.title} (${work.year}): corpus ${work.verdict}, film page ${mine}`);
    }

    /* And the same picture through the person page's path. Every credit
       is distinct here — the string uses one id, so `creditRows` folds
       them into a single row and the comparison would be meaningless.
       Given distinct ids it is the same judgement, so what this actually
       tests is the PARSE. */
    const asStrings = people.map((p, i) => {
      const born = (p.wd?.born || p.tmdb?.born || '').slice(0, 4);
      const died = (p.wd?.died || p.tmdb?.died || '').slice(0, 10);
      return `Q${i}#${born}#${died}`;
    }).join('|');

    personChecked++;
    const theirs = rosterVerdict(creditRows(asStrings), releaseYear);
    if (theirs === work.verdict) personAgreed++;
    else if (personDrift.length < SHOW) {
      personDrift.push(`   ${work.title} (${work.year}): corpus ${work.verdict}, person page ${theirs}`);
    }
  }
}

const disagreed = checked - agreed;
console.log(`${checked.toLocaleString('en')} pictures where the page could see everything the pass did`);
console.log(`  ${agreed.toLocaleString('en')} agree`);
console.log(`  ${disagreed.toLocaleString('en')} DISAGREE` +
  (disagreed ? ' — the two implementations differ on identical input' : ''));
console.log(`\n${unreachable.toLocaleString('en')} skipped: the corpus used somebody the page cannot see`);
if (drift.length) {
  console.log('\nfilm page:');
  console.log(drift.join('\n'));
}

const personDisagreed = personChecked - personAgreed;
console.log(`\nthe person page's own path, over the same pictures`);
console.log(`  ${personAgreed.toLocaleString('en')} agree`);
console.log(`  ${personDisagreed.toLocaleString('en')} DISAGREE`);
if (personDrift.length) {
  console.log('\nperson page:');
  console.log(personDrift.join('\n'));
}

process.exit(disagreed || personDisagreed ? 1 : 0);
