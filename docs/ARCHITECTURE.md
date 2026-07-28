# Architecture

## Shape

```
                    ┌──────────────────┐
                    │    Wikidata      │
                    │  WDQS + search   │
                    └────────┬─────────┘
                       ▲     │     ▲
          live queries │     │     │ scheduled queries
                       │     │     │
   ┌───────────────────┴──┐  │  ┌──┴──────────────────┐
   │      THE SITE        │  │  │     THE POSTER      │
   │  index.html          │  │  │  run.js    (cron)   │
   │  style.css           │  │  │  review.js (human)  │
   │  app.js              │  │  │  bluesky.js         │
   │                      │  │  │  lib.js             │
   │  static, no backend  │  │  │  node, no deps      │
   └──────────┬───────────┘  │  └──────────┬──────────┘
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
| `index.html` | Markup only. ~50 lines. |
| `style.css` | Everything visual. Ten labelled sections; a `THEME` block of custom properties at the top is where nearly every change belongs. |
| `app.js` | Routing, queries, rendering. |

### Routes

Hash-based, so no server rewrites are needed:

| | |
|---|---|
| `#` | landing — recent closings, or `PICKS` if the archive is empty |
| `#/film/Q47703` | the roster and the bar |
| `#/person/Q171736` | filmography, split by whether each film has closed |
| `#/archive` | closings grouped by year |

Hash routing has one significant cost: link previews. See
[DECISIONS.md](DECISIONS.md#hash-routing).

### Request pattern per view

| View | Queries | Measured |
|---|---|---|
| Search keystroke | 1 search + 1 label lookup | ~0.2s |
| Film page | 3 parallel (meta, cast, crew) | ~0.5s |
| Person page | 2 parallel (meta, filmography) | ~3.5s |
| Archive | 1 fetch of `archive.json` | instant |

Nothing is cached between page loads beyond `archive.json`. At this scale
that's fine and it keeps the code honest.

---

## The poster

Node 18+, no dependencies. Uses built-in `fetch` and `readline/promises`.

| File | Role |
|---|---|
| `lib.js` | All SPARQL, all file IO, shared constants |
| `run.js` | The sweep and the backfill. **Posts nothing.** |
| `review.js` | The approval gate. The only path to Bluesky. |
| `bluesky.js` | AT Protocol. Two endpoints, no SDK. |

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

## Data flow for one closing

1. A person dies. Someone adds `P570` to their Wikidata item, usually within
   hours, because it feeds Wikipedia infoboxes.
2. `run.js` finds them in the recent-deaths query.
3. For each of their films, it asks whether **any** credited person lacks a
   death date. If none do, the film has closed.
4. Guards apply: at least `MIN_CAST` cast on record, and a usable English
   title. Failures are logged and recorded as seen.
5. The film is queued with the person who closed it and their character.
6. A human runs `review.js`, opens the Wikidata links, and approves.
7. The post goes to Bluesky; the film is appended to `archive.json`.
8. The site's archive page and landing chips pick it up on next load.

Latency from death to post is hours to days, dominated by how fast Wikidata
is edited. This is why the poller is a cron and not a live event stream —
sub-second delivery would buy nothing. See
[DECISIONS.md](DECISIONS.md#polling-over-event-streams).

---

## Deployment

The site is static: any host. The poster runs anywhere with Node and cron —
it does not need to be the same machine, or the same host, as the site.

The only coupling is getting `archive.json` where the site can fetch it.
Set `PW_ARCHIVE` to have the poster write straight into the site root.

---

## What does not exist, deliberately

No backend, no database, no build step, no dependencies, no accounts, no
cookies, no analytics, no tracking. The site is three files that will still
work in ten years.

Two things would each require crossing that line — per-film link previews and
search analytics. They are the *same* crossing, and if it happens it should
happen once. See [DECISIONS.md](DECISIONS.md#the-single-tool-constraint).
