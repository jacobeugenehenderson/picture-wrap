# Handoff — 2 August 2026, evening

Read this before touching anything. Nothing is running; every job this
project has is finished and its output is on disk.

## Where things stand

| | |
|---|---|
| **The corpus** | 137 release years, **355,717 pictures** — 123,956 closed, 232,151 still running, 1,403 unchecked. Audited, 0 failures. |
| Enrichment | genre, country and type on every year; **fame on 103,842 of 123,956 closings** — the rest have no sitelinks at all |
| Built corpus | `dist/`, 101.5 MB, version `367e76377eda`, gitignored |
| **The site** | reads the corpus. `app.js` no longer opens `vault/*.json` for anything. |
| `archive.json` (the old Vault) | **11,457** — superseded, still in the repository |
| Live site | **still serving the old Vault**; the corpus is not hosted yet |
| `poster/queue.json` | empty |
| Evidence | 1.7 GB local; 128 MB as one gzipped file per year on the Desktop and in iCloud |
| Bluesky | 26 posts; 37 entries survive |

**The important sentence has changed.** It used to be *the corpus is
connected to nothing*. The wiring is done — landing, Vault, film pages,
person pages and search all read the corpus. What is left is **hosting**:
`CORPUS_BASE` points at `corpus/`, a local copy, and nothing has been
uploaded.

## What happened on 1–2 August

A corpus pass was built, run across every release year, audited, and then
wired into the site. `DECISIONS.md` has each choice with its evidence;
`FINDINGS.md` has what the archive actually says; `VERIFICATION.md` §*The
canon* is the authoritative list of the 27 rules in force and which of
them anything checks.

The short version of what the pass found is that it was mostly this
project being wrong about itself: the corpus was the wrong shape
(`Q11424` alone missed four fifths of 1912), the born-after-release rule
had only ever been applied to the people TMDB names, 53 pictures wrapped
before they were released, 548 were dated from century-precision deaths,
and `MIN_CAST` was silently deciding what the archive contained.

**On the evening of 2 August, the same class of fault turned up on the
person pages** — see *Known and unfixed* below, which is now the shortest
it has been.

## The machinery

| file | what it does |
|---|---|
| `poster/pass.js` | one release year, judged, with the working written down |
| `poster/judge.js` | the judgement itself, shared by the pass and the repair |
| `poster/audit.js` | re-decides a year from its own files, network unplugged |
| `poster/rebuild.js` | re-derives conclusions from stored evidence, offline |
| `poster/retest.js` | repairs verdicts that predate a rule change; needs the network |
| `poster/enrich.js` | genre, country and fame per year; `--countries` builds the label dictionary, `--fame` skips the two already stored |
| `poster/build-corpus.js` | pass output → static sharded files + `manifest.json` |
| `corpus.js` | the browser client for those files |
| `verify.js` | the single judgement, imported by the site, the poster and the pass |

`build-corpus.js` was briefly called `publish.js`, which collides with
the name the Desk entry reserves. That name is free again and still
wanted.

## What to do next, in order

1. **Host the corpus.** Cloudflare R2, immutable tree first and
   `manifest.json` last, so a half-finished upload is invisible rather
   than broken. Then point `CORPUS_BASE` at it. This is the only thing
   standing between the work and the live site.
2. **Decide the licence.** CC0 is the recommendation, matching Wikidata.
3. **Delete `vault/*.json`.** Committed, dead, and now misleading —
   nothing reads them.
4. Then the Desk, which is still the largest thing not built on the
   posting side.

Still open beyond that: how an ongoing sweep merges new closings into a
corpus the pass owns.

## Reproducing the corpus from what is on disk

```
node poster/rebuild.js --years 1890-2026     # offline, minutes
node poster/enrich.js --countries            # the label dictionary
node poster/build-corpus.js                  # → dist/
```

**If you change what `build-corpus.js` writes — a new key, a renamed
surface, a different packing — bump `FORMAT` in it.** The version digest
reads the closings and cannot see the shape they are written in, so
without the bump the version does not move, the immutable URLs do not
move, and a returning reader keeps a year-stale copy of a file that
changed. This was found by adding `doors` and watching the version stay
put.

## The one limit worth knowing about the evidence

`rebuild.js` re-decides a year offline, and that is sound **only where
the pass gathered the full population**. It short-circuits on a living
Wikidata credit and never asks TMDB, so a rule that later makes *living*
stricter leaves those pictures untested rather than closed.

That happened on 2 August: the born-after-release rule reached
Wikidata's own credits and 965 pictures across 69 years were left open by
people who could not have been on them. `retest.js` repaired them with
the network, using the same `judge.js` the pass uses; all 965 closed and
0 were genuinely open. Records now carry `heldOpenBy`, so the next time
is a query rather than an audit failure to interpret.

The audit distinguishes the two: *does not reproduce* means the record
kept too little, and is a defect; *predates a rule change* means the
verdict is stale and needs the network.

## Known and unfixed

- **The audit does not reach the person pages.** A filmography spans
  years the pass may not have run and the corpus is a snapshot while
  Wikidata is live, so a person page asks Wikidata directly and judges
  in the browser — a second implementation of rules 6, 7 and 8 that
  nothing checks against the first. It had drifted: until the evening of
  2 August the page decided by counting credits and deaths, rules 6 and 7
  are not expressible as counts, and Philip Glass (born 1937, credited on
  *Dracula* (1931) for a 1999 score) held that picture open here while
  the Vault had it closed on Carla Laemmle in 2014. Fixed by returning
  the people instead of the arithmetic. Rule 27 in the canon records that
  the two implementations are still only kept in step by hand.
- **The old Vault's dates are wrong in roughly one entry in five** — 45
  of 1924's 199 filed entries move. Deliberately not fixed; the corpus
  supersedes them, and they are about to be deleted.
- **30% of closers have no on-screen/behind flag**, from years passed
  before that field existed. `rebuild.js` recovers what the evidence
  supports; the rest fill in on a re-pass.
- **1,403 pictures are `unchecked`** — TMDB did not answer. Each year's
  `failures.jsonl` records them and they are retriable.
- **20,114 closings carry no fame**, having no sitelinks on any wiki.
  They sort last in every list that uses it, which is correct and worth
  knowing before reading a "best known" list as a ranking.
- **Nothing is scheduled.** Cron is blocked by TCC while the repository
  lives under `~/Desktop`. Every run this project has done was typed by
  hand.
- **Nothing lints CSS.** A grouped selector was deleted once and every
  page went full-bleed. `style.css` also spent ten versions stale behind
  `app.js` because the two `?v=` numbers in `index.html` are bumped by
  hand.

## Backups

Every finished year is a single gzipped file in
`~/Desktop/picture-wrap-evidence/`, written to `.part` and renamed, so a
file that exists is always a complete year. That directory is in iCloud.
`pass/` is local and gitignored; `dist/` and `corpus/` are build output
and disposable.

The pass was killed three times on 1 August — twice by the harness
reaping background tasks, once unexplained — and cost one partially
written year each time. Resumability was worth more than it looked.

| | |
|---|---|
| `archive.json.before-recheck` | written by every real re-check |
| `archive.json.before-fullrecheck` | before the abandoned 7,787 pass |
| `poster/state.backup.json` | committed, and the only copy of the poster's memory that survives this machine |

## Everything else

`README.md` indexes the documents. `METHOD.md` is the citable account.
`VERIFICATION.md` is how a wrap is decided, and its canon is the list to
check any change against. `FINDINGS.md` is what the archive says rather
than how it works. `SOURCES.md` is what is accessed, collected and
published. `BACKLOG.md` holds sixteen entries, of which the Desk is still
the largest.
