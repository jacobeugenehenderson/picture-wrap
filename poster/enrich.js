/* ==========================================================================
   PICTURE WRAP — poster/enrich.js

   Film-level facts — genre, country, and how widely a picture is known —
   added to years already judged.

     node enrich.js --years 1890-1974
     node enrich.js --year 1924

   WHY IT IS NOT PART OF THE PASS

   pass.js answers one question — is anyone who made this still alive —
   and everything it fetches is in service of that. Genre is not: it is a
   property of the picture, true whoever is living, and it changes only
   when a Wikidata editor changes it. Bolting it onto the judgement would
   mean re-running the judgement to add a field.

   So it comes in afterwards, one query per YEAR rather than per picture,
   which is why backfilling a hundred and thirty years of it costs minutes
   rather than the hours the pass itself took. rebuild.js stays offline
   and derives; this reaches the network and adds.

   What it buys: "a long run of westerns closing in the mid-eighties" is
   the kind of question this archive should be able to answer, and it
   could not answer any question about genre at all. The naive version of
   that query is a trap — westerns rise from 0.4% of closings in the 1910s
   to 6.1% in the 2020s purely because of when westerns were MADE against
   a corpus of 1910s one-reelers. Comparing within a release cohort is the
   real question, and it needs the field stored.

   Country the same, and it is the more consequential of the two. The
   corpus is overwhelmingly American and European, which the project says
   in prose everywhere and could not demonstrate from its own data: the
   old Vault carried a country and the work records never did. Every
   claim about whose cinema this archive holds was, until now, a claim
   about a field the archive did not have.

   Countries come as demonyms — "American", "French" — because that is
   what a page says and what the Vault has always stored. A co-production
   carries several, and all of them are kept: reducing a picture to one
   country is a choice a reader should be able to see us not making.
   ========================================================================== */

import { readFile, writeFile, rename, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { sparql, qid, pickDemonym } from './lib.js';

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i === -1 ? fallback : args[i + 1];
};

const OUT = value('--out', process.env.PW_PASS || 'pass');
const dictionaryOnly = args.includes('--countries');
const single = Number(value('--year', 0));
const range = value('--years', null);

const years = single ? [single]
  : range ? (() => {
      const [from, to] = range.split('-').map(Number);
      return Array.from({ length: to - from + 1 }, (_, i) => from + i);
    })()
  : [];

if (!years.length && !dictionaryOnly) {
  console.error('Usage: node enrich.js --year 1924 | --years 1890-1974 | --countries');
  process.exit(1);
}

/* --- what a country label means -----------------------------------------

   A picture is labelled with the state that existed when it was released,
   which is right for an archive organised by release date and opaque to a
   reader in 2026. "British Raj" needs a footnote; so do Soviet, Yugoslav,
   Czechoslovak, West German.

   The obvious footnote is the successor state, and Wikidata does record
   one — P1366 — but reading it shows why it cannot be printed:

     West Germany   → Germany
     Soviet Union   → Lithuania, Russia, Belarus, Estonia, Latvia, … 15
     British Raj    → India, Dominion of Pakistan, British rule in Myanmar
     Czechoslovakia → nothing recorded

   "SOVIET (NOW LITHUANIA, RUSSIA, BELARUS…)" helps nobody, and "BRITISH
   RAJ (NOW INDIA)" is a partition erased inside a parenthesis. Choosing
   one successor is a political claim and this archive does not have a
   view.

   What it can say is when the state stopped existing, which is one fact,
   always available, and answers the reader's actual question — why does
   this say Soviet. So: the period label always, the dissolution year when
   there is one, and the successor named only in the single unambiguous
   case where Wikidata records exactly one.

       SOVIET (to 1991)          BRITISH RAJ (to 1947)
       WEST GERMAN (now German)  AMERICAN

   Written once into pass/countries.json rather than onto every picture:
   it is a fact about a country, not about a film. */
async function buildCountryDictionary() {
  const seen = new Map();

  for (const year of (await readdir(OUT)).filter(n => /^\d{4}$/.test(n))) {
    let works;
    try {
      works = (await readFile(join(OUT, year, 'works.jsonl'), 'utf8'))
        .trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
    } catch { continue; }
    for (const w of works) for (const c of w.countries || []) seen.set(c, (seen.get(c) || 0) + 1);
  }

  /* Asked by demonym, because that is what the pictures carry. */
  /* The 73 labels we actually hold, handed to the query as VALUES.

     Searching for them the other way round — every country, every
     historical country, every subclass, then matched by label — either
     returns the wrong set or does not return at all. The first attempt
     restricted to `country` and its subclasses and found two dissolved
     states in a corpus that plainly contains the Soviet Union and the
     British Raj, because Wikidata types those as "historical country".
     Broadening the traversal made the query time out instead.

     We know the strings. Asking about them directly is bounded, fast, and
     cannot quietly return a different population than the one on the
     shelf. */
  const forms = [...seen.keys()].filter(f => f && f.length <= 60 && !/["\\\u0000-\u001F]/.test(f));
  const rows = [];

  for (let i = 0; i < forms.length; i += 40) {
    const batch = forms.slice(i, i + 40);
    const got = await sparql(`
SELECT ?form ?cLabel ?dissolved (GROUP_CONCAT(DISTINCT ?nextLabel; separator="|") AS ?successors) WHERE {
  VALUES ?form { ${batch.map(f => `"${f}"@en`).join(' ')} }
  { ?c wdt:P1549 ?form } UNION { ?c rdfs:label ?form }
  ?c wdt:P31 ?kind .
  VALUES ?kind { wd:Q6256 wd:Q3024240 wd:Q3624078 wd:Q133442 wd:Q161243 }
  OPTIONAL { ?c wdt:P576 ?dissolved }
  OPTIONAL { ?c wdt:P1366 ?next . ?next rdfs:label ?nextLabel . FILTER(LANG(?nextLabel) = "en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} GROUP BY ?form ?cLabel ?dissolved`).catch(() => []);
    rows.push(...got);
  }

  /* A demonym belongs to whichever state still uses it.

     "French" matches the Kingdom of France, dissolved 1791, as well as
     the republic that has it now; so does "British", "German", "Italian",
     "Russian", "Dutch". Preferring the row that carried a dissolution
     date — which seemed the careful choice — footnoted 2,698 French
     pictures as belonging to a state that ended in 1791.

     So: if ANY item bearing this demonym still exists, the demonym is
     current and takes no footnote. Only a label that every matching state
     has stopped using gets one, and then from the last of them. That
     leaves exactly the set a reader needs explaining — Soviet, British
     Raj, Czechoslovak, Yugoslav, West German — and leaves French alone. */
  const matches = new Map();
  for (const r of rows) {
    if (!seen.has(r.form)) continue;
    if (!matches.has(r.form)) matches.set(r.form, []);
    matches.get(r.form).push({
      country: r.cLabel || null,
      dissolved: r.dissolved ? Number(String(r.dissolved).slice(0, 4)) : null,
      successors: (r.successors || '').split('|').filter(Boolean),
    });
  }

  const meta = new Map();
  for (const [form, all] of matches) {
    const extant = all.some(m => !m.dissolved);
    const last = all.filter(m => m.dissolved).sort((a, b) => b.dissolved - a.dissolved)[0];
    const chosen = extant ? all.find(m => !m.dissolved) : last;

    meta.set(form, {
      demonym: form,
      country: chosen?.country ?? null,
      pictures: seen.get(form),
      endedIn: extant ? null : (last?.dissolved ?? null),
      /* Named only when there is exactly one successor and it is
         unambiguous; otherwise the count, because "now India" for the
         British Raj is a partition erased in a parenthesis. */
      becameIn: !extant && last?.successors.length === 1 ? last.successors[0] : null,
      successors: !extant && last?.successors.length > 1 ? last.successors : undefined,
    });
  }

  for (const [form, count] of seen) {
    if (!meta.has(form)) meta.set(form, { demonym: form, country: null, pictures: count, endedIn: null, becameIn: null });
  }

  const out = [...meta.values()].sort((a, b) => b.pictures - a.pictures);
  await writeFile(join(OUT, 'countries.json'), JSON.stringify(out, null, 1));

  const gone = out.filter(c => c.endedIn);
  console.log(`${out.length} country labels in the corpus, ${gone.length} of states that no longer exist:`);
  for (const c of gone.slice(0, 12)) {
    console.log(`  ${String(c.pictures).padStart(6)}  ${c.demonym} (to ${c.endedIn})` +
      (c.becameIn ? ` — now ${c.becameIn}` : c.successors ? ` — ${c.successors.length} successor states` : ''));
  }
  console.log(`\nwritten to ${join(OUT, 'countries.json')}`);
}

if (dictionaryOnly) { await buildCountryDictionary(); process.exit(0); }

/* Every genre Wikidata puts on every picture from one year, in one ask.

   Plain rdfs:label in English, not the sixty-language label service the
   rest of this project uses: with the service this query took longer than
   the query service will run a query for, and without it, six seconds.
   The difference is acceptable here in a way it would not be for a title
   — a genre is a category we are grouping by, not a name we are showing
   somebody, and "western" does not need to arrive in Georgian.

   No class filter either. Anything Wikidata dates to this year and gives
   a genre comes back, and the ones that are not our pictures fall out
   when we intersect with what the pass judged. Cheaper than the join. */
const genreQuery = (year, from, to) => `
SELECT ?film ?value WHERE {
  ?film wdt:P577 ?rd ; wdt:P136 ?genre .
  FILTER(YEAR(?rd) = ${year})
  ${months(from, to)}
  ?genre rdfs:label ?value . FILTER(LANG(?value) = "en")
}`;

/* How many Wikipedias carry an article about this picture.

   A proxy for how widely known it is, and the only one available that
   costs nothing: `wikibase:sitelinks` is already on the item. The poster
   has used it for years to decide which closings to name in a post; the
   corpus never carried it, so the site could offer no way in other than
   the most recent closing.

   It is a proxy and should be read as one. It measures how much has been
   written about a picture, which correlates with fame and also with being
   European, English-language and old enough for somebody to have got
   round to it. */
const fameQuery = (year, from, to) => `
SELECT ?film ?value WHERE {
  ?film wdt:P577 ?rd .
  FILTER(YEAR(?rd) = ${year})
  ${months(from, to)}
  ?film wikibase:sitelinks ?value .
}`;

/* Demonyms, all of them, grouped per country and reduced by the same
   pickDemonym the site uses.

   P1549 carries several forms — American and Americans, British and
   Briton — so taking each row as it comes lists a country twice under two
   spellings. The first run of this did exactly that: "Americans 670,
   American 670". shared.js has solved it once already, preferring the
   adjective and the singular, and a second rule here would be a second
   rule to keep in step. */
const countryQuery = (year, from, to) => `
SELECT ?film ?country (GROUP_CONCAT(DISTINCT ?form; separator="|") AS ?forms)
       (SAMPLE(?name) AS ?fallback) WHERE {
  ?film wdt:P577 ?rd ; wdt:P495 ?country .
  FILTER(YEAR(?rd) = ${year})
  ${months(from, to)}
  OPTIONAL { ?country wdt:P1549 ?form . FILTER(LANG(?form) = "en") }
  OPTIONAL { ?country rdfs:label ?name . FILTER(LANG(?name) = "en") }
} GROUP BY ?film ?country`;

function months(from, to) {
  return from === 1 && to === 12 ? '' : `FILTER(MONTH(?rd) >= ${from} && MONTH(?rd) <= ${to})`;
}

/* Some years are too big for one answer.

   1938 came back as 472 KB of truncated JSON with a thread dump on the
   end, four times running — the query service had begun streaming and
   then died. Asking for less at once is the only lever a client has over
   a server-side timeout.

   Halving was not enough: three more years failed because one half was
   still too large, and the pair was fetched with Promise.all, so a single
   bad half discarded a good one. It now splits recursively down to single
   months and keeps whatever any range returns. A year is lost only if some
   individual month is unanswerable, and then only that month. */
async function facet(build, year, from = 1, to = 12) {
  try {
    return await sparql(build(year, from, to));
  } catch (err) {
    if (from === to) throw err;
    const mid = Math.floor((from + to) / 2);
    const parts = await Promise.allSettled([
      facet(build, year, from, mid),
      facet(build, year, mid + 1, to),
    ]);
    const got = parts.filter(p => p.status === 'fulfilled').flatMap(p => p.value);
    if (!got.length && parts.every(p => p.status === 'rejected')) throw err;
    return got;
  }
}

/* film id -> the distinct values it carries */
const collect = (rows, valueOf = r => r.value) => {
  const out = new Map();
  for (const r of rows) {
    const id = qid(r.film);
    const value = valueOf(r);
    if (!out.has(id)) out.set(id, []);
    if (value && !out.get(id).includes(value)) out.get(id).push(value);
  }
  return out;
};

/* One name per country: the demonym the site would print, or the
   country's own name where it has no demonym — the Soviet Union has none,
   and "Soviet" would be us inventing one. */
const countryName = r => pickDemonym(r.forms) || r.fallback || null;

for (const year of years) {
  const path = join(OUT, String(year), 'works.jsonl');
  let works;
  try {
    works = (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  } catch { console.log(`${year} — no pass output, skipping`); continue; }

  let genreRows, countryRows;
  try { genreRows = await facet(genreQuery, year); }
  catch (err) { console.log(`${year} — genre query failed (${err.message}), skipping`); continue; }
  try { countryRows = await facet(countryQuery, year); }
  catch (err) { console.log(`${year} — country query failed (${err.message})`); countryRows = []; }

  let fameRows;
  try { fameRows = await facet(fameQuery, year); }
  catch (err) { console.log(`${year} — sitelink query failed (${err.message})`); fameRows = []; }

  const genres = collect(genreRows);
  const countries = collect(countryRows, countryName);
  const fame = new Map(fameRows.map(r => [qid(r.film), Number(r.value) || 0]));

  /* Wikidata uses several labels as BOTH a class and a genre — "silent
     film" is the common one, and "short film", "animated film" and
     "documentary film" do it too. A picture typed as a silent film very
     often also carries silent film as its genre, so the same word arrives
     down two different properties.

     Keeping both is how a page comes to read "Silent film · Silent film"
     and how a tally comes to count 35,103 silent films twice. Dropping
     the genre when it merely repeats the type loses nothing: the fact is
     still on the record, in `type`, and a picture typed plainly as "film"
     keeps "silent film" as a genre because there it is informative.

     The rule for anyone aggregating this data: a picture's facets are its
     type and its genres together, deduplicated — never the two summed. */
  const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

  let touched = 0, deduped = 0, placed = 0;
  const out = works.map(w => {
    const c = countries.get(w.id) || w.countries || [];
    if (c.length) placed++;

    const g = (genres.get(w.id) || []).filter(label => {
      if (w.type && same(label, w.type)) { deduped++; return false; }
      return true;
    });
    const f = fame.get(w.id) ?? w.fame ?? 0;
    if (!genres.has(w.id)) return { ...w, genres: w.genres ?? [], countries: c, fame: f };
    touched++;
    return { ...w, genres: g, countries: c, fame: f };
  });

  await writeFile(path + '.part', out.map(w => JSON.stringify(w)).join('\n') + '\n');
  await rename(path + '.part', path);
  console.log(`${year}  ${touched} of ${works.length} carry a genre, ${placed} a country, ${fame.size} a sitelink count` +
    (deduped ? `  (${deduped} genre labels dropped as repeats of the type)` : ''));
}
