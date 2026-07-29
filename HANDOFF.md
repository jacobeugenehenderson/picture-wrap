# Handoff — 29 July 2026

Read this before touching the Vault. Nothing is half-written; everything
below is a clean state, except the one job noted as running.

## Where things stand

| | |
|---|---|
| `archive.json` | **11,457** |
| `poster/queue.json` | empty |
| Years the backfill has asked about | **1900–2026, 127 years, no gaps** |
| Unverifiable | **1,077** entries have no TMDB id — almost all pre-1930, where TMDB does not reach |
| Bluesky | 26 posts; 37 entries survive |
| Live site | current with `main`, `?v=37` |

**The frontier scan is complete.** Every year from 1900 to 2026 has been
asked about. The earliest closing in the Vault is *Lattermaskinen* (1910),
which wrapped on 10 April 1942 — while the war it outlived was still being
fought.

## What happened on 28–29 July

The verification was wrong in six ways, all of them the same mistake:
**silence read as an answer.**

1. It asked TMDB who was in a film and only Wikidata whether they lived,
   counting everyone unmatched as dead. 74% of the Vault.
2. It stopped at Wikidata even when TMDB held the death date.
3. It missed anyone without a `P4985` link — Péter Eötvös, dead in 2024.
4. It read a cataloguer's `1920-01-01` placeholder as a pulse.
5. It let SPARQL row order decide contested identifiers.
6. Its callers treated a lookup that never ran as a lookup that found
   nobody — measured: with TMDB unreachable the re-check reported "21
   still closed" where it should have reported none.

**What came out of it.** `verify.js` now holds the survivor test and both
halves import it; there is no second implementation anywhere. Three tuned
numbers were replaced by tests for the evidence they stood in for. Every
caller reads whether the test actually ran.

**What it was worth, measured.** The 1946–65 backfill rejected 1,711
candidates for having a living person; the 1966–2026 run rejected 518.
Every one of those is a picture Wikidata declared closed with someone
alive in it.

**Structural fixes.** `state.seen` records a film when it is *queued* and
not before — it used to be stamped on the way in, so a picture declined
because somebody was alive could never be offered again, and 1,367 were
sealed off that way. `saveArchive()` and `saveState()` are now the only
writers, so derived files cannot drift. `state.backup.json` is committed,
sorted one id per line.

**The site.** The Vault is served in shards — a 1 KB summary, an ids file,
one file per closing decade — because `archive.json` is 4.5 MB and was
being fetched whole on every page. The bar has two homes and its position
is the whole answer: inside the roster, or under the title once nobody is
left. Television works: series carry `P4983`, not `P4947`, and
`aggregate_credits` rather than `credits`.

## The order to work in

1. **Let the silent backfill finish**, or kill it and `--resume` later.
2. **`node review.js --archive-only --yes`** to file what it found.
3. **`node recheck.js`** over the whole Vault — the one job still
   outstanding, and the reason is worth knowing: everything filed since
   yesterday was verified minutes before filing by the current code, so
   this is about drift in *older* entries, not about the new ones. Expect
   the unchecked count to be roughly the no-TMDB-id count.
4. **Commit `archive.json` and `vault/`**, and regenerate
   `state.backup.json`.

Never file into a Vault you have not re-checked *when the queue predates
a logic change*. That is not the case today, which is why filing came
first this time.

## Acceptance criteria for a full re-check

*Written before the 29 July run, so the judgement does not depend on
anyone's recall — including mine.*

A full pass over 11,457 entries takes ~3.5 hours. When it finishes, these
are the numbers that decide whether to commit it or throw it away:

| | expected | if not |
|---|---|---|
| **Unchecked** | ~1,077 — the entries with no TMDB id | Materially higher means TMDB was failing. Discard the run; it verified nothing. |
| **Reopens among entries older than 29 July** | ~0 | They passed this exact code twice on 28 July. A reopen here is non-determinism, not new information — see the Jorge Busto contested-id case. |
| **Reopens among entries filed 28–29 July** | ~0 | They were verified minutes before filing by this same code. |
| **Total reopens** | a handful | Hundreds means something changed underneath us. Stop and find out what. |
| **Errors / deferrals** | 0 | The `ok` flag exists so nothing passes silently. Any deferral is a lookup that failed. |

Inside those, commit. Outside them, **do not write 11,457 entries on a
judgement call** — the backup is `archive.json.before-recheck`, written
before the run touches anything, and the run now checkpoints so a kill
costs a few hundred entries rather than the pass.

---

## Known and unfixed

- **The watcher applies neither filter** — no name check, no cast floor.
- **The cast floor counts `P161` only**, so an animated film with forty
  `P725` voice credits scores zero cast and is dropped.
- **`state.rejected` is written and never read.**
- **481 entries cannot be verified** and nothing on the page says so.
- **Nothing is scheduled.** Cron is blocked by TCC while the repository
  lives under `~/Desktop`; a launchd agent cannot read its own launcher
  there. Every run this project has done was typed by hand.
- **Nothing lints CSS.** A grouped selector was deleted once and every
  page went full-bleed. The check that catches it is comparing the sorted
  set of selectors before and after a structural edit.

## The largest thing not built

**The Desk** — a local authoring environment, designed and written up at
the top of `docs/BACKLOG.md`. Prep and send in one place, because the
current split makes you judge images in one tool and write words blind in
another. Three extractions in it are worth doing regardless of the rest:
`publish.js`, `bluesky-text.js`, `alt.js`.

## Backups

| | |
|---|---|
| `archive.json.before-recheck` | written by every real re-check |
| `archive.json.before-fullrecheck` | before the abandoned 7,787 pass |
| `poster/state.json.before-overnight` | before the 1966–2026 run |
| `poster/state.backup.json` | committed, and the only copy that survives this machine |

## Everything else

`docs/VERIFICATION.md` is the plain-prose account of how a wrap is
decided, audited against the code. `docs/ARCHITECTURE.md`,
`DECISIONS.md`, `DATA.md` and `DESIGN.md` were all brought current on
29 July. `docs/OPERATIONS.md` is the runbook. `README.md` opens with the
three rules.
