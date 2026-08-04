# Handoff — 3 August 2026, night

Read this before touching anything. Nothing is running. Every job this
project has is finished and its output is on disk and deployed.

## The one sentence

**A picture now has three states, not two.** 97,395 have wrapped, 23,161
are unclassified because nobody credited on them has a recorded date, and
the rest are running. The Vault said 123,956 this morning; the difference
is not a loss, it is the removal of claims that were never supported.

## Where things stand

| | |
|---|---|
| **The corpus** | 137 release years, 329,957 pictures — **97,395 closed**, **23,161 unclassified**, 208,028 running, 1,373 unchecked |
| Audit | **137 years, 0 failures** — true as of 4 August, and it was not on the 3rd; see below |
| Built | `dist/`, version `1656efddcc1e`, FORMAT 13, gitignored |
| **Corpus hosted** | Cloudflare Pages, project `picture-wrap-corpus`, at `https://picture-wrap-corpus.pages.dev/` |
| **Site hosted** | GitHub Pages from `main`, at picture-wrap.com. **Two hosts** |
| Live site | current with `main`, `?v=92`, modules `?v=56` |
| Verified | 58,758 closings checked against both databases; **38,637 (40%) against Wikidata alone** and the Vault can filter them out |
| The closer | 88,675 closings link to the person who closed them; 7,721 rest on a date only TMDB records |
| Resolution | **93.6% of closings are dated to the day**; 1,532 carry no date at all |
| Disputed | 1,034 closings where two sources give different dates, published with the disagreement |
| Evidence | 1.8 GB local; the Desktop archive re-sealed 4 August, 137 years, and the two agree |
| Bluesky | 26 posts; 37 entries survive |

## What happened on 3 August

One question — why is *Gidget* in the Vault when its own page shows
someone living — and it went four bugs deep.

**The corpus was closing pictures without asking TMDB.** `retest.js`
handed `judge.js` the record that goes to disk; `judge.js` read the field
names the pass's query uses. Both came back undefined, every picture fell
through the no-id branch, and 965 were closed on Wikidata's word alone
with the id sitting in the argument unread. The tell was in the run and
nobody read it: *965 re-tested, 965 closed, none reopened.* Re-tested the
809 that had an id — **671 close, 136 do not.**

**Rule 6 did not reach the film page.** Nobody worked on a picture
released before they were born. The Vault applied it; the film page did
not, so *Gidget* showed a living screenwriter who is an Australian
politician born in 1964. Canon rule 27 now admits the film page as a
second unaudited surface.

**One picture was being filed as several.** The pass grouped its works
query by `?typeLabel` and Wikidata gives a picture several classes at
once, so 4,025 were judged twice. Separately, a picture released across
two years was filed under both — 1,904 more, *Casablanca* and *Attack*
among them. The comment blaming Wikidata for Casablanca was wrong: one
item, four release dates, filed once now under 1942.

**A closing did not need a death.** 23,161 pictures were published as
wrapped with no death recorded for anyone credited — median release year
2007, median one name on record. The rule that unrecorded people never
veto is right when a picture has thirty deaths and two blanks, and
returns the strongest claim on the site out of nothing when every person
is a blank. *Aanikoobijigan* (2026) was wrapped with Zack Khalil, born
1991, credited on it.

A closing now needs a death on record, or a release year old enough that
arithmetic settles it. The rest are **unclassified** — the third state,
mirroring the third state a person has always had.

**Eleven more were vetoed across release years.** A picture closed under
one year while another year's judgement named somebody living. One living
person vetoes the picture; a second release year cannot outvote them.

### And on the site

- **The third state reached the film page too.** It was binary — no
  death date meant living — so somebody Wikidata holds no dates for at
  all was drawn above the bar. *Women of the World* (2001) showed two
  such people as living while the Vault had it closed. Canon rules 3
  and 27.
- A picture with no TMDB record says so once, in full, on its own page.
- **The unclassified**, browsed by release year — the only date they have.
  Its own tiles, because it is a different population: documentary is
  7,856 of it, against sixth place in the Vault.
- **`ALL` / `CONFIRMED`** replaced a *Wikidata alone* badge that was on two
  rows in five and was read as meaning the opposite of what it meant.
- **Tiles by share.** A label earns one by holding one picture in five
  hundred: 39 regions and 30 genres in the Vault, 38 and 25 in the
  unclassified. Every other label — 451 genres, 228 countries — is
  typeable into a datalist under each row.
- **The nav shows the place you are not**, which is what it always was.
- **Methods** carries what the Vault used to explain about itself, and now
  states that no licence has been set.

## Redeploying

**Two hosts, and both must move.**

```
node poster/build-corpus.js
npx wrangler pages deploy dist --project-name picture-wrap-corpus --branch main
git push origin main          # the site; GitHub Pages serves from main
```

**Bump both `?v=` numbers in `index.html`** whenever `app.js` or
`style.css` changes, and the module `?v=` at the top of `app.js` whenever
`verify.js`, `shared.js` or `corpus.js` changes. They stand at **92** and
**56**.

**`FORMAT` is only for the shape of the files now.** It stands at 13.
Since format 8 the version digest reads the whole of every published row,
so a change to any field moves the URLs on its own. Before that it hashed
an id and a wrap date, and three changes in one day slipped past it.

## What to do next, in order

1. ~~Add the TMDB logo.~~ **Done.** `tmdb.svg` in the colophon, and the
   terms this project operates under are now downloaded and kept in
   `licences/` — TMDB's API and site terms, CC0, Wikidata, Wikimedia and
   Bluesky, as fetched on 3 August with their fingerprints.

2. **The link previews — half done, 4 August.** The site-wide card ships:
   `og:`/`twitter:` tags and `card.png`, drawn by `make-card.py`. Every
   pasted link now draws a real card.

   **The per-picture half is still open, and is a fork.** Hash routing
   sends no id to a server, so a crawler asking for a film gets the
   front-page head — every card is the same card. **Moving the site to
   Cloudflare Pages**, where the corpus already lives, would let a
   Function answer crawlers, collapse two hosts into one and let CORS
   relax. `BACKLOG.md` has all three options.

3. ~~Decide the licence.~~ **Done. CC0 for the corpus, MIT for the code**
   — `LICENSE-CORPUS` and `LICENSE`, and Methods now states it. Reading
   the terms in full turned up two clauses the summary had missed:
   termination obliges us to purge cached TMDB content, which reaches
   published `v/` shards on the CDN; and "destination website" sits among
   the commercial-use examples. `SOURCES.md` §6 carries both.

4. **Read `pass/provenance-disputes.tsv`.** 337 people. Nothing should
   overwrite a date on a name match alone.

5. ~~Copy `pass/` to the Desktop evidence archive.~~ **Done, 4 August.**
   All 137 years re-sealed, 133 MB, and the two now agree.

   It needed a script rather than a `cp`: the archive is a gzip bundle of
   works, evidence and failures per year, and `pass.js`, `retest.js` and
   `provenance.js` write it while `rebuild.js`, `dedupe.js` and
   `enrich.js` do not — which is exactly why it went stale, since the 3
   August work was rebuild and dedupe. `poster/archive-pass.js` re-seals
   from what is on disk. **Run it after any offline repair**, and run
   `audit.js` before it: it copies the working tree over the good copy,
   so a wrong working tree overwrites a right archive.

6. ~~Delete `vault/*.json` and `archive.json`.~~ **Done, 4 August — and
   two of the three things it named should not have been deleted.**

   Eleven files went: nine decade shards, `ids.json`, `summary.json`.
   `publishVault()` in `poster/lib.js`, which regenerated them on every
   filing — about 3 MB of churn into files with no reader — went with
   them.

   **`vault/suppressed.json` stays.** `app.js:1449` fetches it on every
   page load. It is 3 bytes, `[]`, and it is the name-suppression list
   that makes honouring a removal request a one-line commit.

   **`archive.json` stays.** It is not dead, it is the poster's record of
   what it has *posted*, read by `review.js`, `recheck.js`, `recover.js`,
   `coverage.js` and `backfill-tmdbids.js`. The corpus knows which
   pictures have closed; it does not know which closings we announced.
   Nothing else holds that.

   The four `archive.json.before-*` snapshots (13 MB, untracked) moved to
   `~/Desktop/picture-wrap-evidence/superseded/`.

Then the Desk, still the largest thing not built on the posting side.

## The machinery

| file | what it does |
|---|---|
| `poster/pass.js` | one release year, judged, with the working written down |
| `poster/judge.js` | the judgement itself, shared by the pass and the repair |
| `poster/audit.js` | re-decides a year from its own files, network unplugged |
| `poster/rebuild.js` | re-derives conclusions from stored evidence, offline, in both directions |
| `poster/retest.js` | repairs verdicts that predate a rule change; needs the network |
| `poster/dedupe.js` | collapses pictures a year's files hold more than once; offline |
| `poster/archive-pass.js` | re-seals finished years into the durable archive; offline |
| `poster/seed-removals.js` | opened the departure ledger from a pre-repair snapshot; a one-off |
| `poster/provenance.js` | asks Wikidata whether it holds a death we took from TMDB |
| `poster/enrich.js` | genre, country and fame per year |
| `poster/build-corpus.js` | pass output → static sharded files + `manifest.json` |
| `corpus.js` | the browser client for those files |
| `verify.js` | the single judgement, imported by the site, the poster and the pass |

## Reproducing from what is on disk

```
node poster/dedupe.js  --years 1890-2026    # offline, idempotent
node poster/rebuild.js --years 1890-2026    # offline, minutes
node poster/enrich.js  --countries          # the label dictionary
node poster/build-corpus.js                 # → dist/
```

**Run `rebuild.js` after `provenance.js`, never before.** It ran before on
2 August and the corroboration sat unread in `evidence.jsonl` for a day:
26,836 closings named a closer dated by TMDB alone when 19,111 of them
were already corroborated.

## Known and unfixed

- **The audit does not reach the film page or the person page.** Both
  apply rules in the browser that nothing checks against `verify.js`.
  `wikidataClosed` in `viewPerson` is a second implementation of "has this
  closed", safe only because it is ANDed with corpus membership.
- **38,637 closings (40%) rest on Wikidata alone**, almost all because the
  picture has no TMDB record. A floor, not a bug, and the licence question
  turns on it.
- **`pass/removed.jsonl` holds 23,299 departures and nothing reads it.**
  138 are closings that were wrong; the rest are the 3 August
  reclassification. `build-corpus.js` still publishes those 138 as
  `removed.json` and the site does not fetch it. It is a record on disk,
  deliberately not a surface — a page about what the archive got wrong
  answers a question about the archive, not about film.
- **`recheck.js` is not wired to that ledger**; departures are caught by
  diffing at build time, which misses nothing but attributes nothing.
- **7,721 closings rest on a date only TMDB recorded**, and 999 name no
  closer at all.
- **27% of named closers have no on-screen/behind flag**, from years
  passed before the field existed.
- **1,373 pictures are `unchecked`** — TMDB did not answer. Retriable.
- **7,770 closings carry no fame** and sort last wherever it is used.
- **`summary.json` is 283 KB**, the largest deliberate trade on the site.
  It carries the landing's doors with their film tables, both filter
  rows' crossings, and every label with its count.
- **Old corpus versions are not retained.** A Pages deploy replaces the
  origin, so a reader holding a manifest less than five minutes old can
  404 until it revalidates.
- **Nothing lints CSS.**
- **Nothing is scheduled.** Cron is blocked by TCC under `~/Desktop`.

## Everything else

`README.md` indexes the documents. `METHOD.md` is the citable account.
`VERIFICATION.md` is how a wrap is decided, and its canon — 35 rules — is
the list to check any change against. `FINDINGS.md` is what the archive
says rather than how it works. `SOURCES.md` is what is accessed,
collected and published. `BACKLOG.md` holds the open work.
