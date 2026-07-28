#!/usr/bin/env node
/* explain.js — why did this picture get the verdict it got?
   ==========================================================================

   The logs say "+ closed by Angela Lansbury" or "- still living: Herbert
   Rudley" and never say why, which makes a six-hour backfill a box you
   either trust or don't. This opens it for one picture at a time.

     node explain.js Q193695              a Wikidata id
     node explain.js "The Wizard of Oz"   or a title, resolved first

   Prints every person the survivor test looked at, what each database
   holds on them, and how that produced their status. Reads nothing but
   the two APIs. Writes nothing, queues nothing, touches no state — safe
   to run against a live backfill, which is when you will most want it.

   The verdict shown is not recomputed here. It comes back from the same
   array the decision was made from, because a diagnostic that derives its
   own answer eventually disagrees with the real one, and then you have
   two bugs instead of one.                                              */

import { sparql, survivorsViaTmdb, detailsFor, qid, LANGS } from './lib.js';
import { survivors } from '../verify.js';

const AGENT = 'PictureWrap/1.0 (https://picture-wrap.com; jacob@jacobhenderson.studio)';
const arg = process.argv.slice(2).join(' ').trim();

if (!arg) {
  console.log('Usage: node explain.js <Q-id or title>');
  process.exit(1);
}

if (!process.env.TMDB_KEY) {
  console.error('Set TMDB_KEY first — without it the survivor test does not run at all.');
  process.exit(1);
}

/* --- find the picture -------------------------------------------------- */

let film = /^Q\d+$/.test(arg) ? arg : null;

if (!film) {
  const rows = await sparql(`
    SELECT ?f WHERE {
      ?f rdfs:label "${arg.replace(/["\\]/g, '')}"@en ; wdt:P31/wdt:P279* wd:Q11424 .
    } LIMIT 5`);
  if (!rows.length) { console.error(`No film called "${arg}".`); process.exit(1); }
  if (rows.length > 1) {
    console.log(`${rows.length} matches — using the first. Others:`);
    for (const r of rows.slice(1)) console.log('   ', qid(r.f));
  }
  film = qid(rows[0].f);
}

const [meta] = await sparql(`
  SELECT ?fLabel ?tmdb ?year WHERE {
    BIND(wd:${film} AS ?f)
    OPTIONAL { ?f wdt:P4947 ?tmdb }
    OPTIONAL { ?f wdt:P577 ?rd . BIND(YEAR(?rd) AS ?year) }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "${LANGS}". }
  }`);

const title = meta?.fLabel || film;
const tmdbId = meta?.tmdb || null;

console.log(`\n${title}${meta?.year ? ` (${meta.year})` : ''}   ${film}`);
console.log(`TMDB film id: ${tmdbId || '— none, so the survivor test cannot run'}\n`);

/* --- what Wikidata alone thinks ---------------------------------------- */

const living = await sparql(`
  SELECT ?p ?pLabel WHERE {
    VALUES ?prop { wdt:P161 wdt:P725 wdt:P57 wdt:P58 wdt:P162 wdt:P344 wdt:P86 wdt:P1040 wdt:P2554 wdt:P3092 wdt:P175 }
    wd:${film} ?prop ?p .
    FILTER NOT EXISTS { ?p wdt:P570 ?d }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "${LANGS}". }
  }`).catch(() => []);

console.log(`Wikidata: ${living.length
  ? `${living.length} credited with no death date — ${living.map(r => r.pLabel).join(', ')}`
  : 'everyone it credits has a death date'}`);

if (!tmdbId) {
  console.log('\nNothing further to ask. This picture would be filed on Wikidata\'s');
  console.log('answer alone and marked unverified.\n');
  process.exit(0);
}

/* --- the survivor test, with its working shown ------------------------- */

const { alive, unknown, ok, working } = await survivors({
  film,
  tmdbId,
  detail: true,
  sparql,
  tmdb: async path => {
    try {
      const join = path.includes('?') ? '&' : '?';
      const res = await fetch(
        `https://api.themoviedb.org/3${path}${join}api_key=${encodeURIComponent(process.env.TMDB_KEY)}`,
        { headers: { 'User-Agent': AGENT } });
      return res.ok ? await res.json() : null;
    } catch { return null; }
  },
});

if (!ok) {
  console.log('\nThe test did not complete — no verdict is available.');
  console.log('That is not the same as finding nobody, and nothing should read it as one.\n');
  process.exit(0);
}

const order = { alive: 0, unknown: 1, dead: 2 };
const rows = (working || []).sort((a, b) =>
  (order[a.status] - order[b.status]) || a.name.localeCompare(b.name));

console.log(`TMDB credits ${rows.length} people Wikidata did not link to this picture.\n`);

const show = d => d ? `${d.born || '—'}${d.died ? ` … ${d.died}` : ''}` : '—';

for (const r of rows) {
  const flag = r.status === 'alive' ? '!' : r.status === 'unknown' ? '?' : ' ';
  console.log(` ${flag} ${r.name.slice(0, 30).padEnd(31)}${r.status.padEnd(8)}` +
    `wikidata ${show(r.wikidata).padEnd(24)}tmdb ${show(r.tmdb)}` +
    (r.buriedByName ? '   (buried by name match)' : '') +
    (r.wikidata && r.wikidata.precision && r.wikidata.precision < 11 ? '   (year only)' : ''));
}

console.log(`\n  ! alive — vetoes the picture     ? unknown — counted, vetoes nothing\n`);
console.log(alive.length
  ? `VERDICT: not wrapped. ${alive.length} living: ${alive.map(a => a.name).join(', ')}`
  : `VERDICT: wrapped, over ${unknown} people nobody can answer for.`);
console.log();
