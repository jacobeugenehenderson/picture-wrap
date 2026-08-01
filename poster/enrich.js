/* ==========================================================================
   PICTURE WRAP — poster/enrich.js

   Film-level facts, added to years already judged.

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
   cannot answer any question about genre at all today. The naive version
   of that query is a trap — westerns rise from 0.4% of closings in the
   1910s to 6.1% in the 2020s purely because of when westerns were MADE
   against a corpus of 1910s one-reelers. Comparing within a release
   cohort is the real question, and it needs the field stored.
   ========================================================================== */

import { readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';

import { sparql, qid } from './lib.js';

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i === -1 ? fallback : args[i + 1];
};

const OUT = value('--out', process.env.PW_PASS || 'pass');
const single = Number(value('--year', 0));
const range = value('--years', null);

const years = single ? [single]
  : range ? (() => {
      const [from, to] = range.split('-').map(Number);
      return Array.from({ length: to - from + 1 }, (_, i) => from + i);
    })()
  : [];

if (!years.length) { console.error('Usage: node enrich.js --year 1924 | --years 1890-1974'); process.exit(1); }

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
const genreQuery = (year, half) => `
SELECT ?film ?genreLabel WHERE {
  ?film wdt:P577 ?rd ; wdt:P136 ?genre .
  FILTER(YEAR(?rd) = ${year})
  ${half === null ? '' : `FILTER(MONTH(?rd) ${half ? '>' : '<='} 6)`}
  ?genre rdfs:label ?genreLabel . FILTER(LANG(?genreLabel) = "en")
}`;

/* Some years are too big for one answer.

   1938 came back as 472 KB of truncated JSON with a thread dump on the
   end, four times running — the query service had begun streaming and
   then died. Splitting the year in half by release month asks for less
   at once, which is the only lever a client has over a server-side
   timeout, and it is free for every year that never needed it. */
async function genresFor(year) {
  try { return await sparql(genreQuery(year, null)); }
  catch {
    const halves = await Promise.all([
      sparql(genreQuery(year, false)),
      sparql(genreQuery(year, true)),
    ]);
    return halves.flat();
  }
}

for (const year of years) {
  const path = join(OUT, String(year), 'works.jsonl');
  let works;
  try {
    works = (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  } catch { console.log(`${year} — no pass output, skipping`); continue; }

  let rows;
  try { rows = await genresFor(year); }
  catch (err) { console.log(`${year} — query failed (${err.message}), skipping`); continue; }

  const genres = new Map();
  for (const r of rows) {
    const id = qid(r.film);
    if (!genres.has(id)) genres.set(id, []);
    if (!genres.get(id).includes(r.genreLabel)) genres.get(id).push(r.genreLabel);
  }
  let touched = 0;
  const out = works.map(w => {
    const g = genres.get(w.id);
    if (!g?.length) return { ...w, genres: w.genres ?? [] };
    touched++;
    return { ...w, genres: g };
  });

  await writeFile(path + '.part', out.map(w => JSON.stringify(w)).join('\n') + '\n');
  await rename(path + '.part', path);
  console.log(`${year}  ${touched} of ${works.length} pictures carry a genre`);
}
