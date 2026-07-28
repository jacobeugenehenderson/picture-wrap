# Handoff — 28 July 2026

Read this before touching the Vault. It stops at an unresolved decision,
deliberately. Nothing is half-written; everything below is a clean state.

## Where things stand

| | |
|---|---|
| `archive.json` | **2,819** — unchanged all session |
| `poster/queue.json` | **887** — the overnight sweep, filed, not reviewed |
| Bluesky | 26 posts, 46 archive entries, all from 05:47–05:51 today |
| Live site | current with `main`, `?v=17` |
| Working tree | clean, pushed |

Nothing is running. No process holds a lock. `caffeinate` released.

## What got fixed today

1. **The backfill gate counted rows, not people** — `COUNT(DISTINCT ?c)`
   against a row `SUM`, so any film with two release dates failed the
   `cast === dead` test. It dropped about half of every year.
2. **Verification only asked Wikidata whether people were alive**, and
   counted everyone Wikidata couldn't place as dead. 74% of the Vault,
   8,724 people. TMDB's own `birthday`/`deathday` are now used.
3. **`recheck.js` and `recover.js` carried their own copies** of that
   logic and kept the bug after the original was fixed. Both now call
   `survivorsViaTmdb`.
4. **`lib.js` re-exported only a subset of `shared.js`** — `VALUES`,
   `IN_LIST` and `LANGS` were missing, which is *why* those files
   re-derived them. The derivations broke silently when `CREDITS` became
   an array of pairs, and `recheck.js` reported "2,819 could not be
   checked" as if it were a result. Re-export is now complete.
5. **`review.js` dropped `tmdbId` when posting** and kept it when filing
   silently, so the pictures we announced were the only ones
   `recheck.js` could never verify. Both paths now keep it, and
   `backfill-tmdbids.js` repaired 66 of the 162 entries missing it.
6. Contrast, mobile type sizes, English-name fallback, the closing line,
   the Back control, the search placeholder, the tagline.

## The decision that blocks everything else

**The verification is now too aggressive in the opposite direction.**

Rule as written: a person with a birth date inside a human lifespan and no
death date is *alive*, and vetoes the picture.

The failure case, confirmed:

> **Péter Eötvös** died 24 March 2024. Wikidata knows. He has **no
> `P4985`** link, so he falls to the TMDB path; TMDB has no `deathday`;
> we call him alive and reopen *Cats' Play*.

A partial dry run reopened **~49%** of the first 200 entries — a
projected 1,381 of 2,819. That number is not real. It is mostly this bug.

**The fix, not yet written:** for orphans TMDB cannot date, try matching
by **name** against Wikidata before concluding "alive". Guard against name
collisions — require a plausible birth year or an acting occupation.

`poster/recheck-dryrun.log` holds the flawed run. Delete it once the
name-matching pass exists; its numbers are misleading.

### A second, smaller judgment call

`Mildred Pierce` reopens on **Bill Alcorn**, *Soldier (uncredited)*, born
`1920-01-01` — a placeholder that usually means "year only". He would be
106. Worth deciding whether:

- placeholder birthdays (`-01-01`, uncorroborated) should be `unknown`
  rather than `alive`
- uncredited extras should veto a picture at all

Both are defensible either way. Neither should be decided silently.

## The order to work in

1. **Add name-matching for TMDB orphans**, then re-run
   `node recheck.js --dry-run` and see what the real number is.
2. **Settle the two judgment calls above.**
3. **Run `node recheck.js`** for real. It backs up to
   `archive.json.before-recheck` and clears reopened ids from
   `state.seen`.
4. **`node review.js --archive-only`** — files the 887, posts nothing.
5. **Commit and push** so the live site picks up `archive.json`.

Do not do 4 before 3. Filing 887 entries into an unverified Vault means
re-checking everything twice.

## Backups

| | |
|---|---|
| `archive.json.before-refill` | before the overnight sweep |
| `archive.json.before-tmdbids` | before the id repair |
| `poster/state.json.before-refill` | before the overnight sweep |
| `poster/queue.json.old-check` | 265 entries from the broken check — **evidence only, do not review** |

## Known-wrong things still live

- **`app.js:332` and `app.js:664`** carry the old verification bug. A film
  page can show the bar at the top while TMDB knows someone is alive. The
  fix is to extract the logic into a module both halves import — not to
  patch two more copies. Top of `docs/BACKLOG.md`.
- **14 of the 46 published entries** reopen under the current rule,
  including *Mildred Pierce*. How many survive the name-matching fix is
  unknown. Nothing has been retracted, and nothing should be until the
  number is real.
- **96 Vault entries have no TMDB id** and cannot be verified at all.

## Everything else

`docs/DECISIONS.md` has the reasoning, `docs/BACKLOG.md` the queue,
`docs/OPERATIONS.md` the runbook including `caffeinate` and how to recover
an interrupted backfill. `README.md` opens with the three rules.
