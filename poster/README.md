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
export BSKY_HANDLE="picturewrap.bsky.social"
export BSKY_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export PW_SITE="https://picturewrap.studio"     # used in the post link
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
