/* ==========================================================================
   PICTURE WRAP — poster/recover.js

   Files pictures the backfill dropped because it only asked Wikidata for
   ENGLISH labels. An item with a French title and no English one came back
   as "Q16673908", the unnamed() guard skipped it, and it was recorded as
   seen — so no future run would ever offer it again.

   319 films, almost all non-English: Rue du Havre, El hombre malo,
   De bote en bote, 13 år. The bug fell hardest on exactly the cinema the
   archive is already thinnest on.

   Each is verified the same way recheck.js verifies the Vault — Wikidata
   survivors, then TMDB's fuller cast resolved by id — so nothing is filed
   that a survivor would reopen.

     node recover.js --dry-run
     node recover.js

   Needs TMDB_KEY and PW_ARCHIVE.
   ========================================================================== */

import { readFile } from 'node:fs/promises';
import {
  sparql, qid, load, paths, sleep, VALUES, detailsFor, longDate,
  survivorsViaTmdb, saveArchive,
} from './lib.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const LIST = '/tmp/naming-losses.json';
const CONCURRENCY = 4;
/* Both come from shared.js — see the note in recheck.js. Re-deriving them
   from CREDITS produced invalid SPARQL once CREDITS became pairs. */
const LANGS = 'en,fr,de,it,es,pt,nl,sv,da,no,fi,is,pl,cs,sk,hu,ro,bg,sr,hr,sl,uk,ru,el,tr,he,ar,fa,hi,bn,ta,te,ml,kn,mr,ur,th,vi,id,ms,ja,ko,zh,ca,eu,gl,et,lv,lt,ga,cy,sq,mk,ka,hy,az,kk,uz,af,sw,yi,la';

if (!process.env.TMDB_KEY) { console.error('Set TMDB_KEY first.'); process.exit(1); }

const survivorQuery = film => `
SELECT ?p WHERE {
  VALUES ?prop { ${VALUES} }
  wd:${film} ?prop ?p .
  FILTER NOT EXISTS { ?p wdt:P570 ?d }
} LIMIT 1`;

const detailQuery = film => `
SELECT ?fLabel (SAMPLE(?y) AS ?year) (COUNT(DISTINCT ?cm) AS ?cast)
       (MAX(?dv) AS ?wrapped) WHERE {
  wd:${film} wdt:P161 ?cm . ?cm wdt:P570 ?dv .
  OPTIONAL { wd:${film} wdt:P577 ?rd . BIND(YEAR(?rd) AS ?y) }
  BIND(wd:${film} AS ?f)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${LANGS}". }
} GROUP BY ?fLabel`;

const lastQuery = film => `
SELECT ?p ?pLabel ?dod ?charLabel WHERE {
  VALUES ?prop { ${VALUES} }
  wd:${film} ?prop ?p . ?p wdt:P570 ?dod .
  OPTIONAL { wd:${film} p:P161 ?st . ?st ps:P161 ?p . ?st pq:P453 ?char }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${LANGS}". }
} ORDER BY DESC(?dod) LIMIT 1`;

/* Whether the picture is still closed, asked the same way everywhere else
   asks it. This file used to carry its own copy — and its own version of
   the bug, treating anyone Wikidata couldn't resolve as dead. */
async function stillClosed(film, tmdbId) {
  const wd = await sparql(survivorQuery(film)).catch(() => null);
  if (wd === null || wd.length) return false;
  if (!tmdbId) return true;

  /* Not `alive.length === 0`. This files entries into the Vault, so an
     empty survivor list from a test that never ran would recover a picture
     on the strength of a failed request. `ok` is the difference, and every
     other caller now reads it. */
  const { alive, ok } = await survivorsViaTmdb(film, tmdbId);
  return ok && alive.length === 0;
}

/* --- go ---------------------------------------------------------------- */

const ids = JSON.parse(await readFile(LIST, 'utf8'));
const archive = await load(paths.archive, []);
const filed = new Set(archive.map(f => f.id));
const todo = ids.filter(id => !filed.has(id));

console.log(`${ids.length} candidate(s), ${todo.length} not already in the vault.\n`);

const recovered = [];
let reopened = 0, failed = 0;

for (let i = 0; i < todo.length; i += CONCURRENCY) {
  const chunk = todo.slice(i, i + CONCURRENCY);

  const results = await Promise.all(chunk.map(async id => {
    try {
      const d = await detailsFor(id, null);
      if (!await stillClosed(id, d.tmdbId)) return { id, skip: 'reopened' };

      const [meta] = await sparql(detailQuery(id));
      const [last] = await sparql(lastQuery(id));
      if (!meta || !last) return { id, skip: 'failed' };

      return {
        id,
        entry: {
          id,
          title: meta.fLabel,
          year: meta.year || null,
          wrapped: meta.wrapped,
          castCount: Number(meta.cast),
          stars: d.stars, fame: d.fame, tmdbId: d.tmdbId,
          type: d.type, country: d.country,
          last: {
            id: qid(last.p), name: last.pLabel, died: last.dod,
            character: last.charLabel || null,
          },
          postedAt: null, postUrl: null, filedOnly: true, recovered: true,
        },
      };
    } catch { return { id, skip: 'failed' }; }
  }));

  for (const r of results) {
    if (r.entry) {
      recovered.push(r.entry);
      console.log(`   + ${r.entry.title} (${r.entry.year || '????'}) — ` +
        `closed by ${r.entry.last.name}, ${longDate(r.entry.last.died)}`);
    } else if (r.skip === 'reopened') reopened++;
    else failed++;
  }
  await sleep(200);
}

console.log(`\n${recovered.length} recovered, ${reopened} had a survivor, ${failed} failed.`);

if (dryRun) { console.log('Dry run — nothing written.'); process.exit(0); }

archive.push(...recovered);
archive.sort((a, b) => (b.wrapped || '').localeCompare(a.wrapped || ''));
await saveArchive( archive);
console.log(`Vault: ${archive.length - recovered.length} → ${archive.length}.`);
