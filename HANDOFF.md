# Handoff — 28 July 2026

Read this before touching the Vault. Nothing is half-written; everything
below is a clean state.

## Where things stand

| | |
|---|---|
| `archive.json` | **3,640** — every row judged by one implementation |
| `poster/queue.json` | **1** — a live closing found this evening, unreviewed |
| Unverifiable | **113** rows have no TMDB id and never got a second opinion |
| Bluesky | 26 posts; **37** of the 46 entries survive |
| Live site | current with `main`, `?v=21` |
| Working tree | clean, pushed |

Nothing is running unless a backfill was left going. No process holds a
lock.

## What this day was

One bug, found six times in six disguises: **silence read as an answer.**

Verification asked only Wikidata whether people were alive and counted
everyone it couldn't place as dead. It stopped at Wikidata even when TMDB
held the death date. It missed people with no `P4985` link entirely. It
read a cataloguer's `1920-01-01` placeholder as a pulse. It let whichever
row SPARQL happened to return first decide a contested identifier. And
then, having been fixed, its *callers* went on treating a lookup that
never ran as a lookup that found nobody.

The last of those was the dangerous one: a TMDB outage during a re-check
would have stamped untested rows as verified and overwritten their
unknown counts with zero. Measured on 25 entries with TMDB unreachable —
before, "21 still closed"; after, "0 still closed, 25 could not be
checked".

Two structural fixes came out of it:

- **`verify.js`** now holds the survivor test, and both halves import it.
  `poster/lib.js` lost 337 lines; `app.js` lost its copy entirely. Three
  copies of this logic existed at breakfast. There is one.
- **`state.seen`** was being stamped before a picture was tested, so
  anything declined because somebody was alive could never be offered
  again — not even after that person died. 1,367 pictures were sealed off
  that way. Recording now happens on queueing, and the sealed ids have
  been cleared. Backup at `poster/state.json.before-unseal`, which is
  gitignored and therefore the only copy.

The three tuned numbers are gone. Corroboration replaced the placeholder
age test, exact-year matching replaced a ±2 window, and the age ceiling
now yields *unknown* rather than inventing a death.

## What the site does now

The bar has two homes and its position is the whole answer: inside the
roster with the living above it, or under the title once nobody is left.
No badge, no legend, no explanatory prose — all three were tried today and
all three were wrong.

A film page has three zones. Above the bar, living. Below it, gone. Below
the credits, people credited on the picture that nobody has recorded a
date for — listed, uncounted, an em-dash and no heading.

Film pages run the real survivor test live, and decline to call a picture
wrapped when it doesn't complete. Person pages read the Vault rather than
re-deriving it thirty times a page.

## The order to work in

1. **Backfill 1946–1965.** The richest remaining ground — 1955 yields more
   testable candidates than 1945 — and the thing that makes person pages
   stop under-claiming. Roughly three hours.
2. **Re-check afterwards**, then file, then commit `archive.json`.
3. **1966–1985**, then **1986–present** as a cheap sweep-up: forty years
   for perhaps a hundred candidates, run once so that "not in the Vault"
   starts meaning "we asked".

Never file before re-checking. Filing does not verify anything.

## Known and unfixed

- **`review.js` drops fields when filing** — `backfilled`, `provisional`,
  and the new `unverified` flag never reach the archive. That flag
  currently does nothing.
- **The watcher applies neither filter** — no name check, no cast floor.
- **The cast floor counts one property** and not voice credits, so
  animated films with forty voice actors score zero cast.
- **Backfill is film-only and needs a release date**, so television can
  never reach the Vault whatever range you give it.
- **`state.rejected` is written and never read**; rejection works only as
  a side effect of the seen list.
- **113 entries cannot be verified** and nothing on the page says so.

## Backups

| | |
|---|---|
| `archive.json.before-recheck` | before the last re-check |
| `poster/state.json.before-unseal` | before the sealed ids were cleared |
| `poster/state.json.before-recheck-real` | before the first real re-check |

## Everything else

`docs/VERIFICATION.md` is the plain-prose account of how a wrap is
decided, audited against the code on 28 July 2026. `docs/DECISIONS.md` has
the reasoning, `docs/BACKLOG.md` the queue, `docs/OPERATIONS.md` the
runbook. `README.md` opens with the three rules.
