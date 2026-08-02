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
| `P31` = `Q11424` | instance of: film | search filter, backfill finder |
| `P161` | cast member | the roster |
| `P453` | character role (qualifier on P161) | character names |
| `P569` | date of birth | life spans, sort order |
| `P570` | date of death | **everything** |
| `P577` | publication date | release year |
| `P580` | start time | a series' first year |
| `P18` | image | portraits, and the viewer |
| `P106` | occupation | search filter |
| `P4947` | TMDB **film** id | the join for films |
| `P4983` | TMDB **series** id | the join for television |
| `P4985` | TMDB **person** id | the join for people |
| `P725` | voice actor | animation, where `P161` is empty |

### Reaching a date's precision

`wdt:P569` gives a value and nothing else, and a date known only to the
year serialises as **1 January** because it has to serialise as something.
The precision is only reachable through the full statement path:

```sparql
?p p:P569/psv:P569 ?birth .
?birth wikibase:timeValue ?dob ; wikibase:timePrecision ?prec .
```

`9` is year-only, `11` is to the day. Without this the two are
indistinguishable, and a cataloguer's placeholder reads as a birthday —
which is how a man with one undated record kept a 1945 picture open at the
age of 106.

`P570` can also carry **no value at all**: an editor asserting a death
without a date. The query service returns that as a skolem IRI, not a
date, so it must be read as *a death was asserted* rather than sliced into
a string. Sliced, it produced a death date of `http://www`.

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

## What the 1946–65 backfill measured

*29 July 2026. Twenty years, nine hours, against the fixed verification.*

**Candidates worth testing, by year** — films whose Wikidata cast is
entirely dead and which clear the cast floor:

| 1945 | 1955 | 1965 | 1975 | 1985 | 1995 | 2005 |
|---|---|---|---|---|---|---|
| 323 | **392** | 174 | 70 | 10 | 2 | 1 |

The richest year is not where the archive started. 1955 offers more than
1945, and the curve collapses after about 1975 — by 1995 a whole year
yields two candidates. That is the shape that says where to stop.

**Rejections, by year** — candidates where TMDB found a living person
Wikidata had not linked to the picture:

| 1946 | 1949 | 1953 | 1957 | 1961 | 1965 |
|---|---|---|---|---|---|
| 14% | 17% | 25% | 41% | 44% | **56%** |

It rises smoothly, which is itself evidence the test is measuring
something real rather than failing at random. By 1965 more than half of
all candidates have somebody alive on them.

**1,711 rejections across the twenty years.** Every one a picture Wikidata
declared closed with a living person in it.

**The Vault after filing**, by release decade: 1920s 9 · 1930s 2,360 ·
1940s 2,329 · **1950s 2,549** · 1960s 534 · later 3. The fifties are the
largest decade, and the old 1930–45 range missed them entirely.

**389 entries carry no TMDB id** and cannot be verified by anything but
Wikidata's own view of itself. Only 276 of them are *flagged* `unverified`
— the flag was added on 28 July and survives filing only from that point,
so it undercounts by every entry filed before it existed. The flag is a
record of what we noticed, not of what is unverifiable; count the missing
id, not the flag.

---

## Television, measured

*29 July 2026.*

| | |
|---|---|
| Series on Wikidata carrying `P4983` | **52,458** |
| BoJack Horseman, credited on Wikidata | **6** |
| …via `/tv/{id}/credits` | 5 cast (billed regulars only) |
| …via `/tv/{id}/aggregate_credits` | **248 cast, 179 crew** |
| Of that cast, Wikidata can place | 229 |

A series' plain credits endpoint is the billed regulars and nothing else,
which is why television pages looked empty. `aggregate_credits` is
everyone who ever appeared.

A series *wrapping* remains vanishingly rare — hundreds of credits across
years — which is why the backfill finder stays film-only. Widening it was
measured at 2–11 extra candidates a year, almost none of them series.

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

Coverage across 2,415 measured Vault entries, *July 2026, when the Vault
held 2,819 and covered 1930–1945 only.* Not re-measured since it tripled.

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
| **dead** | a death date from either database, a death asserted without one, or an age past 122 | safe |
| **alive** | a birth date we can credit, and no death anywhere | **veto** |
| **unknown** | no usable evidence, *or* an age past 112, *or* a lone imprecise birth date nothing corroborates | recorded, never assumed |

Silence infers nothing, and neither does a lookup that failed. Age infers
one thing only, at one line: 122, Jeanne Calment's, the longest life on
record. Past it a person cannot be living; between 112 and 122 we do not
know; and a person with no birth date at all is still reached by it,
because nobody worked on a picture before they were born and the release
year bounds the birth year.

The inference yields a death, never a date. That distinction is the
difference between a picture that can close and a picture that can be
dated, and only the second is ever claimed on a page.

A birth date counts if it is precise, **or** if both databases give one
and agree on the year. Two sources agreeing is evidence even when neither
is precise; one imprecise date that nothing corroborates is a year
somebody typed into a field.

`unknown` runs at roughly **3.4 people per picture**. These are real
credits — TMDB names them — that nobody has dated. For the 1930s the
practical risk is small: anyone credited then is past 100. It rises with
every decade the archive extends, and the 1946–65 backfill is the
measurement of that: candidates rejected for having a living person ran at
14% in 1946, 27% by 1953 and **56% by 1965**.

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

---

## What the corpus pass stores

*Added 2 August 2026. The Vault's shape is documented above and is being
replaced by this one.*

Four files per release year, under `PW_PASS`, plus one gzipped copy of
each finished year under `PW_PASS_ARCHIVE`.

**`works.jsonl`** — one line per picture.

| field | |
|---|---|
| `id`, `title`, `year`, `releaseYears` | the picture; all release dates, not a sample |
| `type` | Wikidata's P31 label — film, short film, silent film, television film… |
| `genres`, `countries` | from `enrich.js`; countries are demonyms, all of them for a co-production |
| `verdict` | `closed`, `open`, `unchecked` |
| `reason` | `wikidata-living`, `wikidata-only`, `tested`, `tmdb-survivor`, `tmdb-no-answer` |
| `wrapped`, `wrappedMonth`, `wrappedYear`, `dateBasis` | the closing at the resolution its source recorded: `day`, `month`, `year` or `none` |
| `last` | who closed it — ids, name, death, source, `onScreen` |
| `makerCount`, `tmdbCredited`, `coverage` | how much of the record this rests on |
| `unknownCount`, `unknownNames` | the unaccounted-for, **by name** rather than as a count |
| `checkedAt`, `rules` | when, and under which thresholds and code revision |

**`evidence.jsonl`** — one line per picture, holding every person judged:
both databases' dates kept apart, birth *and* death precision, the verdict
for that person, and flags for `impossible` (born after release) and
`buriedByName` (which Wikidata item matched, and on what).

**`people/<year>.jsonl`** — one row per human, merged on demand by
`rebuild.js --people`. Written per year because a single merged file was
being read and rewritten whole by every year, which is nothing at 13,781
people and a 240 MB rewrite by the 1970s.

**`failures.jsonl`** — what did not answer, so a re-run knows what to
retry rather than a gap being indistinguishable from a finding.

### The published shape

`build-corpus.js` turns all of that into immutable, versioned, static
files: `closed/<YYYY>.json` (the Vault's own axis), `year/<YYYY>.json`
(release year), `day/<MM-DD>.json`, `month/<YYYY-MM>.json`, `ids.bin` —
sorted 32-bit Wikidata numbers for membership, a quarter the size of the
JSON it replaces — and `facts.bin`, 25 bytes a picture, for questions that
cross two columns.

Two columns in the facts table exist to keep its users honest: `closer`,
because one death closes up to 812 pictures and a count of pictures
overstates its evidence by up to sevenfold, and `makers`, because nearly
every apparent trend in this archive is that number changing over time.
`corpus.js` therefore offers `count()` and no bare total, and `count()`
returns pictures *and* distinct deaths.

