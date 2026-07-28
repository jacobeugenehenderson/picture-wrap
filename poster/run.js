/* ==========================================================================
   PICTURE WRAP — poster/run.js

   The sweep. Finds films that have closed and puts them in the queue.
   Posts nothing. Run it from cron as often as you like:

     node run.js                 look back 3 days (the daily default)
     node run.js --days 1        tight window, for an hourly cron
     node run.js --days 30       wider window, e.g. after an outage
     node run.js --backfill 1930-1965
     node run.js --backfill 1930-1965 --resume

   The event-driven path is cheap: only people who died recently can have
   closed anything, so we check them rather than sweeping every film.
   ========================================================================== */

import {
  sparql, sleep, qid, load, save, paths, MIN_CAST, longDate, unnamed, detailsFor, survivorsViaTmdb,
  recentDeathsQuery, wrappedFilmsQuery, lastPersonQuery, candidatesByYearQuery,
} from './lib.js';

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const value = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};

const log = (...a) => console.log(...a);

/* Optional push, so you hear about a closing without watching a log.

   Set PW_NOTIFY to any URL that accepts a plain-text POST body. ntfy.sh
   needs no account and no backend — pick an obscure topic name, install
   their app, subscribe to it:

     export PW_NOTIFY="https://ntfy.sh/picture-wrap-a7f3k2"

   A Discord or Slack webhook works too, though those expect JSON; ntfy is
   the one that takes raw text. Unset, nothing is sent and nothing breaks. */
async function notify(message) {
  const url = process.env.PW_NOTIFY;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Title': 'Picture Wrap', 'Content-Type': 'text/plain' },
      body: message,
    });
  } catch (err) {
    log(`      !  notification failed: ${err.message}`);
  }
}


/* --- shared: test one person, queue whatever they closed --------------- */

async function harvest(person, state, queue) {
  const found = await sparql(wrappedFilmsQuery(qid(person.p)));
  const fresh = [];

  for (const film of found) {
    const id = qid(film.film);

    if (state.seen.includes(id)) continue;

    /* Seen means considered, not announced. Recording it here is what
       stops a thin film being re-offered on every future sweep. */
    state.seen.push(id);

    if (unnamed(film.filmLabel)) {
      log(`      skip  ${id} — no name in any language`);
      continue;
    }

    /* An editorial floor, and the sweep needs one. Without it a 45-day
       window queued 540 films, 397 of them with ZERO cast on record —
       documentaries and concert films where Wikidata lists a director and
       nobody else, "closing" the moment that one person died.

       Nothing false is published either way; the post states its own
       basis. But a queue that size is a queue nobody reads, and the whole
       protection here is that a human looks. */
    if (Number(film.castCount) < MIN_CAST) {
      log(`      skip  ${film.filmLabel} — ${film.castCount} cast on record`);
      continue;
    }

    fresh.push({
      id,
      title: film.filmLabel,
      year: film.year || null,
      wrapped: film.wrapped,
      castCount: Number(film.castCount),
      last: { id: qid(person.p), name: person.pLabel, died: person.dod },
      foundAt: new Date().toISOString(),
    });
  }

  /* Always re-ask from the film's side. It confirms who actually closed it
     — usually the trigger person, but not always — and it's the only way
     to pick up the character they played. */
  for (const item of fresh) {
    const [actual] = await sparql(lastPersonQuery(item.id));
    if (actual) {
      item.last = {
        id: qid(actual.p),
        name: actual.pLabel,
        died: actual.dod,
        character: actual.charLabel || null,
      };
    }
    Object.assign(item, await detailsFor(item.id, item.last.id));

    /* Wikidata says everyone credited has died. Ask TMDB whether Wikidata
       knew the whole cast — 14 of 60 candidates failed this on the first
       real sweep. */
    const alive = await survivorsViaTmdb(item.id, item.tmdbId);
    if (alive.length) {
      log(`      skip  ${item.title} — still living: ${alive.slice(0, 3).join(', ')}`);
      continue;
    }
    await sleep(250);
    queue.push(item);
    log(`   +  ${item.title}${item.year ? ` (${item.year})` : ''} — closed by ` +
        `${item.last.name}, ${longDate(item.last.died)}`);
  }

  return fresh.length;
}


/* --- the daily sweep --------------------------------------------------- */

async function sweep(days) {
  const state = await load(paths.state, { seen: [], lastRun: null });
  const queue = await load(paths.queue, []);

  log(`Looking back ${days} day(s) for deaths with screen credits…`);
  const deaths = await sparql(recentDeathsQuery(days));
  log(`${deaths.length} to check.\n`);

  let added = 0;
  for (const [i, person] of deaths.entries()) {
    log(`[${i + 1}/${deaths.length}] ${person.pLabel} — ${longDate(person.dod)}`);
    try {
      added += await harvest(person, state, queue);
    } catch (err) {
      /* One bad person shouldn't end the run. They'll be re-checked
         tomorrow, because we only record films, never people. */
      log(`      !  ${err.message}`);
    }
    await sleep(400);
  }

  state.lastRun = new Date().toISOString();
  await save(paths.state, state);
  await save(paths.queue, queue);

  log(`\n${added} film(s) added. ${queue.length} awaiting review.`);
  if (queue.length) log(`Run:  node review.js`);

  /* Only speak when something new turned up. An hourly cron that pings you
     hourly is a cron you turn off. */
  if (added) {
    const names = [...new Set(queue.slice(-added).map(i => i.last.name))];
    await notify(
      `${added} picture(s) wrapped.\n` +
      `${names.join(', ')}\n\n` +
      `Run: node review.js`);
  }
}


/* --- backfill ---------------------------------------------------------- */

/* Two passes, because the direct question is too expensive to ask.
   Asking "which films of 1935 have nobody left, counting crew" times out
   at 65 seconds. So: a cheap cast-only rollup per year to find candidates,
   then the exact crew-inclusive test on each candidate. Slower in total
   but every individual query is small.

   Expect roughly an hour per few decades. --resume picks up where it
   stopped; state.json makes re-runs cheap regardless. */
async function backfill(range) {
  const [from, to] = range.split('-').map(Number);
  if (!from || !to || to < from) {
    log('Usage: --backfill 1930-1965');
    process.exit(1);
  }

  const state = await load(paths.state, { seen: [], lastRun: null });
  const queue = await load(paths.queue, []);
  const done = state.yearsDone ?? [];

  for (let y = from; y <= to; y++) {
    if (flag('--resume') && done.includes(y)) { log(`${y} — done already`); continue; }

    log(`\n${y} — finding candidates…`);
    let rows;
    try {
      rows = await sparql(candidatesByYearQuery(y));
    } catch (err) {
      log(`  !  ${y} failed (${err.message}) — moving on, re-run with --resume`);
      continue;
    }

    const candidates = rows.filter(r =>
      r.cast === r.dead && Number(r.cast) >= MIN_CAST && !state.seen.includes(qid(r.film)));

    log(`  ${rows.length} films with cast data, ${candidates.length} worth the exact test`);

    for (const c of candidates) {
      const id = qid(c.film);
      try {
        /* Re-ask properly, from the film's side, with crew counted. */
        const [actual] = await sparql(lastPersonQuery(id));
        const confirm = await sparql(wrappedFilmsQuery(actual ? qid(actual.p) : id));
        const match = confirm.find(f => qid(f.film) === id);

        state.seen.push(id);

        if (!match) continue;                                  /* crew still living */
        if (Number(match.castCount) < MIN_CAST) continue;
        if (unnamed(match.filmLabel)) continue;                /* nothing to call it */

        queue.push({
          id,
          title: match.filmLabel,
          year: match.year || String(y),
          wrapped: match.wrapped,
          castCount: Number(match.castCount),
          last: {
            id: qid(actual.p),
            name: actual.pLabel,
            died: actual.dod,
            character: actual.charLabel || null,
          },
          ...(await detailsFor(id, qid(actual.p))),
          foundAt: new Date().toISOString(),
          backfilled: true,
        });
        log(`   +  ${match.filmLabel} — closed by ${actual.pLabel}, ${longDate(actual.dod)}`);
      } catch (err) {
        log(`   !  ${id}: ${err.message}`);
      }
      await sleep(300);
    }

    done.push(y);
    state.yearsDone = done;
    await save(paths.state, state);
    await save(paths.queue, queue);
  }

  log(`\nBackfill finished. ${queue.length} awaiting review.`);
}


/* --- go ---------------------------------------------------------------- */

const range = value('--backfill', null);

try {
  if (range) await backfill(range);
  else await sweep(Number(value('--days', 3)));
} catch (err) {
  console.error('\nFailed:', err.message);
  process.exit(1);
}
