# Picture Wrap

*Every picture wraps twice: first when the shooting stops, and finally when
the last person who made it is gone.*

**[picture-wrap.com](https://picture-wrap.com)** ·
**[@picture-wrap.bsky.social](https://bsky.app/profile/picture-wrap.bsky.social)**

> **Picking this up mid-flight? Read [HANDOFF.md](HANDOFF.md) first.**
> It records the current state, what is unfinished, and the decision that
> is currently blocking the Vault re-check. Do not run `recheck.js` or
> `review.js --archive-only` before reading it.

A film's page is a single list of everyone credited on it, divided by a gold
bar: the living above, the dead below. As people die the bar rises. When it
reaches the top, the picture has wrapped, and it enters the Vault.

---

## The two halves

The project is deliberately two things that barely know about each other.

| | | |
|---|---|---|
| **The site** | `index.html` `style.css` `app.js` `shared.js` `verify.js` | Static files. No backend, no build step, nothing shipped that it didn't write. The browser queries Wikidata and TMDB directly. |
| **The poster** | `poster/` | Node scripts. Finds pictures that have closed, holds them for approval, posts approved ones to Bluesky. |

They share two files, and the difference between them is the design.
**`shared.js`** is what both halves must agree *about* — properties,
languages, pure helpers. **`verify.js`** is what they must agree *on*:
whether anyone who made a picture is still alive.

The poster writes **`archive.json`** for itself and **`vault/`** for the
browser — a summary, an index of ids, and one file per decade. The site
never fetches the archive; at 4.5 MB it would be a poor thing to hand
somebody who wanted the front page.

Delete the poster and the site still works — it just has no Vault.

---

## Run it

**The site** must be served, not opened from disk, or the browser blocks
the cross-origin calls:

```sh
python3 -m http.server 8000     # then open localhost:8000
```

**The poster** needs Node 18+ and no install step:

```sh
. ~/.picture-wrap.env           # credentials, kept outside the repo
cd poster
node preview.js                 # see the queue as a web page, images and all
node review.js                  # approve → Bluesky → archive.json
```

There are launchers in `~/Desktop/picture-wrap-assets/` for the three
things done by hand: `picture-wrap-preview`, `picture-wrap-review`,
`picture-wrap-watch`.

---

## The scripts

| | |
|---|---|
| `run.js` | The daily sweep, and the backfill. Finds closings, posts nothing. |
| `watch.js` | Listens to newsrooms on Bluesky, drafts ahead of Wikidata. |
| `review.js` | The approval gate. **The only thing that posts.** |
| `preview.js` | Renders the queue as a web page with real images. |
| `recheck.js` | Re-tests the Vault; removes pictures that turn out to have survivors. |
| `recover.js` | Re-files pictures an earlier bug dropped. |
| `coverage.js` | Measures how complete Wikidata's cast list is, against TMDB. |
| `backfill-tmdbids.js` | Fills in missing `tmdbId`, without which an entry can't be verified. |
| `check.js` | Verifies Bluesky credentials. Posts nothing. |
| `explain.js` | Why one picture got the verdict it got — every person, both databases, and the reasoning. Reads only the APIs; safe to run against a live backfill. |

---

## Documentation

| | |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the halves fit, what runs where, data flow |
| [docs/DATA.md](docs/DATA.md) | Properties, measured coverage, query costs |
| [docs/DESIGN.md](docs/DESIGN.md) | The gold bar and the rules around it |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Every significant choice and why |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Daily running, backfill, deployment, failure modes |
| [docs/BACKLOG.md](docs/BACKLOG.md) | Deferred work, with enough context to pick it up cold |
| [docs/FORTIFYING.md](docs/FORTIFYING.md) | Making the Vault citable: errata, provenance, and the re-check loop |
| [docs/VERIFICATION.md](docs/VERIFICATION.md) | How a wrap is decided, in plain prose, no code |
| [docs/METHOD.md](docs/METHOD.md) | The same procedure written for citation — the source text for the site's "Methods and sources" |
| [docs/SOURCES.md](docs/SOURCES.md) | What is read, what is kept, how it is treated — privacy, licensing and citation |
| [poster/README.md](poster/README.md) | The poster in detail |
| [HANDOFF.md](HANDOFF.md) | Current state and what's unfinished — **read first** |

---

## Two things to understand before changing anything

**"Everyone" means everyone recorded.** Below-the-line crew — grips,
gaffers, second unit — does not exist in any free database. Cast lists are
incomplete. A page can show a bar at the top while people who were never
entered are alive. Every guard here exists because of that gap.

**Wikidata alone never decides that a picture has closed.** Its cast lists
are routinely a fraction of the real cast, and the people it omits are
usually people it *knows* — just not attached to that film. Every path that
concludes "no one is left" verifies against TMDB first.

**And both databases are asked about life and death.** Wikidata via `P570`,
TMDB via `deathday` on its own person records. Asking only Wikidata — and
counting everyone it couldn't place as dead — was this project's worst bug,
affecting 74% of the archive.

There is **one** implementation, `verify.js`, imported by both halves.
Call it; do not copy it. Four copies once existed and every one of them
kept the bug after the original was fixed — the browser's kept it through
three separate fixes to the others.

**A person has three possible states, not two:** dead, alive, or unknown.
Unknown is counted and stored, never read as dead.
