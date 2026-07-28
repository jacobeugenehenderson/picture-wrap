# Architecture

## Shape

```
                ┌──────────────────────┐
                │  Wikidata  +  TMDB   │
                │  WDQS, search, API   │
                └──────────┬───────────┘
                       ▲     │     ▲
          live queries │     │     │ scheduled queries
                       │     │     │
   ┌───────────────────┴──┐  │  ┌──┴──────────────────┐
   │      THE SITE        │  │  │     THE POSTER      │
   │  index.html          │  │  │  run.js    (cron)   │
   │  style.css           │  │  │  watch.js  (live)   │
   │  app.js              │  │  │  review.js (human)  │
   │                      │  │  │  bluesky.js lib.js  │
   │  static, no backend  │  │  │  node, no deps      │
   └──────────┬───────────┘  │  └──────────┬──────────┘
              │              │             │
              └──── shared.js (both) ──────┘
              │              │             │
              │   reads      │             │  writes
              └───────── archive.json ─────┘
                                            │
                                            └──► Bluesky
```

The arrow from the poster to Bluesky passes through a human. Nothing posts
automatically. See [DECISIONS.md](DECISIONS.md#the-approval-gate).

---

## The site

Three files, no build step, no framework, no package manager, no server.

Both Wikidata endpoints send `access-control-allow-origin: *`, verified, so
the browser talks to them directly. This is why the site can be static.

| File | Contains |
|---|---|
| `index.html` | Markup only. Loads `app.js` as `type="module"`. |
| `style.css` | Everything visual. Labelled sections; a `THEME` block of custom properties at the top is where nearly every change belongs. |
| `app.js` | Routing, queries, rendering. |
| `shared.js` | **Single source of truth.** Credit properties, search filters, label languages, pure helpers — imported by `app.js` in the browser and `poster/lib.js` in Node, as a native ES module. |

### Why shared.js exists

These definitions had already drifted: the site listed eight crew
properties with display labels, the poster listed ten including cast, in a
different shape. Nothing warned about it, and a mismatch means the two
halves can disagree about whether a picture has wrapped.

What belongs there: constants, and pure functions with no environment
behind them. What does not: anything that fetches. The poster sends a
User-Agent and retries on 429; the browser can do neither.

### Routes

Hash-based, so no server rewrites are needed:

| | |
|---|---|
| `#` | landing — recent closings, or `PICKS` if the Vault is empty |
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
| Person page | 2 parallel + label + verification | ~4s |
| Vault | 1 fetch of `archive.json` | instant |

The film page's TMDB call fills in character names *and* returns the cast
Wikidata never recorded. The person page's verification only runs on
pictures that look closed — usually a handful — in three round trips
rather than three per film.

Nothing is cached between page loads beyond `archive.json`. At this scale
that's fine and it keeps the code honest.

---

## The poster

Node 18+, no dependencies. Uses built-in `fetch` and `readline/promises`.

| File | Role |
|---|---|
| `lib.js` | All SPARQL, file IO, post composition |
| `run.js` | The sweep and the backfill. **Posts nothing.** |
| `watch.js` | Bluesky firehose from chosen newsrooms. **Posts nothing.** |
| `review.js` | The approval gate. The only path to Bluesky. |
| `preview.js` | Renders the queue as a web page with real images. |
| `bluesky.js` | AT Protocol: sessions, facets, blobs, threads. No SDK. |
| `recheck.js` | Re-tests the Vault against TMDB. |
| `recover.js` | Re-files pictures an earlier bug dropped. |
| `coverage.js` | Measures Wikidata's cast completeness against TMDB. |
| `check.js` | Verifies credentials. Posts nothing. |

### Why event-driven, not a sweep

The naive design polls every film for changes. The inversion is much cheaper:
**only someone who just died can have closed a film.** So the sweep asks
Wikidata for recent deaths with screen credits — typically a handful to a
couple of dozen a day worldwide — and checks only their filmographies.

A daily run is two query shapes and finishes in about a minute.

### State files

| File | Meaning |
|---|---|
| `state.json` | Every film ID already **considered**, plus rejections and completed backfill years |
| `queue.json` | Awaiting human approval |
| `archive.json` | Approved and posted. **The site reads this.** |

`state.json` records a film when it is considered, not when it is posted.
Without that, a film skipped for a thin cast record would be re-offered on
every future sweep forever.

---

## Three speeds

| | Latency | What it is |
|---|---|---|
| `watch.js` | minutes | A newsroom reports a death; the wrap test doesn't need the date, because everyone else is already recorded. Drafts are flagged **provisional**. |
| `run.js` hourly | ~1 hour | Once Wikidata records the death. The reliable one. |
| `run.js --days 730` monthly | — | Deaths entered late, which no daily window would ever see. |

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
   language. Failures are logged and recorded as seen.
6. The picture is queued with the person who closed it, their character,
   their nationality, age and credit, the film's stars and its poster.
7. A human runs `preview.js` to see it, then `review.js` to approve.
8. Two posts go to Bluesky as a thread — the person with their portrait,
   then the pictures with their posters — and each film is appended to
   `archive.json`.
9. `archive.json` is committed and pushed; the Vault picks it up.

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
`PW_ARCHIVE`. **Committing and pushing it is manual** — nothing does that
for you, and until you do, the Vault won't show what was posted.

---

## What does not exist, deliberately

No backend, no database, no build step, no dependencies, no accounts, no
cookies, no analytics, no tracking. The site is three files that will still
work in ten years.

One thing crossed the line partway: **TMDB**. Its key ships in `app.js`
and is therefore public — accepted, because a read-only key on a
non-commercial site is rotatable and the character names were worth it.
Nothing else changed: still no backend, no build step, no dependencies.

Two things would require a real server — per-film link previews for
clients other than Bluesky, and search analytics. They are the *same*
crossing, and if it happens it should happen once.
See [DECISIONS.md](DECISIONS.md#the-single-tool-constraint).


## Where shared logic lives, and where it doesn't yet

`shared.js` holds everything both halves must agree *about*: credit
properties, kinds, occupations, language order, date and slug helpers. It
is pure — no fetching, no file IO — because the two runtimes fetch
differently. Node sends a User-Agent and retries on 429; the browser can do
neither.

That boundary was drawn around **constants**, and it should have been drawn
around **decisions**. The verification logic — "is anyone from this picture
still alive" — is a decision both halves make, and it lives in `lib.js`,
which the browser cannot import. So the site has its own copy.

Copies drift, and this one drifted into a bug that survived three separate
fixes because each fix only touched one copy. See DECISIONS.md.

**The intended shape:** extract the verification into a pure module that
takes `fetch` as its only dependency, and have both `lib.js` and `app.js`
call it. Tracked as the top item in BACKLOG.md.

The test for whether something belongs in shared code is not "is it a
constant" — it is **"can the two halves give different answers, and would
that be a bug?"**
