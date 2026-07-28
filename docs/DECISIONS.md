# Decisions

Every significant choice, with the evidence that produced it. Written so a
future change can tell which constraints are real and which are taste.

---

## Wikidata over TMDB

**Decision.** Wikidata is the sole source.

**Why.** CC0, no key, no cache limit, and death dates maintained within hours
because they feed Wikipedia infoboxes. TMDB is non-commercial-only, requires
attribution, forbids caching past six months, and its `deathday` field is
unevenly maintained.

**Cost.** Cast lists are materially less complete. Accepted, and mitigated by
every guard below.

---

## Two decoupled halves

**Decision.** The site and the poster share nothing but `archive.json`.

**Why.** The site becomes a static artifact with no backend, no build step and
no dependencies. The poster can fail, be rewritten, or never be built at all
and the site still works.

**Consequence.** The archive page has a hard dependency on the poster, since
its query cannot be run live. Accepted — it degrades to an honest empty state.

---

## Event-driven, not a periodic sweep

**Decision.** Poll for recent *deaths*, then check only those people's films.

**Why.** Only someone who just died can have closed a film. This inverts an
expensive question into a cheap one and removes the need to pre-load a corpus
of films at all. A daily run finishes in about a minute.

**Origin.** Proposed by the client, replacing a much heavier design.

---

## Polling over event streams <a name="polling-over-event-streams"></a>

**Decision.** Cron, not `stream.wikimedia.org`.

**Why.** A death reaches Wikidata hours to days after the fact, so sub-second
delivery buys nothing. Polling is a cron line rather than a persistent
connection with reconnect logic, and it is strictly more reliable — the
stream only catches edits whose comment names `P570`, and bulk imports don't
always format cleanly.

**Note.** The stream returned 503 during testing and was never verified.

---

## Crew counts toward a wrap

**Decision.** Director, writing, camera, music, producer, editor, production
and costume design all count.

**Evidence.** Of Robert Duvall's six cast-only "wrapped" films, **four
reopened** once crew counted — largely because Coppola is alive.

**Why it matters.** A picture is not finished while its director is alive.
Cast-only was overclaiming on every one of them.

**Limit.** Below-the-line crew does not exist in any free database. "Everyone"
can only ever mean everyone recorded, and the colophon says so.

---

## The minimum cast floor

**Decision.** `MIN_CAST = 5` gates whether the poster announces a picture.
It never affects what the site displays.

**It is editorial, not a correctness guard** — and it started life as the
latter, which was a mistake worth recording.

The original reasoning: the post said *"X has wrapped"*, a bare claim about
the world that travels away from its evidence, so it needed a rule deciding
when that claim was safe. The post now states its own basis instead:

> All 51 people credited on Casablanca (1942) have now died.
> The 1 person credited on The Stone Boy (1984) has now died.

Both sentences are true whatever Wikidata is missing, and the second
announces its own thinness. There is no falsehood left to guard against, so
the floor only decides what is *worth* posting.

**The example that motivated it doesn't support it.** *The Stone Boy* (1984)
has one cast member on record, and was cited here as the false-wrap case.
It isn't: its director and producer are both alive, so the crew-inclusive
test already keeps it open. It illustrates thin cast data, not a wrap that
would have been wrongly announced. Counting crew does the protective work.

**Coverage is the real measurement.** Wikidata carries the TMDB film id
(P4947) for nearly every picture, and TMDB's cast lists are far fuller, so
completeness can be measured rather than guessed:

    The Stone Boy   Wikidata 1  / TMDB ~20  =   5%
    Casablanca      Wikidata 51 / TMDB ~60  =  85%

`review.js` shows this per picture and marks anything under 50% as THIN.
Once real percentages have been seen in use, `MIN_CAST` can go.

**Known wart.** The person page uses a coarser total-credits floor of 6,
because counting cast separately inside that query cost **51s against 3.5s**.

---

## Wikidata alone never decides that a picture has closed

**Decision.** Every path that concludes "no one is left" verifies against
TMDB first, by resolving TMDB's fuller cast list through `P4985`.

**Why.** Wikidata's cast lists are routinely a fraction of the real cast,
and the people it omits are usually people it *knows* — just not attached
to that film. The Vault re-check removed **278** wrong entries this way. A
45-day sweep had **14 of 60** candidates with living cast. *The Glove*
(1979) looked closed while Joanna Cassidy, Rosey Grier and Tony Lorea were
all alive and all in Wikidata.

**Where it applies — all six:**

| Path | Verification |
|---|---|
| Film page | TMDB-resolved cast merged into the roster |
| Person page | `survivingIds()` re-checks anything that looks closed |
| Vault | `archive.json`, built by verified paths |
| Sweep | `survivorsViaTmdb()` |
| Backfill | `survivorsViaTmdb()` |
| Watcher | `survivorsViaTmdb()` |

**This was missed three times.** Built for the Vault, then discovered
absent from the sweep, then from the person page, then from the watcher
and the backfill. Any *new* code that decides a picture has closed must
call one of these, and the list above should be updated when it does.

---

## The approval gate <a name="the-approval-gate"></a>

**Decision.** No automated posting, ever. `run.js` queues; `review.js` is the
only path to Bluesky and requires a keystroke per item.

**Why.** Wikidata is openly editable. A vandalised or mistaken death date
becomes a confident public statement that a real person's last colleague has
died — published under your name, about real people, possibly living ones.

It is the one error this project cannot walk back, and one keystroke prevents
it. Each queued item prints Wikidata links for both the film and the person.
**Opening them is the entire point.**

This is not a placeholder for later automation.

---

## Posts are grouped by person, not by film

**Decision.** The review queue and the Bluesky post are keyed on
person-and-date. One death produces one post, however many pictures it
closed.

**Evidence.** A prolific career takes several films over the line at once.
From films of 1930–31 alone: Mary Carlisle's death closed **four**, Margaret
Booth's and Loretta Young's **three** each. Across the 1930 backfill, 182
pictures resolved to **144 posts**.

Without grouping, Mary Carlisle would have produced four near-identical
skeets in a row — a spam burst that buries the actual story, which is the
person rather than the films.

**Note.** Two of the top five multi-closers were crew — an editor and a
cinematographer. Further evidence for counting crew.

**Each posting is a two-part thread: the pictures, then the person.** One
post couldn't hold both. Four films with their stars ran to 292 of 300 as a
semicolon-choked line, with the person — the actual story — crushed in
beside them. Splitting doubles the budget and gives each half its own shape:
a list, then a name. Each post links what it is about.

**A fixed cap of five pictures per post**, not "however many happen to fit".
Predictable post shape, and the person's page is the right home for a long
list. Ordered by the film's own sitelink count, so when someone closes
fourteen pictures the five a reader would recognise are the five that show —
not whichever five the query returned first. Stars are dropped before titles
if even the capped list overruns. The "and N more" link appears only when it
is doing work; when the list is complete, repeating the second post's URL
would be noise.

**Length is counted in graphemes, not bytes.** Bluesky's limit is graphemes;
an earlier byte count was safe but truncated non-Latin titles for no reason
— *羅生門* is 3 graphemes and 9 bytes. Byte offsets are still what link
facets use, which is correct.

Each picture remains its own archive entry, sharing a post URL.

**No pronouns.** The text says "pictures wrapped that day" rather than
guessing a pronoun for a person we only know from a database row. It's also
simply accurate — the wrap date is the death date.

---

## Television counts

**Decision.** Series and miniseries are searchable, and the poster treats
them exactly like films.

**The objection this reverses.** Television cast lists on Wikidata are
badly incomplete — Cheers has 11 for 275 episodes, The West Wing 10 — so
the first call was that TV would manufacture false wraps.

**Why that was wrong.** The risk scales *inversely with age*. For a 1951
series the actors Wikidata never recorded are dead too, so incompleteness
cannot produce a false closing. The danger sits with middle-aged shows
where the unrecorded are plausibly alive. Old television is both the safest
and the most interesting material available.

**The case that settled it.** *I Love Lucy*: 17 cast on record, 16 dead.
The bar sits one row from the top and the sole survivor is Keith
Thibodeaux, the child who played Little Ricky.

**"Picture wrap" fits.** It marks the completion of principal photography
and is used on television productions as readily as features; "picture"
there means the photography, not the feature-film sense.

**No code needed changing.** `wrappedFilmsQuery` and `wouldWrapQuery` never
filtered by type — they ask what a person is credited on. Only the search
filter needed the series types added.

**Still outstanding.** The backfill's candidate finder is film-only
(`P31=Q11424`). Series use `P580` rather than `P577` for dates, so that is
a separate pass.

**Animation is out.** Animated series record voice actors under `P725`,
which nothing here reads: BoJack Horseman has 0 cast and 5 voice actors,
The Simpsons 0 and 16. They simply never close, which is a harmless
absence rather than a wrong answer.

---

## Never require a field Wikidata might not have

Three bugs, one mistake, all found in a single sitting. Each came from
writing a *required* pattern for data that is merely usual.

**English labels were mandatory.** Both metadata queries opened with
`?f rdfs:label ?l . FILTER(LANG(?l) = "en")`. Any item without an English
label returned a row with no name, and the page rendered headless. This hit
every non-English title on the site — and **Meryl Streep**, who has an
English *description* but no English *label*, so her page was nameless and
her search result read `Q873`.

Now three tiers: English, then a major language, then anything at all.
Same fix on the dropdown via `languagefallback=1`.

**The backfill silently deleted 319 films.** Same cause, worse effect: a
French film with no English label came back as `Q16673908`, the
`unnamed()` guard skipped it, and it was recorded in `state.seen` *before*
the skip — so no future run could ever offer it again. The losses were
almost entirely non-English: 92 French, 60 Danish, 55 Italian, plus
Egyptian, Tamil, Bulgarian and Turkish pictures.

Recovered: 299 refiled after re-verification, 20 correctly excluded for
having survivors. Danish nearly doubled. Every label lookup now falls back
through 60+ languages.

**Animation was invisible.** BoJack Horseman is `Q117467246`
("animated television series"), a *different item* from `Q5398426`
("television series"), so the search filter excluded it. And animation
records its cast under `P725` (voice actor), not `P161` — The Simpsons has
0 cast members and 16 voice actors — so even once found it had no roster.
Both fixed; `P725` now counts as cast everywhere.

**The rule.** Wikidata's completeness is the subject of this project. Every
query must treat missing data as ordinary, because it is. `OPTIONAL` and a
fallback, never `FILTER(LANG(...) = "en")` as a required pattern.

---

## The person page is sorted by year, newest first

**Decision.** A filmography is sorted by release year, newest first, on
both sides of the bar.

**Why not by proximity to closing.** That was the original, and it was the
film page's logic applied where it doesn't belong. A person's page is a
career, not a countdown.

**Why newest rather than oldest.** Oldest-first reads better as a document,
but newest-first makes this bar mean what the bar means everywhere else:
the oldest still-open picture sits directly above it — the one most likely
to close next — and the most recently closed sits directly below. Same
rule as a film page, same direction as the Vault. The site now runs one
way throughout.

---

## Hash routing <a name="hash-routing"></a>

**Decision.** `#/film/Q47703`, so no server rewrites are needed.

**Cost.** Everything after `#` is never sent to a server, so **link previews
cannot be per-film**. Every shared link produces the same generic card.

**Status.** Unresolved. Options are: accept it; have the poster prerender
static pages with real OG tags for archived films only (a bounded set);
or an edge function covering all films. See the next entry.

---

## The single-tool constraint <a name="the-single-tool-constraint"></a>

**Decision.** No backend, no database, no build step, no dependencies, no
accounts, no cookies, no analytics.

**Why.** It is a stated value of the project, not an accident. The site is
three files that will still work in ten years.

**The two things that would cross the line** — per-film link previews and
search analytics — are the *same* crossing. If it happens it should happen
once, deliberately, with both in view.

**If analytics ever happen:** log the query, never the querier. Search terms
here are people typing the names of the recently dead. Storing those beside
IP addresses creates a record of who is checking whether whom is still alive.
No IPs, no cookies, no session IDs.

**The better version of that idea** is not an analytics page but a *gaps*
page: films the site could not answer for because Wikidata has too little on
record. That is useful to a visitor, improves the project's own accuracy, and
invites contribution rather than surveillance.

---

## Unlabelled items are skipped

**Decision.** A film whose English label is a Q-number is never announced.

**Evidence.** Two of the first 28 archive entries. Without the guard the
poster would have published *"Q3285451 has wrapped."*

**Cost.** Silently drops some legitimately obscure foreign-language films.
Falling back to an original-language label would be the better fix.

---

## Naming

**"Picture Wrap."** A picture wrap is the end of shooting for an entire
production, as distinct from a day's wrap.

Considered and rejected: **Martini Shot** — the final camera setup of the
day. Warmer and more insider, but Rob Long has run a KCRW commentary of that
name for over twenty years in exactly this audience, and the term means
day-scale finality when the project is about the permanent kind.

---

## Copy decisions

**The tagline carries the idea alone.** A landing paragraph was written and
cut; it explained the mechanism rather than the idea.

**The archive's line is "My god, it's full of stars."** Client's. It works on
both readings — the literal joke about a page of dead stars, and the actual
sense of the line, awe at a vastness that turns out to be populated. Left
unattributed deliberately: anyone who recognises it doesn't need the credit.
(For the record it is Clarke's novel and *2010*, not Kubrick's film.)

**Post text is deliberately plain.** No adjectives, no elegy. Where a
character name exists it is used; it usually doesn't, so the plain form is
what's actually written to.


## Counts over rows are wrong in every aggregate query

*Recorded after the fourth instance.*

SPARQL returns rows, not entities. Every extra value on any optional
property multiplies them. This project has now been bitten four times:
release dates inflating cast counts, To Kill a Mockingbird listed four
times, demonyms turning "American" into "Americans", and finally the
backfill's gate reporting more dead people than credited people.

The rule: **any count of people must be `COUNT(DISTINCT ?person)`, and any
conditional count must be `COUNT(DISTINCT ?boundCopy)` via
`OPTIONAL { ... BIND(?person AS ?boundCopy) }`.** Never `SUM(IF(BOUND(...)))`.

The failure is silent and one-directional — it inflates, so equality tests
fail and things get dropped rather than wrongly included. Nothing looks
broken; the archive is just quietly missing half of what it should hold.

## An English name can exist without an English label

Q451811 — Robert Preston, the American actor — has no English label and no
English alias on Wikidata. The language fallback therefore walked to the
next entry in the list and rendered him as "Роберт Престон".

The fallback was right; the data is incomplete. The fix is to try the
English Wikipedia article title before settling for another script, since
the article title *is* the English name. Applied only when a label has no
Latin characters at all — a French or Swedish name is left alone, because
it's readable and may be the only name the person ever had.
