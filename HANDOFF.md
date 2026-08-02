# Handoff — 2 August 2026, night

Read this before touching anything. Nothing is running. Every job this
project has is finished and its output is on disk.

## The one sentence

The corpus is built, audited, wired into every page, and **hosted
nowhere**. `CORPUS_BASE` points at a local `corpus/` directory, so the
live site still serves the old 11,457-entry Vault. Hosting is the only
hard gate between this work and a reader.

## Where things stand

| | |
|---|---|
| **The corpus** | 137 release years, **355,717 pictures** — 123,956 closed, 232,151 running, 1,403 unchecked |
| Audit | **137 years, 0 failures**, re-run after every change below |
| Built | `dist/`, 101.8 MB, version `76641b1c66b7`, gitignored. `corpus/` is a copy for the local server |
| Sources | 19,614 closings re-sourced from TMDB to Wikidata on 2 August; TMDB-only dates fell from ~27% to ~8% |
| Disputed | **1,061 closings** where two sources give different dates, published with the disagreement rather than adjudicated |
| Evidence | 1.7 GB local; 130 MB gzipped per year on the Desktop, in iCloud, **and on an external drive as of 2 August** |
| Live site | current with `main`, **serving the old Vault** |
| Bluesky | 26 posts; 37 entries survive |

## What happened on 2 August, evening

Everything in this session came out of one question — what licence the
corpus should carry — and almost none of it turned out to be about
licences.

**The landing page got doors.** Ten genres and ten regions, then 22 and
14 when the first cut turned out to have no horror in it. They cross, and
they compose with the three sorts, so "the longest wait among French
silents" is a lookup. All 330 combinations are precomputed into
`summary.json`, which is now 175 KB — the largest deliberate trade on the
site.

**Person pages were applying two fewer rules than film pages.** Philip
Glass, born 1937, credited on *Dracula* (1931) for a 1999 score, held
that picture open on his co-workers' pages while the Vault had it closed
on Carla Laemmle in 2014. The page now returns the people rather than
counts, and applies the same rules `verify.js` does. Rule 27.

**TMDB's terms were read**, which the backlog had been asking for since
1 August. Three findings, all in `BACKLOG.md`:

1. A quarter of published closings were dated by a death only TMDB
   recorded — not a broken join, but because the pass stops asking once
   TMDB answers *dead*. `provenance.js` now asks. **Fixed.**
2. The required TMDB credit was hidden unless a browser key was set.
   **Fixed**, except the logo, which the terms also require and this
   repository does not hold.
3. CC0 conflicts with terms that forbid commercial use, derivatives and
   AI training. **Still open**, but much easier at 8% than at 27%.

**The disagreements are the find nobody was looking for.** 337 people
across 889 closings where TMDB and Wikidata give different dates. On the
year, they are almost all one digit with the day and month identical:
Antonio Moreno 1987 against 1967, Mary Stuart 2022 against 2002. Moreno
died in 1967. The archive publishes the typo — and now says so beside it.

## What to do next, in order

1. **Host the corpus.** Cloudflare R2. The immutable tree first,
   `manifest.json` last, so a half-finished upload is invisible rather
   than broken. Then point `CORPUS_BASE` at it.
   ```
   rclone copy dist/v r2:picture-wrap/v
   rclone copy dist/manifest.json r2:picture-wrap/
   ```
2. **Add the TMDB logo** to the colophon. Two minutes once the asset is
   in the repository.
3. **Decide the licence.** CC0 with citation requested is the standing
   recommendation; `BACKLOG.md` has the clauses verbatim and the
   argument.
4. **Delete `vault/*.json`.** Nothing reads them.
5. **Read `pass/provenance-disputes.tsv`.** 337 people. Where Wikidata
   carries a reference it is a repair; where it does not it is a second
   opinion. Nothing should overwrite a date on a name match alone.
6. **Propagate the new `wikidataId`s into `works.jsonl`** with a
   `rebuild.js` pass, so 19,614 closings can link their closer to the
   person's page.

Then the Desk, still the largest thing not built on the posting side.

## The machinery

| file | what it does |
|---|---|
| `poster/pass.js` | one release year, judged, with the working written down |
| `poster/judge.js` | the judgement itself, shared by the pass and the repair |
| `poster/audit.js` | re-decides a year from its own files, network unplugged |
| `poster/rebuild.js` | re-derives conclusions from stored evidence, offline |
| `poster/retest.js` | repairs verdicts that predate a rule change; needs the network |
| `poster/provenance.js` | asks Wikidata whether it holds a death we took from TMDB |
| `poster/enrich.js` | genre, country and fame per year |
| `poster/build-corpus.js` | pass output → static sharded files + `manifest.json` |
| `corpus.js` | the browser client for those files |
| `verify.js` | the single judgement, imported by the site, the poster and the pass |

**If you change what `build-corpus.js` writes, bump `FORMAT` in it.** It
stands at 5. The version digest reads the closings and cannot see the
shape they are written in, so without the bump the immutable URLs do not
move and a returning reader keeps a year-stale file.

## Reproducing from what is on disk

```
node poster/rebuild.js --years 1890-2026     # offline, minutes
node poster/enrich.js --countries            # the label dictionary
node poster/build-corpus.js                  # → dist/
```

`provenance.js` is idempotent: run it twice and the second run is a
no-op. Always give it `--archive ~/Desktop/picture-wrap-evidence` so the
backup does not silently fall behind `pass/`.

## Known and unfixed

- **The audit does not reach the person pages.** They query Wikidata live
  and apply rules 6, 7 and 8 in the browser — a second implementation
  nothing checks against the first. Rule 27, and a backlog entry for the
  test that would catch it.
- **~7,750 closings still rest on a date only TMDB recorded** — 6,547
  with no single Wikidata candidate, and the disputed ones. This is what
  the licence question now turns on.
- **The TMDB logo is missing** and the terms require it.
- **Six-month caching** vs immutable versions served for a year. Periodic
  re-scanning answers it only if the re-scan refreshes values *and* old
  versions expire. Not yet a policy.
- **30% of closers have no on-screen/behind flag**, from years passed
  before that field existed.
- **1,403 pictures are `unchecked`** — TMDB did not answer. Retriable.
- **20,114 closings carry no fame**, having no sitelinks anywhere. They
  sort last in every list that uses it.
- **Nothing is scheduled.** Cron is blocked by TCC under `~/Desktop`.
- **Nothing lints CSS**, and the two `?v=` numbers in `index.html` are
  bumped by hand. They stand at 65.

## Everything else

`README.md` indexes the documents. `METHOD.md` is the citable account.
`VERIFICATION.md` is how a wrap is decided, and its canon — now 29 rules
— is the list to check any change against. `FINDINGS.md` is what the
archive says rather than how it works. `SOURCES.md` is what is accessed,
collected and published. `BACKLOG.md` holds the open work.
