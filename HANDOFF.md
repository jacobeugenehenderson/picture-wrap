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

## The over-correction — fixed, `75adfad`

**Superseded. Kept because the numbers it replaces were quoted elsewhere.**

The verification had gone too far the other way: an absent death date was
being read as a pulse. Three separate versions of that one mistake, each
found by a specific wrong answer.

| | |
|---|---|
| Stopped at pass one | Wikidata knew someone and had no `P570`, so TMDB was never asked. **Robert Amon** — Wikidata item with no dates at all, TMDB record saying he died November 1992 — vetoed *Le chemin des écoliers*. **Helen Hunt**, hairdresser on *Cover Girl*, has no dates in either database and vetoed that. |
| Stopped at pass two | **Péter Eötvös** died 24 March 2024, recorded on Wikidata, but with no `P4985` link the id lookup missed him and TMDB has no `deathday`. Reopened *Cats' Play*. |
| Took placeholders literally | **Bill Alcorn**, *Soldier (uncredited)* in *Mildred Pierce*, born `1920-01-01`, nothing on IMDb. Closing out the picture at 106. |

`survivorsViaTmdb` now runs three passes and prefers neither database:
Wikidata by TMDB id for birth *and* death dates, TMDB's own dates for
everyone Wikidata has not buried, then Wikidata again by name for whoever
is still standing. The name pass is guarded on birth year within two, and
only where exactly one person clears the guard.

### The ~49% was wrong

**It does not reproduce, and it never should have been projected.**
`poster/recheck-dryrun.log`, the file the earlier version of this note
cited, reopened **34 of the first 200 (17%)** and **105 of 800 (13%)** —
not 49%, and so not a projected 1,381 either. Where 49% came from is
unrecoverable; the log is untracked, so there is no history to read.

Measured on the same first 200, same script, one change at a time:

| | reopened |
|---|---|
| the flawed run | 34 *(17%)* |
| + name matching, + placeholder rule | 30 |
| + both databases, both ways | **14** *(7%)* |

Nothing newly reopens at any step — every change strictly removed false
reopens. That projects to roughly **200 of 2,819**. A full dry run is the
number that counts; this is the shape of it.

Delete `poster/recheck-dryrun.log` once the full run has been diffed
against it. Its numbers are misleading and its provenance is unknown.

### The two judgment calls, settled

**Placeholder birthdays: `unknown`, not `alive`** — past a hundred years
old, and only then. Below that threshold a 1 January birthday is mostly
people actually born on 1 January, and demoting them would wrongly close
pictures. Above it, the date is a cataloguer typing what they had.

**Uncredited extras still veto.** Considered and rejected. Bill Alcorn's
problem was never his billing, it was a placeholder read as a pulse — fix
that and he resolves on his own. Excluding people by credit status would
quietly change what *wrapped* means, which is the objection `BACKLOG.md`
already raises against folding poster artists in from the other side.

## The order to work in

1. ~~Add name-matching for TMDB orphans~~ — done, `75adfad`.
2. ~~Settle the two judgment calls~~ — done, above.
3. **Full `node recheck.js --dry-run`**, diffed against the old log.
4. **Run `node recheck.js`** for real. It backs up to
   `archive.json.before-recheck` and clears reopened ids from
   `state.seen`.
5. **`node review.js --archive-only`** — files the 887, posts nothing.
6. **Commit and push** so the live site picks up `archive.json`.

Do not do 5 before 4. Filing 887 entries into an unverified Vault means
re-checking everything twice.

## The nine published entries — no special treatment

Re-checked all 46 live posts under the fixed logic: **33 hold, 9 reopen,
4 cannot be verified** (no TMDB id). Down from 14 reopening.

The nine are all post-1950 and mostly non-English — Yugoslav, Greek,
Iranian, Brazilian, Bulgarian, Hungarian, Mexican — which is the thin end
of the archive, and exactly where you would expect to be wrong. One is
not arguable: *The Raven* (1977) lists **Bahman Farmanara**, who is alive
and well known.

**Decided: they are dropped like any other reopened entry.** No
retraction, no correction thread, no ceremony. This is a beta with an
audience of approximately nobody, and the cost of treating 26 early posts
as a permanent public record is a Vault built on top of known-wrong rows.
A clean foundation is worth more than a tidy timeline.

Revisit if the project ever has readers who would notice. The etiquette
question is real; it is just not real *yet*, and answering it now would
buy nothing and cost the re-check.

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
