# Picture Wrap — the poster

Finds films whose last credited person has died, holds them for your
approval, and posts the approved ones to Bluesky.

Nothing here talks to the website. The only thing they share is
`archive.json`, which this writes and the site reads.

Node 18+. No dependencies.

---

## The two commands

```sh
node run.js          # find closings, add to the queue. Posts nothing.
node review.js       # go through the queue, approve, post.
```

`run.js` is safe to automate. `review.js` is not automated on purpose.

---

## Setup

Get an **app password** from Bluesky (Settings → Privacy and security →
App passwords). Not your account password — an app password can be revoked
on its own.

```sh
export BSKY_HANDLE="picture-wrap.bsky.social"
export BSKY_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export PW_SITE="https://picture-wrap.com"       # used in the post link
```

The website fetches `archive.json` from its own directory. Either copy it
across after each review, or write it there directly:

```sh
export PW_ARCHIVE="/path/to/site/archive.json"
```

Put a real contact address in the `AGENT` string at the top of `lib.js`.
Wikidata uses it to reach you rather than block you.

---

## Daily

```cron
0 9 * * *   cd /path/to/poster && /usr/local/bin/node run.js >> sweep.log 2>&1
```

Then, whenever you feel like it:

```sh
node review.js --list      # what's waiting
node review.js             # work through it
node review.js --dry-run   # rehearse; changes nothing, posts nothing
```

At each item: `[a]pprove` `[s]kip` `[r]eject` `[e]dit` `[q]uit`.
Skip leaves it for later. Reject removes it permanently. Quit is safe —
anything unreviewed stays queued.

Each item shows Wikidata links for the film and the person. **Open them.**
That is the entire point of the queue.

---

## Backfill

Films that closed before you switched this on will never fire an event —
there's no future death to react to. So run once:

```sh
node run.js --backfill 1920-1970
node run.js --backfill 1920-1970 --resume    # after an interruption
```

Two passes per year: a cheap cast-only sweep to find candidates, then the
exact crew-inclusive test on each one. Roughly an hour per few decades.
The direct question — "which films of 1935 have nobody left, counting
crew" — times out at 65 seconds, which is why it's done this way.

Expect a large queue afterwards. `--list` first.

---

## Files

| | |
|---|---|
| `state.json` | every film already considered, plus rejections. Prevents repeats. |
| `queue.json` | awaiting your approval |
| `archive.json` | approved and posted — **this is what the website reads** |

`state.json` records a film when it's *considered*, not when it's posted.
That's deliberate: a film skipped for a thin cast record shouldn't come
back every single day.

---

## Why a human approves

Wikidata is open to anyone. A vandalised or mistaken death date turns into
a confident public statement that a film's last survivor has died — about
a real person, possibly a living one, under your name.

It's the one error this project can't walk back, and one keystroke stops
it. The gate is not a placeholder for automation later.

---

## Rules the code enforces

**A film needs at least 5 cast members on record** (`MIN_CAST` in
`lib.js`) before it can be announced. Wikidata lists exactly one cast
member for some real features — those aren't films that closed, they're
films nobody finished entering.

**Crew counts.** Director, writing, camera, music, producer, editor,
production and costume design all count toward whether a film has closed.
Without them, four of six test cases were false positives — a picture is
not finished while its director is alive.

**Below-the-line crew doesn't exist** in any free database. "Everyone"
always means everyone recorded, and the site's colophon says so.

Keep `CREDITS` and `MIN_CAST` in step with `app.js` in the site root.


## The rest of the scripts

`run.js` and `review.js` are covered above. These are the others, all of
which have run against live data.

### `watch.js` — breaking news

Streams posts from eight newsrooms on Bluesky (`PW_WATCH`), extracts names
from anything that reads like a death notice, resolves them, and drafts
ahead of Wikidata. Drafts land in the queue flagged `provisional`.

It has never caught a real death. The first one is worth being present
for — the name extraction is crude and an unverified newsroom claim is a
weaker source than anything else here.

```sh
node watch.js            # leave running
node watch.js --test     # replay recent posts and exit
```

### `preview.js` — the queue as a page

Renders `queue.json` as HTML with real posters and portraits, so you can
look at a sweep before deciding anything. Writes `preview.html`, which is
gitignored.

### `recheck.js` — re-test the Vault

Re-runs verification over every filed entry and removes any with a
survivor. **Deletes Vault entries**, so it backs up to
`archive.json.before-recheck` first and clears reopened ids from
`state.seen` — otherwise a reopened picture could never close again.

```sh
node recheck.js --dry-run --limit 40    # always start here
node recheck.js
```

**Do not run this before reading HANDOFF.md.** As of 28 July 2026 it
reopens ~49% of the Vault, and most of that is a known bug, not a finding.

### `recover.js` — re-file what a bug dropped

One-shot repair for the 319 films an English-only label query silently
deleted. Reads a list of ids from `/tmp/naming-losses.json`. Kept because
the failure mode it fixes could recur.

### `coverage.js` — how complete is the roster

Compares Wikidata's cast list against TMDB's per film. Measured across
2,415 entries: median 64%, 919 under half.

### `backfill-tmdbids.js` — fill in missing ids

An entry with no `tmdbId` cannot be verified at all — `recheck.js` passes
it straight through as closed. This fills the gap from Wikidata `P4947`
first, then TMDB search matched on title **and** release year, because a
wrong id is worse than none.

Recovered 66 of 162 on its first run. The other 96 have no TMDB presence
and stay honestly unverifiable.

### `check.js` — credentials

Logs in and prints the handle. Posts nothing. Run it after changing an app
password.

## What can post

**Only `review.js`, and only with a human keypress.** Everything else
writes to `queue.json` or `archive.json`. This is the property that makes
it safe to leave the sweep on a cron and the watcher running overnight.
