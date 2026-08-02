# Handoff — 2 August 2026

Read this before touching anything. The one job still running is named
below; everything else is a clean state.

## Where things stand

| | |
|---|---|
| **The corpus pass** | 136 release years judged, **355,717 pictures** — 122,839 closed, 231,477 still running, 1,401 unchecked. 2026 in flight, then done. |
| `archive.json` (the old Vault) | **11,457** — still what the live site serves, and now superseded |
| `poster/queue.json` | empty |
| Evidence | 1.7 GB local; 128 MB as one gzipped file per year on the Desktop and in iCloud |
| Built corpus | `dist/`, 92 MB, gitignored |
| Live site | current with `main`, `?v=43`, **serving the old Vault** |
| Bluesky | 26 posts; 37 entries survive |

**The important sentence:** the corpus exists, is audited, and is
connected to nothing. `app.js` still reads `vault/*.json`. Nothing a
visitor sees has changed.

## What happened on 1–2 August

A corpus pass was built, run across every release year, and audited. What
it found along the way was mostly this project being wrong about itself.

**The corpus was the wrong shape.** The backfill asked Wikidata only for
`Q11424`, and Wikidata does not file early cinema under it: 1912 is 2,326
short films to 597 films. Four fifths of that year had never been seen.
`WORK_CLASSES` in `shared.js` now names twelve classes.

**Nobody worked on a picture before they were born — including in
Wikidata's own credits.** The rule existed since the backfill and was
applied only to the people TMDB names. *Under Western Skies* (1910) was
dated 2024 by William Russell, born 1924, while the William Russell born
1884 sat two credits below him in the same cast list.

**A picture cannot wrap before it is released.** 53 did, on source authors
(Edgar Allan Poe dating a 1914 picture), pre-existing composers (Schubert,
1931) and archival footage (Frederik VIII of Denmark, 1937).

**The last death decides, at whatever precision it carries.** Dating from
the last *day-precise* death always yields a printable date and names the
wrong person: 56 pictures in 1924 alone. Closings now carry `day`,
`month`, `year` or `none`, and 548 that were dated from century-precision
deaths — Wikidata serialises "20th century" as `1901-01-01` — are placed
nowhere at all.

**`MIN_CAST` was deciding what the archive contains.** It gated two
backfill sites that cannot post, in an archive where 37 of 11,457 entries
have ever been posted, and excluded 500–780 complete-record pictures a
year. Removed from the pass; thinness is carried per entry instead.

**Genre and country are recorded now**, one query per year in
`enrich.js`. Country immediately caught the project citing "37 Indian
titles across 1930–45" in its own colophon — a count of pictures labelled
*India* in a period when Wikidata labels them *British Raj*. The real
figure is 928, and British Raj is the fifth largest label of that period.

Full detail in `DECISIONS.md`. Every measured fact is in `FINDINGS.md`,
which is new, and is where to start if you want to know what this archive
actually says rather than how it works.

## The machinery

| file | what it does |
|---|---|
| `poster/pass.js` | one release year, judged, with the working written down |
| `poster/audit.js` | re-decides a year from its own files, network unplugged |
| `poster/rebuild.js` | re-derives conclusions from stored evidence, offline |
| `poster/enrich.js` | genre and country per year; `--countries` builds the label dictionary |
| `poster/build-corpus.js` | pass output → static sharded files + `manifest.json` |
| `corpus.js` | the browser client for those files |

`build-corpus.js` was briefly called `publish.js`, which collides with the
name the Desk entry reserves for the publish-and-file path. That name is
free again and still wanted.

## The order to work in

1. **Let the pass finish** (2026 in flight) and let the runner's enrich
   sweep follow it.
2. **`node rebuild.js --years 1890-2026`** — the early years were judged
   before the later rules landed. Offline, minutes, and the corpus is then
   internally consistent under one set of rules.
3. **`node enrich.js --countries`** to regenerate the label dictionary.
4. **`node build-corpus.js`**, and read its summary.
5. **Then the wiring**, which is a session of its own.

## The largest thing not built — and it is no longer the Desk

**The corpus is connected to nothing.** `loadIds` reads `vault/ids.json`;
`loadDecade` reads `vault/<decade>.json`; `corpus.js` is imported by no
file. These decisions are already taken, so this is work rather than
debate:

- the corpus **replaces** the Vault
- **decade drawers stay**, opening onto years rather than lists, because a
  closing decade is up to 6 MB and a closing year is 600 KB
- hosting is **Cloudflare R2**, deployed immutable tree first and
  `manifest.json` last, so a half-finished upload is invisible rather than
  broken

Still open: the licence — CC0 is the recommendation, matching Wikidata —
and how the ongoing sweep merges new closings into a corpus the pass owns.

The Desk is still the largest thing not built on the *posting* side, and
`preview.js` remains unrunnable: it renders 3,329 queue items with
per-item API calls and an 80ms sleep.

## The one limit worth knowing about the evidence

`rebuild.js` re-decides a year offline, and that is sound **only where the
pass gathered the full population**. It short-circuits on a living
Wikidata credit and never asks TMDB, so a rule that later makes *alive*
stricter leaves those pictures untested rather than closed.

That happened on 2 August: the born-after-release rule reached Wikidata's
own credits and 965 pictures across 69 years were left open by people who
could not have been on them. `retest.js` repaired them with the network,
using the same `judge.js` the pass uses. Records now carry `heldOpenBy`,
so the next time is a query rather than an audit failure to interpret.

The audit distinguishes the two: *does not reproduce* means the record
kept too little, and is a defect; *predates a rule change* means the
verdict is stale and needs the network.

## Known and unfixed

- **The old Vault's dates are wrong in roughly one entry in five** — 45 of
  1924's 199 filed entries move. Deliberately not fixed; the corpus
  supersedes them.
- **30% of closers have no on-screen/behind flag**, from years passed
  before that field existed. `rebuild.js` recovers what the evidence
  supports; the rest fill in on a re-pass.
- **1,401 pictures are `unchecked`** — TMDB did not answer. Each year's
  `failures.jsonl` records them and they are retriable.
- **Nothing is scheduled.** Cron is blocked by TCC while the repository
  lives under `~/Desktop`. Every run this project has done was typed by
  hand.
- **Nothing lints CSS.** A grouped selector was deleted once and every
  page went full-bleed.

## Backups

Every finished year is a single gzipped file in
`~/Desktop/picture-wrap-evidence/`, written to `.part` and renamed, so a
file that exists is always a complete year. That directory is in iCloud.
`pass/` is local and gitignored; `dist/` is build output and disposable.

The pass was killed three times on 1 August — twice by the harness reaping
background tasks, once unexplained — and cost one partially-written year
each time. Resumability was worth more than it looked.

| | |
|---|---|
| `archive.json.before-recheck` | written by every real re-check |
| `archive.json.before-fullrecheck` | before the abandoned 7,787 pass |
| `poster/state.backup.json` | committed, and the only copy of the poster's memory that survives this machine |

## Everything else

`README.md` indexes the documents. `FINDINGS.md` and `SOURCES.md` are
new. `METHOD.md` was brought current on 1 August and is the citable
account. `VERIFICATION.md` is the plain-prose version of how a wrap is
decided. `BACKLOG.md` holds sixteen entries, of which the Desk is still
the largest.
