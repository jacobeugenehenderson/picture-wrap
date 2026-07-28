# Picture Wrap

*Every picture wraps twice. Once when the shooting stops, and once when the
last person who made it is gone.*

A film's page is a single list of everyone credited on it, divided by a gold
bar: the living above, the dead below. As people die the bar rises. When it
reaches the top, the picture has wrapped, and it enters the archive.

---

## The two halves

The project is deliberately two things that barely know about each other.

| | | |
|---|---|---|
| **The site** | `index.html` `style.css` `app.js` | Three static files. No backend, no build step, no database, no dependencies. The browser queries Wikidata directly. |
| **The poster** | `poster/` | A Node script on a cron. Finds films that have closed, holds them for approval, posts approved ones to Bluesky. |

They share exactly one file: `archive.json`, which the poster writes and the
site reads. Delete the poster and the site still works completely — it just
has no archive page.

This separation is the most important structural decision in the project.
See [docs/DECISIONS.md](docs/DECISIONS.md).

---

## Run it

**The site** needs to be served, not opened as a file, or the browser blocks
the cross-origin calls:

```sh
python3 -m http.server 8000     # then open localhost:8000
```

**The poster** needs Node 18+ and no install step:

```sh
cd poster
node run.js         # find closings → queue.json
node review.js      # approve → Bluesky → archive.json
```

Full setup, credentials and cron in [poster/README.md](poster/README.md).

---

## Documentation

| | |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the halves fit, what runs where, data flow |
| [docs/DATA.md](docs/DATA.md) | Wikidata properties, measured coverage, query costs |
| [docs/DESIGN.md](docs/DESIGN.md) | The gold bar and the rules around it |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Every significant choice and why |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Daily running, backfill, deployment, failure modes |
| [poster/README.md](poster/README.md) | The poster in detail |

---

## The one thing to understand before changing anything

**"Everyone" always means everyone Wikidata records.**

Below-the-line crew — grips, gaffers, second unit — does not exist in any
free database. Cast lists are incomplete. A film's page can show a bar at the
top while four surviving supporting players simply were never entered.

Every guard in this codebase exists because of that gap: the minimum cast
floor, the human approval queue, the "the record is thin" message, the
colophon. They are not defensive programming. They are the difference between
a project that is careful and one that publishes false statements about
whether real people are alive.
