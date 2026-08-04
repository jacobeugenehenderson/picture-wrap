# Licences

The terms this project operates under, downloaded on **3 August 2026** and
kept as fetched. Terms change without notice and the version we agreed to
is the one in force at the time; a copy on disk is the only way to know
later what it said.

Each document is kept twice: `.html` exactly as served, and `.txt` as
readable text extracted from it. The HTML is the record; the text is for
reading and grepping.

## What is here

| file | source | dated |
|---|---|---|
| `tmdb-api-terms-of-use` | https://www.themoviedb.org/api-terms-of-use | last updated 20 October 2023 |
| `tmdb-terms-of-use` | https://www.themoviedb.org/terms-of-use | the site terms the API terms sit on |
| `cc0-1.0-legalcode` | https://creativecommons.org/publicdomain/zero/1.0/legalcode | version 1.0 |
| `wikidata-copyright` | https://www.wikidata.org/wiki/Wikidata:Copyright | oldid 1523614187 |
| `wikimedia-terms-of-use` | https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use | the operative Wikimedia terms |
| `bluesky-terms-of-service` | https://bsky.social/about/support/tos | last updated 14 August 2025 |

`cc0-1.0-legalcode.txt` is Creative Commons' own plain-text edition rather
than an extraction, so it is authoritative on its own.

`wikidata-copyright.txt` is short because the page is short: its whole
operative content is the standing footer notice — structured data in the
main, Property, Lexeme and EntitySchema namespaces is CC0, other
namespaces are CC BY-SA. The structured data is what this project queries.

## What they say, in one line each

- **TMDB** — no commercial use, no caching beyond six months, no
  derivatives, no AI/ML training, attribution required with the logo. The
  grant is non-exclusive, non-transferable, non-sublicensable. Operated by
  **TiVo Platform Technologies LLC**, which the terms name and the docs
  did not.
- **Wikidata** — CC0 on the structured data. Imposes nothing.
- **Bluesky** — ordinary platform terms; this project posts, it does not
  read at scale.

`docs/SOURCES.md` §6 and `docs/BACKLOG.md` carry the analysis of what
these mean for licensing the corpus. This directory carries only the
documents.

## The TMDB logos

`logos/` holds all five marks from
https://www.themoviedb.org/about/logos-attribution, downloaded the same
day. TMDB fingerprints its own asset filenames with a SHA-256 of the
contents, and **all five of ours match that digest**, so these are intact
and unmodified.

| file | viewBox | reads |
|---|---|---|
| `tmdb-blue-long-1.svg` | 423 × 35.4 | THE M●VIE DB |
| `tmdb-blue-long-2.svg` | 489 × 35.4 | THE M▬VIE DB, wider pill |
| `tmdb-blue-short.svg` | 273 × 35.5 | TMDB ▬ |
| `tmdb-blue-square-1.svg` | 190 × 81.5 | TM▬ / ▬DB, two lines |
| `tmdb-blue-square-2.svg` | 185 × 133 | THE / MOVIE / DB, three lines |

Each is a single path filled with one horizontal gradient
(`#90cea1` → blue). They recolour only by changing that gradient, which
the terms do not permit — use them as they are.

**The condition attached to using them:** the terms require the logo be
displayed *less prominently than the application's own branding*, together
with the notice

> This product uses TMDB and the TMDB APIs but is not endorsed, certified,
> or otherwise approved by TMDB.

which the colophon already carries, unconditionally, on every page.
