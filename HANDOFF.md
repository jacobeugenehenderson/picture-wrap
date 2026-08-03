# Handoff — 3 August 2026

Read this before touching anything. Nothing is running. Every job this
project has is finished and its output is on disk and deployed.

## The one sentence

**It is live, it is smaller, and it now has three states instead of two.**
picture-wrap.com serves 97,395 closings. It said 123,956 yesterday, and
the difference is not a loss — 147 of those pictures were never closed,
and 3,253 were the same picture counted twice. The 147 are published as
retractions rather than quietly dropped.

## Where things stand

| | |
|---|---|
| **The corpus** | 137 release years, 329,957 pictures — **97,395 closed**, **23,161 unclassified**, 208,028 running, 1,373 unchecked |
| Retractions | **138**, published as `removed.json` and stated on the picture's own page. The record opens 3 August 2026 |
| Audit | **137 years, 0 failures**, re-run after every change below |
| Built | `dist/`, 101.3 MB, version `9bfc997e9964`, gitignored |
| **Corpus hosted** | Cloudflare Pages, project `picture-wrap-corpus`, at `https://picture-wrap-corpus.pages.dev/` — 803 files |
| **Site hosted** | GitHub Pages from `main`, at picture-wrap.com. **Two hosts. The site is not on Cloudflare** |
| Live site | current with `main`, `?v=79` |
| Verified | 58,758 closings tested against both databases; **38,637 (46%) rest on Wikidata alone** and now say so on the page |
| Disputed | 1,034 closings where two sources give different dates, published with the disagreement rather than adjudicated |
| Evidence | 1.7 GB local; on the Desktop, in iCloud, and on an external drive — **the Desktop copy is behind for the years deduped on 3 August** |
| Bluesky | 26 posts; 37 entries survive |

## What happened on 3 August

One question — why is *Gidget* in the Vault when its own page shows
someone living — and it was three bugs down.

**The corpus was closing pictures without asking TMDB.** `retest.js`
handed `judge.js` the record that goes to disk; `judge.js` read the field
names the pass's query uses. `tmdbId` against `tmdb` and `tv`. Both came
back undefined, every picture fell through the no-id branch, and 965 were
closed on Wikidata's word alone with the id sitting in the argument
unread. The tell was in the run and nobody read it: *965 re-tested, 965
closed, none reopened.* A real test of that many pictures never comes back
unanimous. Re-tested the 809 that had an id — **671 close, 136 do not**,
2 have no credits in TMDB at all and keep their old verdict. The log now
counts "closed against TMDB" apart from "closed untested", because those
being one number is how this hid.

**Rule 6 did not reach the film page.** Nobody worked on a picture
released before they were born. The Vault applied it; the film page did
not. So *Gidget* showed a living screenwriter who is an Australian
politician born in 1964 — Wikidata's P58 points at Q5516102 and not at
the Gabrielle Upton who wrote it and died in 2022. Same picture, two
answers, one site. `viewFilm` now applies it, and `VERIFICATION.md` says
so.

**`unverified` was documented and never written.** Bits 4 and 5 of the
packed flags byte have been in the manifest's field list since
`build-corpus.js` was written, and nothing ever set them; `corpus.js`
never decoded them. A described field that is always zero reads as
measured and says nothing. Both bits are written now, both are read, each
closing carries `unverified`, and the Vault marks those closings
**Wikidata alone**. Derived from `tested`, never from the stored flag,
which undercounts — `FORTIFYING.md` had said so since 28 July.

**One picture was being filed as several.** Two causes, both ours.

The pass grouped its works query by `?typeLabel`, and Wikidata gives one
picture several of the classes we ask about — 1,166 are both "film" and
"short film". Each came back as a row and was judged as a picture. Across
3,924 duplicated groups not one disagreed about the verdict or the wrap
date; only the label did. Fixed in `pass.js`, where the classes are now
ranked general-to-specific so the surviving row is the one that says the
most, and repaired on disk by the new `dedupe.js`. **4,025 collapsed.**

And the pass is a batch job over a release year, so a picture released
across two years was judged and filed in both. `build-corpus.js` now
files by id, earliest release winning, *before* any index is built — so
the year lists, the closing axis, the day and month files, `ids.bin`,
`facts.bin` and every count read one set. **1,904 collapsed.**

*Casablanca* was the tell, and the comment about it was wrong. It said
Wikidata holds two items dated 1942 and 1943 and that merging them was a
claim about identity belonging upstream. There is one item, Q132689, with
four release dates — New York 1942, America 1943, Sweden 1943, France
1947 — and both copies carried 107 sitelinks because they were the same
item. Filed once now, in 1942, which is what Wikidata calls it.

## Redeploying

**Two hosts, and both must move.** This is the thing most likely to trip
you: the corpus is on Cloudflare and the site is on GitHub Pages, and a
change to what a closing *says* usually needs both.

```
node poster/build-corpus.js
npx wrangler pages deploy dist --project-name picture-wrap-corpus --branch main
git push origin main          # the site; GitHub Pages serves from main
```

The site reads whatever `manifest.json` points at, so a new corpus needs
no change to the site — but a new *field* in a closing needs the site
pushed to draw it. On 3 August the corpus went out knowing which closings
were unverified while the site had no code to show it, and that gap is
invisible from either side.

**Bump both `?v=` numbers in `index.html` by hand** whenever `app.js` or
`style.css` changes, and the `?v=` on the module imports at the top of
`app.js` alongside. They stand at 79 and 55.

**If you change what `build-corpus.js` writes, bump `FORMAT`.** It stands
at 9. Since format 8 the digest reads the whole of every published row,
so a change to any field moves the URLs on its own; `FORMAT` is now only
for the shape of the files themselves. Before that it hashed an id and a
wrap date, and three changes in one day slipped past it.

Pages was chosen over R2 because the corpus is 803 immutable static
files: it bulk-uploads them, deploys atomically — so there is no
half-finished state for the "manifest last" ordering to guard against —
and reads the `_headers` `build-corpus.js` writes, which carries the CORS
header and both cache policies.

## What to do next, in order

1. **Add the TMDB logo** to the colophon. The terms require it and the
   asset is not in this repository — it is a download from TMDB's
   logos-and-attribution page, left for its owner to make.

2. **The link previews.** There are *no* `og:` or `twitter:` tags on this
   site at all, so iMessage has no image and shows the barest card it
   has. The cheap half is a site-wide card: an absolute `og:image` at
   1200×630 — the wordmark, the bar and the count would draw it — plus
   `og:title`, `og:description`, `og:url` and
   `twitter:card=summary_large_image`. That alone fixes the common case,
   since most pasted links are the front page.

   The per-picture half is a real fork. Hash routing sends no id to a
   server, and prerendering one file per entry means 97,395 files.
   **Moving the site to Cloudflare Pages** — where the corpus already
   lives — would let a Function answer crawlers with real tags, collapse
   two hosts into one, and let CORS relax. Weigh that first; the reasons
   to do it are bigger than previews, and after 3 August the two-host
   split has a name and a cost. `BACKLOG.md` has all three options.

3. **Decide the licence.** CC0 with citation requested is the standing
   recommendation; `BACKLOG.md` has the clauses verbatim and the
   argument. It turns on how much of the corpus rests on TMDB, which is
   item 1.

4. **Read `pass/provenance-disputes.tsv`.** 337 people. Where Wikidata
   carries a reference it is a repair; where it does not it is a second
   opinion. Nothing should overwrite a date on a name match alone.

5. **Copy the deduped `pass/` to the Desktop evidence archive.** The
   3 August dedupe rewrote 131 years and the durable copy did not follow.

6. **Delete `vault/*.json` and `archive.json`.** Nothing on the site
   reads them — but `poster/lib.js`, `review.js` and `backfill-tmdbids.js`
   still do, so this is a deletion with a small amount of code behind it.

Then the Desk, still the largest thing not built on the posting side.

## The machinery

| file | what it does |
|---|---|
| `poster/pass.js` | one release year, judged, with the working written down |
| `poster/judge.js` | the judgement itself, shared by the pass and the repair |
| `poster/audit.js` | re-decides a year from its own files, network unplugged |
| `poster/rebuild.js` | re-derives conclusions from stored evidence, offline |
| `poster/retest.js` | repairs verdicts that predate a rule change; needs the network |
| `poster/dedupe.js` | collapses pictures a year's files hold more than once; offline |
| `poster/seed-removals.js` | opened the retraction record from a pre-repair snapshot; a one-off |
| `poster/provenance.js` | asks Wikidata whether it holds a death we took from TMDB |
| `poster/enrich.js` | genre, country and fame per year |
| `poster/build-corpus.js` | pass output → static sharded files + `manifest.json` |
| `corpus.js` | the browser client for those files |
| `verify.js` | the single judgement, imported by the site, the poster and the pass |

## Reproducing from what is on disk

```
node poster/dedupe.js --years 1890-2026     # offline, idempotent
node poster/rebuild.js --years 1890-2026    # offline, minutes
node poster/enrich.js --countries           # the label dictionary
node poster/build-corpus.js                 # → dist/
```

`provenance.js` is idempotent: run it twice and the second run is a
no-op. Always give it `--archive ~/Desktop/picture-wrap-evidence` so the
backup does not silently fall behind `pass/`. **Run `rebuild.js` after
`provenance.js`, never before** — see item 1.

## Known and unfixed

- **The audit does not reach the film page or the person page.** Both
  apply rules in the browser that nothing checks against `verify.js`.
  The film page got rule 6 on 3 August only because a reader noticed the
  contradiction. `wikidataClosed` in `viewPerson` is a second
  implementation of "has this closed", safe today only because it is
  ANDed with corpus membership; loosen that and person pages start
  closing pictures on Wikidata alone again. A backlog entry describes
  the test that would catch this class.
- **38,637 closings (46%) rest on Wikidata alone**, almost all because
  the picture carries no TMDB id and there is nothing to ask. Marked on
  the page since 3 August. This is a floor, not a bug — but it is the
  archive's weakest half and the licence question turns on it.
- **2 closings could not be re-tested**: TMDB answers 200 with an empty
  cast and crew, so the survivor test reports it did not run and
  `retest.js` declines to overwrite. They will re-present on every run.
  The summary calls this "TMDB did not answer", which is not quite true —
  it answered with nothing.
- **27% of named closers have no on-screen/behind flag**, from years
  passed before that field existed.
- **1,386 pictures are `unchecked`** — TMDB did not answer. Retriable.
- **7,770 closings carry no fame**, having no sitelinks anywhere. They
  sort last in every list that uses it.
- **Old corpus versions are not retained.** `dist/` holds only the build
  that made it, and a Pages deploy replaces the site, so the previous
  version disappears from the origin. Readers holding a `manifest.json`
  less than five minutes old can request a 404 until it revalidates.
  This is expiry by overwrite rather than by policy, and the six-month
  re-scanning clause in the licence draft assumes a policy.
- **The retraction record begins on 3 August 2026.** Nothing withdrawn
  before that date was kept and none of it is reconstructible; the 138
  opening entries carry no entry date for the same reason. `recheck.js`
  is not wired to the ledger either — departures are caught at build time
  by diffing the roll, which misses nothing but attributes nothing to the
  run that caused it. And there is no page listing retractions: they are
  reachable from the picture, which is the case that matters, and not
  browsable.
- **`last.source` is not published.** The corpus knows whether a closing
  date came from Wikidata, from both databases agreeing, or from TMDB
  alone, and the site cannot show it. That is the second of the three
  confidence axes and the only one with no surface.
- **Nothing lints CSS.**
- **Nothing is scheduled.** Cron is blocked by TCC under `~/Desktop`.

## Everything else

`README.md` indexes the documents. `METHOD.md` is the citable account.
`VERIFICATION.md` is how a wrap is decided, and its canon — 34 rules —
is the list to check any change against. `FINDINGS.md` is what the
archive says rather than how it works. `SOURCES.md` is what is accessed,
collected and published. `BACKLOG.md` holds the open work.
