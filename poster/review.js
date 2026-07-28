/* ==========================================================================
   PICTURE WRAP — poster/review.js

   The gate. Nothing reaches Bluesky except through this file, and only
   after you say so.

     node review.js                go through the queue
     node review.js --list         just show what's waiting
     node review.js --dry-run      full run, but never actually posts
     node review.js --archive-only file the queue without posting anything

   Why a human sits here: Wikidata is open to anyone, and a false death
   date produces a confident public announcement that a film's last
   survivor has died. That's the one mistake this project can't take back,
   and it costs you a keystroke to prevent.
   ========================================================================== */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { load, save, paths, longDate, year, detailsFor, compose, groupQueue,
         tmdbCastCount, coverage, sleep, imagesFor, posterFor,
         personContext } from './lib.js';
import { login, post, measure, LIMIT, uploadImage, renderLinks } from './bluesky.js';

const args = process.argv.slice(2);
const listOnly = args.includes('--list');
const dryRun = args.includes('--dry-run');

/* Backfill is history, not news. Announcing that a picture wrapped in 1994
   isn't a feed, it's a bulk import with a megaphone — and the queue proves
   it: of 918 backfilled closings, 13 happened since 2020. This files them
   straight into the vault so the site launches populated, while the feed
   stays reserved for closings that actually just happened. */
const archiveOnly = args.includes('--archive-only');

/* Skips the confirmation prompt. For scripted or unattended runs, since
   readline discards piped input.

   Refused on a real posting run, deliberately. The entire protection this
   project has is that a person looks at each item before it is published;
   a flag that bypasses that is a flag that will eventually get used by
   accident at two in the morning. Allowed only with --dry-run or
   --archive-only, neither of which can publish anything. */
const assumeYes = args.includes('--yes');
if (assumeYes && !dryRun && !archiveOnly) {
  console.error('--yes is only allowed with --dry-run or --archive-only.');
  console.error('A real posting run requires a keystroke per post. That is the point.');
  process.exit(1);
}

const rl = createInterface({ input: stdin, output: stdout });

/* If stdin ends — piped input, or Ctrl-D — treat it as quitting rather
   than crashing. Whatever hasn't been reviewed stays in the queue. */
async function rawAsk(prompt) {
  try {
    return await rl.question(prompt);
  } catch {
    console.log('\n   (input closed)');
    return null;
  }
}

async function ask(prompt) {
  const answer = await rawAsk(prompt);
  return answer === null ? 'q' : answer.trim().toLowerCase();
}


/* --- the post itself --------------------------------------------------- */

function describe(group, i, total) {
  const parts = compose(group);
  const { last, items } = group;

  const shown = parts.map((p, n) =>
    [`   ── ${n + 1}/${parts.length} ${'─'.repeat(34)}  ${measure(p)}/${LIMIT}`,
     renderLinks(p).split('\n').map(l => `   │ ${l}`).join('\n')].join('\n')).join('\n');

  const checks = items.map(it => {
    const c = coverage(it.castCount, it.tmdbCast);
    const complete = c === null
      ? `${it.castCount} cast on record (TMDB not checked)`
      : `${it.castCount} of TMDB's ${it.tmdbCast} cast — ${Math.round(c * 100)}%` +
        (c < 0.5 ? '  <-- THIN' : '');
    return `   · ${it.title}${it.stars?.length ? ` — with ${it.stars.join(', ')}` : ''}` +
      `\n     ${complete}` +
      `\n     https://www.wikidata.org/wiki/${it.id}`;
  });

  /* Watcher items act on a newsroom report, not on Wikidata. They must
     never slip past unnoticed — this is the one case where approving
     without checking could publish a death that hasn't happened. */
  const provisional = items.some(it => it.provisional);
  const warning = provisional ? [
    ``,
    `   !! UNCONFIRMED — reported by ${items[0].source || 'a watched account'},`,
    `      not yet recorded in Wikidata. Verify before approving.`,
  ] : [];

  return [
    ``,
    `═════════════════════════════════════════════  ${i + 1} of ${total}`,
    ...warning,
    shown,
    ``,
    `   ${items.length} picture(s)`,
    `   ${last.name}: https://www.wikidata.org/wiki/${last.id}`,
    ...checks,
    ``,
  ].join('\n');
}


/* --- go ---------------------------------------------------------------- */

const queue = await load(paths.queue, []);
const archive = await load(paths.archive, []);
const rejected = await load(paths.state, { seen: [] }).then(s => s.rejected ?? []);

if (!queue.length) {
  console.log('Nothing waiting.');
  rl.close();
  process.exit(0);
}

/* Oldest closing first, so a backlog reads chronologically. */
const groups = groupQueue(queue)
  .sort((a, b) => (a.last.died || '').localeCompare(b.last.died || ''));

if (listOnly) {
  console.log(`${queue.length} picture(s) in ${groups.length} post(s):\n`);
  for (const g of groups) {
    console.log(`  ${g.last.name} — ${longDate(g.last.died)}`);
    for (const item of g.items) {
      console.log(`      ${(item.year || '????')}  ${item.title}`);
    }
    console.log('');
  }
  rl.close();
  process.exit(0);
}

/* A film belongs in the vault once. The seed archive, the backfill and the
   daily sweep can all reach the same picture — Casablanca was in the seed
   file AND the queue — and state.json doesn't know about anything written
   by hand. Check the archive itself. */
const filed = new Set(archive.map(f => f.id));

function fileAway(entry) {
  if (filed.has(entry.id)) return false;
  filed.add(entry.id);
  archive.push(entry);
  return true;
}

/* Bulk filing: parallel lookups, and checkpointed so an interrupted run
   keeps its work.

   The first big gulp did neither — 2,111 films, twenty minutes, one write
   at the very end, and a Ctrl-C at minute nineteen would have thrown all
   of it away. That was an oversight rather than a decision. The backfill
   itself has always checkpointed per year, which is why --resume works.

   Irrelevant in steady state, where a day's sweep is one or two pictures.
   It matters for the passes still ahead: the silent era, and television. */
const CONCURRENCY = 4;      /* parallel detailsFor lookups   */
const CHECKPOINT  = 200;    /* films between saves           */

if (archiveOnly) {
  const work = groups.flatMap(g => g.items.map(item => ({ item, closer: g.last.id })));
  console.log(`${work.length} picture(s) in ${groups.length} closing(s).`);
  console.log('These will be filed in the vault. Nothing will be posted.\n');

  /* --dry-run is documented as "posts nothing, writes nothing", and on
     this path it wrote. It guarded the posting branch only, so
     `--archive-only --dry-run` filed the queue into the archive and
     cleared it — the one flag combination a person reaches for precisely
     because they don't yet trust what is about to happen.

     Same shape as everything else here: a thing that reports safety
     without providing it. */
  if (dryRun) {
    const already = work.filter(w => filed.has(w.item.id)).length;
    console.log(`   Dry run — nothing written. ${work.length - already} would be filed` +
                `${already ? `, ${already} already in the vault` : ''}.`);
    rl.close();
    process.exit(0);
  }

  if (!assumeYes) {
    const ok = await ask('   File them all? [y/N] > ');
    if (ok !== 'y') { console.log('   Left alone.'); rl.close(); process.exit(0); }
  }

  let added = 0, skipped = 0, sinceSave = 0;

  const checkpoint = async from => {
    archive.sort((a, b) => (b.wrapped || '').localeCompare(a.wrapped || ''));
    await save(paths.archive, archive);
    /* Whatever hasn't been filed yet stays queued, so a killed run can be
       restarted and pick up exactly where it stopped. */
    await save(paths.queue, work.slice(from).map(w => w.item));
    sinceSave = 0;
  };

  for (let i = 0; i < work.length; i += CONCURRENCY) {
    const chunk = work.slice(i, i + CONCURRENCY);

    /* Enrich the chunk together. Wikidata is a volunteer service, so four
       at a time with a pause between chunks — not two thousand at once. */
    await Promise.all(chunk.map(async ({ item, closer }) => {
      if (filed.has(item.id)) return;
      if (!item.stars || !item.type) {
        Object.assign(item, await detailsFor(item.id, closer));
      }
    }));

    for (const { item } of chunk) {
      if (filed.has(item.id)) { skipped++; continue; }
      fileAway({
        id: item.id, title: item.title, year: item.year, wrapped: item.wrapped,
        castCount: item.castCount, stars: item.stars || [], fame: item.fame ?? 0,
        tmdbId: item.tmdbId ?? null, unknownCount: item.unknownCount ?? null,
        type: item.type ?? null, country: item.country ?? null,
        last: item.last, postedAt: null, postUrl: null, filedOnly: true,
        /* Provenance. Every one of these was set by the finder and then
           dropped here, because both filing paths build an entry from a
           fixed field list and neither list named them.

           It cost real information. 3,586 entries came out of a backfill
           and twelve say so — which is why `backfilled` could not be used
           to check the archive's own composition. `unverified` marks an
           entry no second database could confirm, and silently losing it
           makes an unverifiable row identical to a corroborated one.
           `provisional` means a newsroom said it and Wikidata has not
           caught up.

           Undefined rather than false when absent, so the archive stays
           readable — a flag is present when it means something. */
        ...(item.backfilled  ? { backfilled: true }  : {}),
        ...(item.provisional ? { provisional: true } : {}),
        ...(item.unverified  ? { unverified: true }  : {}),
      });
      added++; sinceSave++;
    }

    if (sinceSave >= CHECKPOINT) {
      await checkpoint(i + chunk.length);
      console.log(`   ${added}/${work.length} filed (saved)`);
    }

    await sleep(200);
  }

  await checkpoint(work.length);
  if (skipped) console.log(`   ${skipped} already in the vault, skipped.`);
  console.log(`\n${archive.length} in the vault. Queue cleared. Nothing posted.`);
  rl.close();
  process.exit(0);
}

let session = null;
if (!dryRun) {
  try {
    session = await login();
    console.log(`Signed in as @${session.handle}.`);
  } catch (err) {
    console.error(err.message);
    rl.close();
    process.exit(1);
  }
} else {
  console.log('Dry run — nothing will be posted.');
}

const keep = [];
let posted = 0;

for (const [i, group] of groups.entries()) {
  /* Items queued before stars were captured get them now, so an existing
     backlog doesn't have to be thrown away and re-swept. */
  for (const item of group.items) {
    if (!item.stars) Object.assign(item, await detailsFor(item.id, group.last.id));
    if (item.tmdbCast === undefined) {
      item.tmdbCast = await tmdbCastCount(item.tmdbId);
    }
    /* Fetched once, here: compose needs it to decide the order, and
       imagesFor needs the URL. Asking TMDB twice for the same poster was
       both slower and a way for the two to disagree. */
    if (item.poster === undefined) {
      item.poster = await posterFor(item.tmdbId);
    }
  }

  if (!group.last.context) {
    group.last.context = await personContext(group.last.id, group.last.died, group.items.map(i => i.id));
  }

  console.log(describe(group, i, groups.length));

  const answer = (assumeYes && dryRun)
    ? 'a'
    : await ask('   [p]ost it   [s]kip for now   [n]ever   [e]dit   [q]uit  > ');

  /* Accept whole words as well as letters. "post" and "skip" are what a
     person types when they haven't memorised a keyboard shortcut. */
  const said = { p: 'a', post: 'a', a: 'a', approve: 'a',
                 s: 's', skip: 's', '': 's',
                 n: 'r', never: 'r', r: 'r', reject: 'r',
                 e: 'e', edit: 'e',
                 q: 'q', quit: 'q', stop: 'q' }[answer] ?? answer;

  if (said === 'q') {
    /* Everything unvisited stays queued. */
    for (const g of groups.slice(i)) keep.push(...g.items);
    break;
  }

  if (said === 's') { keep.push(...group.items); continue; }

  if (said === 'r') {
    for (const item of group.items) {
      rejected.push({ id: item.id, title: item.title, at: new Date().toISOString() });
    }
    console.log(`   rejected ${group.items.length} — they won't be offered again.`);
    continue;
  }

  let text = compose(group);

  if (said === 'e') {
    /* Edit posts the thread as a single post of your own words. Use \\n
       for line breaks. */
    const edited = await rawAsk('\n   Replacement post (blank keeps the thread):\n   > ');
    if (edited === null) { for (const g of groups.slice(i)) keep.push(...g.items); break; }
    if (edited.trim()) text = [edited.replace(/\\n/g, '\n')];
    const over = text.filter(p => measure(p) > LIMIT);
    if (over.length) {
      console.log(`   Too long (${measure(over[0])}/${LIMIT}). Kept in the queue.`);
      keep.push(...group.items);
      continue;
    }
    const ok = await ask('   Post this? [y/N] > ');
    if (ok !== 'y') { keep.push(...group.items); continue; }
  } else if (said !== 'a') {
    console.log('   Not a choice — keeping it queued.');
    keep.push(...group.items);
    continue;
  }

  try {
    /* Upload the face and the posters, then post. Anything that fails to
       upload is simply left out — a post without its pictures is still
       true, and a failed image should never block a closing. */
    let blobs = [];
    if (!dryRun) {
      const wanted = await imagesFor(group);
      blobs = [];
      for (const set of wanted) {
        const uploaded = [];
        for (const img of set) {
          const blob = await uploadImage(img.url, session);
          if (blob) uploaded.push({ alt: img.alt, image: blob });
        }
        blobs.push(uploaded);
      }
      const n = blobs.reduce((a, b) => a + b.length, 0);
      if (n) console.log(`   ${n} image(s) uploaded`);
    }

    let url = null;
    if (dryRun) {
      console.log(`   [dry run] would have posted ${text.length} skeet(s) covering ${group.items.length} picture(s).`);
    } else {
      ({ url } = await post(text, session, blobs));
      console.log(`   posted → ${url}`);
    }

    /* One post, but each picture is its own archive entry — the archive
       is a list of films, and they share a post URL. */
    for (const item of group.items) {
      fileAway({
        id: item.id,
        title: item.title,
        year: item.year,
        wrapped: item.wrapped,
        castCount: item.castCount,
        stars: item.stars || [],
        fame: item.fame ?? 0,
        /* Both of these used to be dropped on the posting path and kept on
           the archive-only path. Without tmdbId, recheck.js cannot verify
           an entry at all — so the pictures we actually announced were the
           only ones that could never be re-tested. Exactly backwards. */
        tmdbId: item.tmdbId ?? null,
        unknownCount: item.unknownCount ?? null,
        /* Provenance. Every one of these was set by the finder and then
           dropped here, because both filing paths build an entry from a
           fixed field list and neither list named them.

           It cost real information. 3,586 entries came out of a backfill
           and twelve say so — which is why `backfilled` could not be used
           to check the archive's own composition. `unverified` marks an
           entry no second database could confirm, and silently losing it
           makes an unverifiable row identical to a corroborated one.
           `provisional` means a newsroom said it and Wikidata has not
           caught up.

           Undefined rather than false when absent, so the archive stays
           readable — a flag is present when it means something. */
        ...(item.backfilled  ? { backfilled: true }  : {}),
        ...(item.provisional ? { provisional: true } : {}),
        ...(item.unverified  ? { unverified: true }  : {}),
        type: item.type ?? null,
        country: item.country ?? null,
        last: item.last,
        postedAt: new Date().toISOString(),
        postUrl: url,
      });
    }
    posted += group.items.length;

    /* A beat between threads. Timestamps are millisecond-precise so the
       order would hold regardless, but a dozen threads landing in the same
       second reads as a dump rather than a feed — and it keeps well clear
       of Bluesky's rate limits. */
    if (!dryRun) await sleep(4000);
  } catch (err) {
    console.log(`   failed: ${err.message} — keeping them queued.`);
    keep.push(...group.items);
  }
}

rl.close();

/* archive.json is what the website reads: newest closing first. */
archive.sort((a, b) => (b.wrapped || '').localeCompare(a.wrapped || ''));

if (!dryRun) {
  await save(paths.queue, keep);
  await save(paths.archive, archive);

  const state = await load(paths.state, { seen: [] });
  state.rejected = rejected;
  await save(paths.state, state);
}

console.log(`\n${posted} posted, ${keep.length} still queued, ${archive.length} in the archive.`);
if (dryRun) console.log('Dry run — no files were changed.');
