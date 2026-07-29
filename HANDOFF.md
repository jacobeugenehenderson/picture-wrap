# Handoff — 29 July 2026

Read this before touching the Vault. Nothing is half-written; everything
below is a clean state, except the one job noted as running.

## Where things stand

| | |
|---|---|
| `archive.json` | **11,457** |
| `poster/queue.json` | empty |
| Years the backfill has asked about | **1900–2026, 127 years, no gaps** |
| Unverifiable | **1,077** entries have no TMDB id, and were tested against Wikidata alone. 599 are pre-1930, where TMDB's coverage stops — but **270 are 1950–69** and 57 are 1970 or later, which "almost all pre-1930" wrongly waved away |
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
one file per closing decade — because `archive.json` is 6.5 MB and was
being fetched whole on every page. The bar has two homes and its position
is the whole answer: inside the roster, or under the title once nobody is
left. Television works: series carry `P4983`, not `P4947`, and
`aggregate_credits` rather than `credits`.

## The order to work in

1. **`node recheck.js`** over the whole Vault — the one job outstanding,
   and the reason is worth knowing: everything filed on 28–29 July was
   verified minutes before filing by the current code, so this is about
   drift in *older* entries rather than about the new ones. Judge the
   result against the criteria below before writing it.
2. **Commit `archive.json` and `vault/`**, and regenerate
   `state.backup.json`.

Never file into a Vault you have not re-checked *when the queue predates
a logic change*. That is not the case today, which is why filing came
first this time.

## Acceptance criteria for a full re-check

*Written before the 29 July run, so the judgement does not depend on
anyone's recall — including mine.*

A full pass over 11,457 entries takes **~1 hour** — measured at 59 minutes
on 29 July, 14:40 to 15:39. The "~3.5 hours" written here beforehand was an
estimate, never a measurement, and it is worth correcting rather than
deleting: a pass finishing in a third of its predicted time is exactly what
a pass that silently skipped its expensive half would look like, so the
wrong figure manufactures a false alarm at the moment judgement is needed.
What ruled that out was not the clock but the arithmetic — see below.

When it finishes, these are the numbers that decide whether to commit it or
throw it away:

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

### What the 29 July run returned

`10,369 still closed, 0 reopened, 1,088 could not be checked.` Vault
11,457 → 11,457. **Inside the criteria; committed.**

The arithmetic is what verifies the run, and it closes exactly: 10,369 +
0 + 1,088 = 11,457, and 10,380 entries hold a TMDB id against 10,369
closed. **So 11 entries had an id and still came back unchecked** — real
deferrals, lookups that failed, against an expected 0. Unchecked at 1,088
against a predicted 1,077 is 1% over, nowhere near the "materially higher
means TMDB was failing" threshold, and 10,369 closures cannot be reached
without the expensive path running. The run did its work.

Two things the criteria did not anticipate, both worth fixing before the
next pass:

- **The write is not gated on the judgement.** `saveArchive(kept)` runs
  unconditionally at the end of `recheck.js`, so "judge the result before
  writing it" is not something the script permits. What protects the Vault
  is the backup, not the ordering. Read the instruction as *judge before
  committing*.
- **Nothing records which entries deferred.** The progress line prints
  reopens only, so those 11 are bounded but unidentified — the same
  silence-as-answer shape the rest of the file guards against. Print the
  id on every `unchecked` verdict.

The diff was audited before committing: 0 entries removed, 179 touched,
`unknownCount` the only field that changed on any of them.

---

## Known and unfixed

- **The watcher applies neither filter** — no name check, no cast floor.
- **The cast floor counts `P161` only**, so an animated film with forty
  `P725` voice credits scores zero cast and is dropped.
- **`state.rejected` is written and never read.**
- **1,077 entries cannot be verified** and nothing on the page says so.
- **1,030 of those 1,077 carry `unknownCount: 0`**, which reads as "nothing
  unaccounted for" on a picture no second database was ever asked about.
  This is the residue of the bug `recheck.js` documents as fixed: the guard
  now returns `unchecked` before writing the field, so no *new* zeros are
  minted, but the zeros written before the fix were never cleared. The
  field is served to the site. Either clear it on entries with no TMDB id
  or make its absence the only honest value.
- **72% of the Vault rests on unresolved people.** 8,283 of 11,457 closed
  entries have `unknownCount > 0` — 43,051 people with no death date and no
  creditable birth date. `verify.js` already calls this "the honest measure
  of how much of the closing rests on silence"; nothing reads it. It is
  concentrated where it matters least (19,257 in 1930–49) and also where it
  matters most: **17,743 unresolved people in 1950–69 releases**, recent
  enough that "almost every unknown really is dead" stops holding.
  *Смърт няма* (1963) closed on one recorded death with 7 of 8 unresolved.
- **No entry records when it was last checked.** There is no `checkedAt`
  field — `postedAt` is Bluesky. Until one exists there is no "stalest
  first", so a rolling refresh cannot be aimed and every pass must be a
  full pass.
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
