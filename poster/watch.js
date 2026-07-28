/* ==========================================================================
   PICTURE WRAP — poster/watch.js

   Listens to Bluesky for death reports from newsrooms you trust, works out
   whether that death closes a picture, drafts the post, and pushes you an
   alert. It never posts. review.js is still the only thing that does.

     node watch.js                 run it (stays connected)
     node watch.js --test "name"   pretend that name was just reported

   Why this exists: Wikidata records a death hours to days after the fact,
   so the daily sweep is always behind the news. This isn't — because the
   wrap test doesn't actually need the new death date. Everyone ELSE on the
   picture is already recorded as dead; the only missing fact is the one
   the newsroom just reported.

   What it produces is PROVISIONAL. A report can be wrong, and this acts on
   an unverified sentence from a stranger's post. Items land in the queue
   flagged `provisional`, review.js shows them with a warning, and nothing
   reaches Bluesky without you.

   Configure the newsrooms — anything else is noise:

     export PW_WATCH="apnews.com,variety.com,hollywoodreporter.com"
     export PW_NOTIFY="https://ntfy.sh/picture-wrap-a7f3k2"
   ========================================================================== */

import {
  sparql, qid, load, save, paths,
  wouldWrapQuery, resolvePerson, detailsFor, survivorsViaTmdb,
} from './lib.js';

const JETSTREAM = 'wss://jetstream2.us-east.bsky.network/subscribe';

const HANDLES = (process.env.PW_WATCH || '')
  .split(',').map(s => s.trim()).filter(Boolean);

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);


/* --- alerting ---------------------------------------------------------- */

async function notify(title, message) {
  const url = process.env.PW_NOTIFY;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { Title: title, Priority: 'high', 'Content-Type': 'text/plain' },
      body: message,
    });
  } catch (err) {
    log('  notification failed:', err.message);
  }
}


/* --- reading a post ---------------------------------------------------- */

/* Cheap gate first. Most posts from a newsroom aren't obituaries, and we
   don't want to hit Wikidata for every headline about a box office. */
const DEATH = /\b(dies|died|dead|has died|passed away|obituary|obit)\b/i;

/* Names, roughly: runs of two to four capitalised words. Deliberately
   over-generous — resolvePerson and the wrap query do the real filtering,
   and a false candidate costs one query that returns nothing. */
function candidateNames(text) {
  const cleaned = text.replace(/[^\p{L}\p{N}\s'’.-]/gu, ' ');
  const matches = cleaned.match(
    /\b([A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+){1,3})\b/gu) || [];

  const skip = /^(The|A|An|This|That|In|On|At|Of|And|But|For|Breaking|Read|More|Watch|Full|Story|News|Exclusive|Update|Hollywood|Variety|Deadline)\b/;
  return [...new Set(matches)]
    .filter(n => !skip.test(n))
    .slice(0, 6);
}


/* --- the check --------------------------------------------------------- */

const checked = new Set();   /* names already looked at this session */

async function consider(name, source) {
  if (checked.has(name.toLowerCase())) return;
  checked.add(name.toLowerCase());

  const person = await resolvePerson(name);
  if (!person) return;

  const rows = await sparql(wouldWrapQuery(person));
  /* No completeness filter. If a picture closes, you want to know — the
     post says how many names it rests on, and review.js shows TMDB
     coverage. Only the backfill trims, and only to save hours of queries. */
  const films = rows.map(r => ({ ...r, id: qid(r.film) }));

  if (!films.length) return;

  const state = await load(paths.state, { seen: [] });
  const fresh = films.filter(f => !state.seen.includes(f.id));
  if (!fresh.length) return;

  const queue = await load(paths.queue, []);
  const today = new Date().toISOString();
  let queued = 0;

  for (const film of fresh) {
    state.seen.push(film.id);

    const details = await detailsFor(film.id, person);

    /* Wikidata says everyone else on this picture is dead. Ask TMDB
       whether Wikidata knew the whole cast — without this the watcher
       drafts posts about pictures that still have living people, which is
       the one error this project can't take back. */
    const alive = await survivorsViaTmdb(film.id, details.tmdbId);
    if (alive.length) {
      log(`      skip  ${film.filmLabel} — still living: ${alive.slice(0, 3).join(', ')}`);
      continue;
    }
    queued++;

    queue.push({
      id: film.id,
      title: film.filmLabel,
      year: film.year || null,
      wrapped: today,
      castCount: Number(film.castCount),
      ...details,
      last: { id: person, name, died: today, character: null },
      foundAt: today,

      /* The load-bearing flag. Wikidata has NOT confirmed this death; a
         newsroom said so and we believed it enough to draft a post.
         review.js must show this, and you must check it. */
      provisional: true,
      source,
    });
  }

  await save(paths.state, state);
  await save(paths.queue, queue);

  if (!queued) return;
  log(`*** ${name} (${person}) — ${queued} picture(s) closed`);

  await notify(
    `${name} — ${queued} picture(s)`,
    `${name} reported dead.\n\n` +
    fresh.map(f => `· ${f.filmLabel}${f.year ? ` (${f.year})` : ''}`).join('\n') +
    `\n\nUNCONFIRMED — ${source}\nRun: node review.js`);
}


/* --- the stream -------------------------------------------------------- */

async function resolveHandles() {
  const dids = [];
  for (const handle of HANDLES) {
    try {
      const res = await fetch(
        'https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=' +
        encodeURIComponent(handle));
      if (!res.ok) { log(`  couldn't resolve ${handle} (${res.status})`); continue; }
      const { did } = await res.json();
      dids.push(did);
      log(`  watching ${handle}`);
    } catch (err) {
      log(`  couldn't resolve ${handle}: ${err.message}`);
    }
  }
  return dids;
}

function connect(dids) {
  const params = new URLSearchParams();
  params.append('wantedCollections', 'app.bsky.feed.post');
  /* Server-side filtering. Without it we'd be reading every post on
     Bluesky — about 37 a second — to find one obituary a week. */
  for (const did of dids) params.append('wantedDids', did);

  const ws = new WebSocket(`${JETSTREAM}?${params}`);

  ws.onopen = () => log('connected');

  ws.onmessage = async event => {
    let text, author;
    try {
      const data = JSON.parse(event.data);
      text = data.commit?.record?.text;
      author = data.did;
      if (data.commit?.operation !== 'create' || !text) return;
    } catch { return; }

    if (!DEATH.test(text)) return;
    log(`report: ${text.slice(0, 90).replace(/\n/g, ' ')}`);

    for (const name of candidateNames(text)) {
      try {
        await consider(name, `bsky:${author}`);
      } catch (err) {
        log(`  ${name}: ${err.message}`);
      }
    }
  };

  ws.onerror = e => log('socket error:', e.message || e.type);

  /* Jetstream drops connections routinely. Reconnect with a small delay
     rather than dying quietly at 3am. */
  ws.onclose = () => {
    log('disconnected — reconnecting in 10s');
    setTimeout(() => connect(dids), 10_000);
  };
}


/* --- go ---------------------------------------------------------------- */

const testIndex = process.argv.indexOf('--test');
if (testIndex !== -1) {
  const name = process.argv[testIndex + 1];
  if (!name) { console.error('Usage: node watch.js --test "Catherine Deneuve"'); process.exit(1); }
  log(`testing: ${name}`);
  await consider(name, 'manual test');
  log('done');
  process.exit(0);
}

if (!HANDLES.length) {
  console.error('Set PW_WATCH to the newsroom handles to follow, e.g.\n' +
    '  export PW_WATCH="apnews.com,variety.com"');
  process.exit(1);
}

const dids = await resolveHandles();
if (!dids.length) { console.error('No handles resolved.'); process.exit(1); }
connect(dids);
