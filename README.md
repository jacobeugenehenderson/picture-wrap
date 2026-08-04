# Picture Wrap

*Every picture wraps twice: first when the shooting stops, and finally when
the last person who made it is gone.*

**[picture-wrap.com](https://picture-wrap.com)** ·
**[@picture-wrap.bsky.social](https://bsky.app/profile/picture-wrap.bsky.social)**

> **Picking this up mid-flight? Read [HANDOFF.md](HANDOFF.md) first.**
> It records the current state and what is unfinished. As of 3 August
> 2026 the site serves a corpus of **95,567 closings**: the corpus files
> are on Cloudflare Pages, the site itself is on GitHub Pages, and a
> change to what a closing says usually needs both deployed.
> `archive.json` and `vault/` are the superseded 11,457-entry Vault and
> nothing on the site reads them.

A film's page is a single list of everyone credited on it, divided by a gold
bar: the living above, the dead below. As people die the bar rises. When it
reaches the top, the picture has wrapped, and it enters the Vault.

A picture has three states, not two. A closing needs a recorded death: a
picture where nobody is recorded dead *and* nobody is recorded living is
**unclassified** rather than wrapped, because an absence of evidence is
not evidence. That is 16,201 of them, and they have their own list.

---

## The three parts

The project is deliberately things that barely know about each other.

| | | |
|---|---|---|
| **The site** | `index.html` `style.css` `app.js` `corpus.js` `shared.js` `verify.js` | Static files. No backend, no build step, nothing shipped that it didn't write. The browser queries Wikidata and TMDB directly, and reads the corpus over HTTP. |
| **The corpus** | built by `poster/build-corpus.js` into `dist/` | 95,567 closings and 16,201 unclassified pictures, as immutable, versioned, static shards. Hosted on Cloudflare Pages; `CORPUS_BASE` in `app.js` is the only thing that names where. |
| **The poster** | `poster/` | Node scripts. Judges pictures, records the working, and posts approved closings to Bluesky. |

They share two files, and the difference between them is the design.
**`shared.js`** is what all of them must agree *about* — properties,
languages, pure helpers. **`verify.js`** is what they must agree *on*:
whether anyone who made a picture is still alive. If you find yourself
writing a second copy of either, that is the mistake this structure
exists to prevent.

**Nothing fetches an archive whole.** Every surface is addressed by
something the client already holds — a Wikidata id, a release year, a day
of the year — so a page costs one small file rather than a download. The
one mutable object is `manifest.json`; everything it points at may be
cached for a year.

Delete the poster and the site still works: the corpus is already built
and hosted, and it simply stops gaining closings.

`archive.json` and `vault/` are the old 11,457-entry Vault, superseded on
2 August 2026 and read by nothing.

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

**The corpus.** These built and maintain the 95,567 closings the site
serves. None of them posts anything.

| | |
|---|---|
| `pass.js` | One release year, judged, with the working written down beside it. |
| `judge.js` | The judgement itself, shared by the pass and the repairs. |
| `audit.js` | Re-decides a year from its own files with the network unplugged. The check that makes the rest citable. |
| `rebuild.js` | Re-derives conclusions from stored evidence, offline, when a rule changes. |
| `retest.js` | Repairs verdicts that predate a rule change. The one repair that needs the network. |
| `provenance.js` | Asks Wikidata whether it already holds a death we recorded from TMDB. Corroborates; never overwrites. |
| `dedupe.js` | Collapses pictures a year's files hold more than once. Offline, idempotent. |
| `seed-removals.js` | Opened the retraction record with the departures already known. A one-off. |
| `enrich.js` | Genre, country and fame per year. `--countries` builds the label dictionary. |
| `build-corpus.js` | Pass output → immutable versioned static shards + `manifest.json`. |
| `../corpus.js` | The browser's client for those files. |

**The poster.** Finds closings and puts them on Bluesky.

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
| [docs/VERIFICATION.md](docs/VERIFICATION.md) | **The canon** — every logic rule in force, where it lives, and whether the audit checks it — then the same in plain prose |
| [docs/METHOD.md](docs/METHOD.md) | The same procedure written for citation — the source text for the site's "Methods and sources" |
| [docs/SOURCES.md](docs/SOURCES.md) | What is read, what is kept, how it is treated — privacy, licensing and citation |
| [docs/FINDINGS.md](docs/FINDINGS.md) | What the corpus says, what it only appears to say, and the rules for plotting it |
| [poster/README.md](poster/README.md) | The poster in detail |
| [licences/](licences/) | The third-party terms this project operates under, as downloaded |
| [HANDOFF.md](HANDOFF.md) | Current state and what's unfinished — **read first** |

---

## Licence

**The corpus is [CC0 1.0](LICENSE-CORPUS)** — public domain, no permission
needed, no attribution required. The citation format in `docs/SOURCES.md`
is requested rather than imposed.

**The software is [MIT](LICENSE).**

The TMDB marks in `tmdb.svg` and `licences/logos/` are TMDB's own and are
reproduced under their attribution terms; they are not covered by either.
`LICENSE-CORPUS` explains why CC0 is the right answer despite TMDB's terms
forbidding what CC0 grants, and what you should know before relying on the
data.

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
