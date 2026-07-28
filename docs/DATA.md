# Data

Everything here was measured against live Wikidata and TMDB during
development. Figures are point-in-time — both change daily — but the
orders of magnitude and the query costs are stable and worth trusting.

**Current state:** 2,819 pictures in the Vault across 31 countries;
1930–1945 releases backfilled; 3,805 films considered.

---

## Two sources, one of them authoritative

**Wikidata decides.** Who is credited, who has died, when, what type of
thing it is, which country. Every judgement rests on it.

**TMDB is asked two questions**, neither of them about facts Wikidata
owns:

1. *What characters did these people play?* Wikidata's `P453` is thin —
   The Umbrellas of Cherbourg has 0 of 29; TMDB has them all.
2. *Did Wikidata know the whole cast?* This is the one that matters. TMDB's
   cast lists are far fuller, and Wikidata stores TMDB's own ids
   (`P4947` films, `P4985` people), so the join is exact — no name
   matching.

The second question removed **278 wrong entries** from the Vault, caught
**14 of 60** candidates on the first real sweep, and reopened *The Glove*
(1979), which looked closed while Joanna Cassidy, Rosey Grier and Tony
Lorea were alive and all three in Wikidata.

---

## Why Wikidata and not TMDB alone

| | Wikidata | TMDB |
|---|---|---|
| Licence | CC0 | Non-commercial, attribution required |
| Key | none | required |
| Caching | unrestricted | 6-month maximum |
| Death dates | well maintained — they feed Wikipedia infoboxes | uneven |
| Cast lists | **incomplete** | much fuller |

The trade is deliberate. TMDB has better cast coverage; Wikidata has better
death data, no licence constraints, and no key. Since the entire project
turns on death dates being right and cast lists being *approximately* right,
Wikidata wins.

The incompleteness is not a footnote. It is the central limitation and every
guard in the codebase exists because of it.

---

## Properties in use

| Property | Meaning | Used for |
|---|---|---|
| `P31` = `Q11424` | instance of: film | search filter |
| `P161` | cast member | the roster |
| `P453` | character role (qualifier on P161) | character names |
| `P569` | date of birth | life spans, sort order |
| `P570` | date of death | **everything** |
| `P577` | publication date | release year |
| `P18` | image | portraits |
| `P106` | occupation | search filter |

### Crew properties

`P57` director · `P58` screenwriter · `P344` cinematographer ·
`P86` composer · `P162` producer · `P1040` editor ·
`P2554` production designer · `P4805` costume designer

**Below-the-line crew does not exist in Wikidata at all.** No grips, no
gaffers, no second unit, no sound. There is no free source for it. This is a
hard ceiling on what the project can ever claim.

### Occupations used in search

`Q33999` actor · `Q10800557` film actor · `Q10798782` television actor ·
`Q2259451` stage actor · `Q2405480` voice actor · `Q948329` character actor ·
`Q2526255` film director · `Q3455803` director · `Q28389` screenwriter ·
`Q222344` cinematographer · `Q3282637` film producer · `Q36834` composer ·
`Q7042855` film editor

**This list must stay generous.** Wikidata carries a dozen overlapping
occupation items and tagging is inconsistent between them. Catherine Deneuve
is tagged `Q10800557` (film actor) but **not** `Q33999` (actor), so a filter
built on `Q33999` alone returned nothing for her — as it did for Ennio
Morricone. Pacino, Duvall and Eastwood all carry *both*, which is what made
the gap invisible in early testing.

If a person is missing from search, check their `P106` first. It is almost
always an occupation item nobody thought to include.

---

## Measured coverage

### Cast completeness

| Film | Cast on record | Dead |
|---|---|---|
| Casablanca (1942) | 51 | 51 |
| The Godfather (1972) | 40 | 28 |
| Pulp Fiction (1994) | 35 | 7 |
| Star Wars (1977) | 24 | 17 |
| The Matrix (1999) | 19 | 4 |
| **The Stone Boy (1984)** | **1** | 1 |

The Godfather's real credited cast is closer to 60. *The Stone Boy* has one
cast member and four crew on record for a real feature — a stub. Note that
it would **not** have produced a false wrap: its director and producer are
both living, so the crew-inclusive test keeps it open. It illustrates thin
data, not a dangerous record.

### Character names — `P453`

| Film | Named | Share |
|---|---|---|
| The Godfather | 28 / 40 | 70% |
| Star Wars | 15 / 24 | 63% |
| Pulp Fiction | 6 / 35 | 17% |
| Viva Zapata! | 3 / 24 | 12% |
| Casablanca | 2 / 51 | 4% |

Coverage is worst on exactly the old films the archive is full of. Of 28
backfilled archive entries in the first sample, **zero** had a character
name. Every surface showing a character must read well without one.

### Coverage is not evenly distributed

The Vault is a map of Wikidata's editors as much as of cinema. Films of
1930–1945 recorded in Wikidata:

| Country | Films | With any cast |
|---|---|---|
| United States | 8,285 | 77% |
| France | 1,681 | 91% |
| Japan | 399 | 46% |
| India | 37 | 18% |
| China | 12 | 33% |

Japan made roughly 500 films a year in this period — some 7,000 — and
Wikidata holds 399. India's studios were enormously prolific; Wikidata has
**37 films across sixteen years**, seven of them with a cast list.

A picture cannot reach the Vault without a cast list, so the archive is
overwhelmingly American and European. Of 2,752 filed entries: 12 Japanese,
3 Egyptian, 1 Iranian, 1 Armenian.

**Nothing in the code causes this and nothing in the code can fix it.** But
left unexplained it reads as an editorial choice rather than a data limit,
which is why it belongs on the public About page and not only here.

### Portraits — `P18`

The Godfather cast: **28 of 42** (~67%). Skewed to leads; character actors
often have none. Photos span a century of processes, which is why the site
desaturates all of them.

---

## Query costs

Measured against the public endpoint. Anything at 60s+ was **killed by the
service**, not slow.

| Query | Cost |
|---|---|
| Search (films + people, one call) | 0.2s |
| Film crew | 0.22s |
| Film cast with characters and images | 0.46s |
| Per-person wrap check, crew-inclusive | 2.4s |
| Person filmography | 3.5s |
| Recent deaths, 90-day window | 10s |
| Per-year cast rollup (1932: 914 films) | 29s |
| Filmography with a separate cast count | **51s** |
| Per-year wrap check *with crew* | **timeout** |
| Global wrap query, six-year slice | **timeout** |

### What the timeouts force

Two design decisions come directly from this table.

**The archive page cannot be a live query.** Asking "which films have nobody
left" times out even for a six-year slice. The page reads a file the poster
writes. There is no alternative.

**Backfill must be two passes.** A cheap cast-only rollup per year to find
candidates, then the exact crew-inclusive test on each. Roughly 30s + ~0.5s
per candidate; 1930 produced 727 films with cast data and 206 candidates.

---

## What TMDB is worth, measured

Coverage across 2,415 measured Vault entries:

| | |
|---|---|
| median coverage | **64%** |
| under 50% | **919 pictures** |

The thinnest records in the Vault:

| Coverage | Picture | Wikidata / TMDB |
|---|---|---|
| 7% | The Wife Takes a Flyer | 5 of 70 |
| 8% | Stand Up and Cheer! | 10 of 123 |
| 9% | The Conspirators | 14 of 160 |
| 9% | Second Fiddle | 16 of 169 |
| 10% | Batman (1943) | 5 of 50 |

*Mildred Pierce* rests on 21 of 58. The median entry is sound; the tail is
not, which is why film pages name the people they can't account for
instead of claiming completeness.

**TMDB's own death data is not used.** It has a `deathday` field, but the
question asked of TMDB is only "who else was in this", and every death
date comes from Wikidata.

---

## The crew finding

Counting only cast produces **false wraps**. Tested against Robert Duvall's
filmography:

| | Wrapped films |
|---|---|
| Cast only | 6 |
| Crew included | 2 |
| After `MIN_CAST` | **0** |

Four of six reopened once crew counted — mostly because Coppola is alive.
The remaining two had two credited people each and were withheld as stubs.

A picture is not finished while its director is alive. Cast-only was quietly
overclaiming on every one of them.

---

## Search coverage

Filtering to `P106=Q33999` (actor) alone:

| Query | Result |
|---|---|
| `roger deakins` | **0 hits** |
| `kubrick` | did not return Stanley Kubrick |
| `coppola` | worked, but only because Francis is also tagged as an actor |

Hence the five-occupation filter. A film database that cannot find its most
famous living cinematographer is not a film database.

---

## Known gaps and hazards

**Unlabelled items.** Wikidata's label service returns the Q-number when an
item has no English label. Without a guard the poster would publish
*"Q3285451 has wrapped."* Two of the first 28 archive entries hit this. The
poster now skips them — which silently drops some legitimately obscure
foreign-language films. Falling back to the original-language label would be
the better fix.

**Row multiplication.** Films carry multiple `P577` release dates, one per
country. Joining them into an aggregate multiplies rows and inflates counts —
this produced a real bug reading `357/19 gone` and listing *To Kill a
Mockingbird* four times. Use `SAMPLE`/`MIN` on release year, and
`COUNT(DISTINCT …)` always.

**Vandalism.** Wikidata is openly editable. A false death date becomes a
confident public statement that a real person has died. This is the reason
for the approval gate, and it is not a theoretical risk.

**EventStreams.** `stream.wikimedia.org` returned 503 during testing and was
never verified. It is not used — polling is simpler and strictly more
reliable, since bulk imports do not always name `P570` in the edit comment.

---

## CORS

Both endpoints confirmed sending `access-control-allow-origin: *`:

- `query.wikidata.org/sparql`
- `www.wikidata.org/w/api.php` (with `origin=*`)

This is what allows the site to have no backend.

---

## Being a good citizen

The poster sends a descriptive `User-Agent` with a contact address, sleeps
between queries, and backs off on 429/503 with retries. Set it to a real
address in `poster/lib.js` — it is how Wikidata reaches you instead of
blocking you.


## What we can and cannot know about a person

Three answers, not two. The middle column is the one that took longest to
admit existed.

| | source | meaning |
|---|---|---|
| **dead** | Wikidata `P570`, or TMDB `deathday`, or a birth year older than 112 | safe |
| **alive** | TMDB `birthday` within a lifespan and no `deathday`; or Wikidata knows them with no `P570` | **veto** |
| **unknown** | neither database has a birth or death date | recorded, never assumed |

`unknown` runs at roughly **3.4 people per picture**. These are real
credits — TMDB names them — that nobody has dated. For the 1930s the
practical risk is small: anyone credited then is past 100. It rises
steeply with every decade the archive extends, which is the main reason
1946–1965 has not been attempted yet.

`unknownCount` is stored per Vault entry. It is the honest measure of how
much of a closing rests on nothing, and it is why coverage on Vault rows
is worth building.

## Why TMDB is the veto and not the roster

TMDB has fuller cast lists; Wikidata has better structured biography.
Neither is complete, and they fail differently:

- Wikidata omits people it *knows* — they exist as items, just not attached
  to that film. Asking by TMDB id finds them.
- TMDB omits dates. It will name a 1944 bit player and know nothing else
  about them.

So the roster comes from Wikidata, the completeness check comes from TMDB,
and **both are asked about life and death** — Wikidata via `P570`, TMDB via
`deathday`. Asking only one was the bug of 28 July 2026.

Below-the-line crew — grips, gaffers, sound, second unit — is in neither.
"Everyone" always means everyone recorded, and the colophon says so.
