# Architecture

## Shape

```
                ┌──────────────────────┐
                │  Wikidata  +  TMDB   │
                │  WDQS, search, API   │
                └──────────┬───────────┘
                       ▲     │     ▲
          live queries │     │     │ queries by hand
                       │     │     │
   ┌───────────────────┴──┐  │  ┌──┴──────────────────┐
   │      THE SITE        │  │  │     THE POSTER      │
   │  index.html          │  │  │  run.js    sweep    │
   │  style.css           │  │  │  watch.js  listen   │
   │  app.js              │  │  │  review.js human    │
   │                      │  │  │  recheck.js explain │
   │  static, no backend  │  │  │  node, no deps      │
   └──────────┬───────────┘  │  └──────────┬──────────┘
              │              │             │
              ├── shared.js ─┴─ verify.js ─┤
              │   what both must           │
              │   agree ABOUT              │  what both must
              │                            │  agree ON
              │                            │
              │   reads                    │  writes
              └──── vault/ ◄── archive.json ┘
                    summary                 │
                    ids                     └──► Bluesky
                    <decade>
```

Two shared files, and the distinction between them is the whole design.
`shared.js` holds what both halves must agree **about** — property lists,
languages, pure helpers. `verify.js` holds what they must agree **on**:
the single judgement of whether anyone who made a picture is still alive.

The site no longer reads `archive.json`. The poster writes it, and writes
`vault/` beside it in the same breath; the browser fetches only the piece
its question needs.

The arrow from the poster to Bluesky passes through a human. Nothing posts
automatically. See [DECISIONS.md](DECISIONS.md#the-approval-gate).

---

## The site

Four files, no build step, no framework, no server. (There is one dev
dependency, eslint, which never ships — see *Tooling* below.)

Both Wikidata endpoints send `access-control-allow-origin: *`, verified, so
the browser talks to them directly. This is why the site can be static.

| File | Contains |
|---|---|
| `index.html` | Markup only. Loads `app.js` as `type="module"`. |
| `style.css` | Everything visual. Labelled sections; a `THEME` block of custom properties at the top is where nearly every change belongs. |
| `app.js` | Routing, queries, rendering. |
| `shared.js` | Credit properties, search filters, label languages, pure helpers — imported by `app.js` in the browser and `poster/lib.js` in Node, as a native ES module. |
| `verify.js` | **The survivor test.** Whether anyone who made a picture is still alive. Imported by the browser before it will raise the bar, and by the poster before it will queue a closing. |

### Why shared.js exists

These definitions had already drifted: the site listed eight crew
properties with display labels, the poster listed ten including cast, in a
different shape. Nothing warned about it, and a mismatch means the two
halves can disagree about whether a picture has wrapped.

What belongs there: constants, and pure functions with no environment
behind them. What does not: anything that fetches. The poster sends a
User-Agent and retries on 429; the browser can do neither.

### Why verify.js exists

The same lesson, learned the hard way and at a cost. The survivor test had
three copies — `lib.js`, `recheck.js`, `recover.js` — and when the
original was fixed the copies kept the bug. `app.js` held a fourth, and
kept the *original* bug through three separate fixes to the others, so a
film page could show a picture wrapped while TMDB knew someone in it was
alive.

`verify.js` fetches nothing itself. The caller passes in `sparql()` and
`tmdb()`, because fetching is the one thing the halves genuinely cannot
share. Everything else — what the answers *mean* — is identical on both
sides and must stay that way.

The test for whether something belongs here: *can the two halves give
different answers, and would that be a bug?*

### Routes

Hash-based, so no server rewrites are needed:

| | |
|---|---|
| `#` | landing — three sorts, and twenty doors that cross, or `PICKS` if the corpus is empty |
| `#/mildred-pierce/Q979726` | the roster and the bar |
| `#/ann-blyth/Q255378` | filmography, split by whether each picture has closed |
| `#/archive` | the Vault, closings grouped by decade then year |
| `#/about` | what the project is and what its limits are |

The kind is **not** in the URL. The router finds the Q-id wherever it sits
and asks Wikidata whether it's a person or a picture — one query, ~0.16s,
cached, hidden inside the loading state. Older forms (`#/person/Q…/slug`,
`#/film/Q…`) still resolve, so nothing published ever breaks.

The Q-id can't be dropped: 27 Vault titles are in Arabic, Cyrillic or Tamil
and slug to nothing, titles collide across years, and with no server there
is nothing to resolve a name against.

Hash routing has one significant cost: link previews. See
[DECISIONS.md](DECISIONS.md#hash-routing).

### Request pattern per view

| View | Requests | Measured |
|---|---|---|
| Search keystroke | 1 search + 1 label lookup | ~0.2s |
| Kind lookup | 1 (cached per id) | ~0.16s |
| Film page | 3 parallel + label + TMDB credits | ~0.8s |
| Person page | 2 parallel + label + `ids.bin` | ~1–3s |
| Landing | 1 fetch of `manifest.json` + `summary.json` | ~83 KB |
| Vault, closed | the same two, already cached | 0 |
| Vault, one decade opened | nothing — the counts are in the summary | 0 |
| Vault, one year opened | + `closed/<YYYY>.json` | ~220 KB median |

The landing's doors cost nothing beyond the summary the page already
fetches, crossings included: all 117 combinations of ten genres and ten
regions are precomputed in `build-corpus.js`, because the facts table
that could answer them in the browser is 3 MB and carries neither titles
nor fame. They are two thirds of that 83 KB, and they are the reason it
is 83 KB rather than 30.

The person page fetches `ids.bin` — 484 KB, sorted 32-bit Wikidata
numbers — once, and answers membership for a whole filmography by binary
search. Its remaining cost is the filmography query itself, which returns
one `person#birthyear#death` per credit so that the page can apply the
same rules `verify.js` does rather than the subset expressible as `COUNT`
columns.

The film page's TMDB call fills in character names *and* returns the cast
Wikidata never recorded. It asks `/movie/{id}/credits` for a film and
`/tv/{id}/aggregate_credits` for a series — a series' plain credits are
only the billed regulars, five people where the aggregate has 248.

The film page runs the full survivor test **only when the page would
otherwise show a wrap.** If Wikidata already knows somebody living, the
bar is not going to the top and no amount of TMDB agreement would move it,
so the extra requests never happen.

The person page no longer verifies anything. A filmography can hold sixty
closed-looking pictures and the test is per-film; it reads `vault/ids.json`
instead, which is the same test already run offline.

Nothing is cached between page loads. At this scale that's fine and it
keeps the code honest.

---

## The poster

Node 18+, no dependencies. Uses built-in `fetch` and `readline/promises`.

| File | Role |
|---|---|
| `lib.js` | SPARQL, file IO, post composition, and the two writers — `saveArchive()` and `saveState()` |
| `verify.js` | *(repo root)* The survivor test, shared with the browser |
| `run.js` | The sweep and the backfill. **Posts nothing.** |
| `watch.js` | Bluesky firehose from chosen newsrooms. **Posts nothing.** |
| `review.js` | The approval gate. The only path to Bluesky. |
| `preview.js` | Renders the queue as a web page with real images. |
| `bluesky.js` | AT Protocol: sessions, facets, blobs, threads. No SDK. |
| `recheck.js` | Re-tests the Vault against TMDB. |
| `recover.js` | Re-files pictures an earlier bug dropped. |
| `coverage.js` | Measures Wikidata's cast completeness against TMDB. |
| `check.js` | Verifies credentials. Posts nothing. |
| `explain.js` | Why one picture got the verdict it got. Reads only the APIs, writes nothing — safe against a live backfill. |
| `backfill-tmdbids.js` | Fills in missing `tmdbId`, without which an entry cannot be verified. |
| `watch.command` | The launcher. Restarts node if it dies, and drops the Bluesky password before starting — the watcher reads a public firehose and cannot post. |

### Why event-driven, not a sweep

The naive design polls every film for changes. The inversion is much cheaper:
**only someone who just died can have closed a film.** So the sweep asks
Wikidata for recent deaths with screen credits — typically a handful to a
couple of dozen a day worldwide — and checks only their filmographies.

A daily run is two query shapes and finishes in about a minute.

### State files

| File | Meaning |
|---|---|
| `state.json` | Every film ID already **queued**, plus completed backfill years. Gitignored. |
| `state.backup.json` | The same, sorted one id per line, and committed. |
| `queue.json` | Awaiting human approval. Gitignored. |
| `archive.json` | Approved and filed. The poster's record; the site does not read it. |
| `vault/` | What the site reads: `summary.json`, `ids.json`, and one file per decade. |

`state.json` records a film when it is **queued**, and nothing earlier. It
used to be stamped on the way in — before the name check, before the cast
floor, before the survivor test — so a picture declined because somebody
was still alive could never be offered again, not even after that person
died. 1,367 pictures were sealed off that way before it was fixed.

Everything declined is simply left unrecorded, so the next death on that
picture brings it back round. The cost is re-testing films already
declined, which is exactly the work that finding them requires.

Two writers keep the derived files from drifting: `saveArchive()` writes
`archive.json` and republishes `vault/`; `saveState()` writes `state.json`
and its sorted twin. Nothing calls `save(paths.archive, …)` directly any
more, because a derived file you can forget to update is one that goes
stale.

---

## The third half: the corpus pass

The two halves below — site and poster — answer "has this picture
wrapped?" one picture at a time, live. The pass answers it for every
picture ever released, offline, and writes down why.

    poster/pass.js          one release year → verdicts + evidence + people + failures
    poster/audit.js         re-decides a year from its own files, network unplugged
    poster/rebuild.js       re-derives conclusions offline after a rule changes
    poster/enrich.js        film-level facts: genre, country
    poster/build-corpus.js  pass output → immutable sharded files + manifest
    corpus.js               the browser client for those files

**It shares the judgement and nothing else.** `verify.js` decides who is
alive; the pass, the site and the poster all import it. What the pass adds
is that it *keeps the working* — every person judged, the dates used,
their precision, their source — which is what makes a later rule change a
re-decision rather than a re-fetch.

**Its output is not the Vault's shape and is meant to replace it.** One
record per picture with coverage, unknowns by name, `checkedAt`, and the
thresholds that decided it; plus a packed 25-byte-per-row facts table for
questions that cross two columns, which per-axis shards cannot answer.

**The client is deliberately ignorant.** `corpus.js` fetches a manifest,
resolves a key to a versioned URL, and caches. It knows nothing about
pictures, people or wraps: given the same manifest shape it reads any
corpus, which is what lets the pattern move to another project.

---

## Three speeds

| | Latency | What it is |
|---|---|---|
| `watch.js` | minutes | A newsroom reports a death; the wrap test doesn't need the date, because everyone else is already recorded. Drafts are flagged **provisional**. |
| `run.js --days 3` | ~1 day | Once Wikidata records the death. The reliable one. |
| `run.js --days 730` | — | Deaths entered late, which no daily window would ever see. |

**None of it is scheduled.** The cron lines in OPERATIONS.md have never
been installed, and cannot be while the repository lives under `~/Desktop`,
which macOS gates behind TCC — a launchd agent cannot read even its own
launcher there. Every run this project has done was typed by hand.

---

## Data flow for one closing

1. A person dies. Someone adds `P570` to their Wikidata item, usually within
   hours, because it feeds Wikipedia infoboxes.
2. `run.js` finds them in the recent-deaths query.
3. For each of their pictures, it asks whether **any** credited person lacks
   a death date. If none do, Wikidata thinks it has closed.
4. **It asks TMDB whether Wikidata knew the whole cast.** Any living person
   TMDB credits and Wikidata didn't attach to that film reopens it. On the
   first real sweep this caught 14 of 60 candidates.
5. Guards apply: at least `MIN_CAST` cast on record, and a name in some
   language. Failures are logged and **not** recorded as seen, so they can
   come back when the picture changes.
6. The picture is queued with the person who closed it, their character,
   their nationality, age and credit, the film's stars and its poster.
7. A human runs `preview.js` to see it, then `review.js` to approve.
8. Two posts go to Bluesky as a thread — the person with their portrait,
   then the pictures with their posters — and each film is appended to
   `archive.json`, which republishes `vault/` in the same call.
9. `archive.json` and `vault/` are committed and pushed; the Vault picks
   it up.

Latency from death to post is hours to days, dominated by how fast Wikidata
is edited. This is why the poller is a cron and not a live event stream —
sub-second delivery would buy nothing. See
[DECISIONS.md](DECISIONS.md#polling-over-event-streams).

---

## Deployment

The site is static: any host. The poster runs anywhere with Node and cron —
it does not need to be the same machine, or the same host, as the site.

The site is hosted on **GitHub Pages** from `main`, at
**picture-wrap.com**, with HTTPS enforced. `CNAME` holds the domain and
`.nojekyll` stops Pages processing the files.

The poster writes `archive.json` straight into the site root via
`PW_ARCHIVE`, and `vault/` beside it. **Committing and pushing is manual**
— nothing does that for you, and until you do, the Vault won't show what
was posted.

`?v=` on both tags in `index.html` must be bumped whenever `app.js` or
`style.css` changes, or returning visitors keep the old files.

---

## What does not exist, deliberately

No backend, no database, no build step, no accounts, no cookies, no
analytics, no tracking. The site is four files that will still work in ten
years.

Two things crossed the line partway.

**TMDB.** Its key ships in `app.js` and is therefore public — accepted,
because a read-only key on a non-commercial site is rotatable and the
character names were worth it.

**eslint.** One dev dependency, added after a deleted variable reached
production. It never ships; `node_modules` is gitignored and the site
still serves only its own files. But "no dependencies" was a stated
property and it is now qualified rather than true.

Two things would require a real server — per-film link previews for
clients other than Bluesky, and search analytics. They are the *same*
crossing, and if it happens it should happen once.
See [DECISIONS.md](DECISIONS.md#the-single-tool-constraint).


## Where shared logic lives

`shared.js` holds everything both halves must agree *about*: credit
properties, kinds, occupations, language order, date and slug helpers. It
is pure — no fetching, no file IO — because the two runtimes fetch
differently. Node sends a User-Agent and retries on 429; the browser can do
neither.

That boundary was drawn around **constants**, and it should have been drawn
around **decisions**. For most of this project's life the verification
logic — "is anyone from this picture still alive" — lived in `lib.js`,
which the browser cannot import, so the site kept its own copy. Copies
drift, and this one drifted into a bug that survived three separate fixes
because each fix touched one copy.

`verify.js` is that boundary redrawn. It fetches nothing; the caller
supplies `sparql()` and `tmdb()`. Both halves import it, and there is no
second implementation left anywhere.

The test for whether something belongs in shared code is not "is it a
constant" — it is **"can the two halves give different answers, and would
that be a bug?"**

---

## Tooling

One dev dependency, `eslint`, added after a deleted variable reached
production on the landing page. `node --check` parses a file; it does not
run it, so a reference to something that no longer exists survives every
check the project had.

```sh
npm run lint
```

Deliberately narrow: `no-undef`, plus a handful of rules for things that
are unambiguously bugs rather than taste. No formatting opinions, and it
should not grow any — the moment it has views about how the code reads,
running it stops being free. The two halves get different globals, so
`app.js` may say `document` and must not say `process`, and `shared.js`
and `verify.js` may assume neither.

Nothing lints CSS. A grouped selector was deleted once and every page went
full-bleed; the check that would have caught it is comparing the sorted set
of selectors before and after a structural edit.

`node_modules` is gitignored. The site still ships nothing but the files it
serves.
