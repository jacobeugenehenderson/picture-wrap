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


## Both databases answer both questions

*The most consequential bug this project has had. Found 28 July 2026.*

`survivorsViaTmdb` asked TMDB **who was in a film**, resolved those people
against Wikidata, and asked Wikidata **whether they were alive**. Anyone
TMDB named that Wikidata could not match to a person record fell out of
the loop entirely — not flagged, not deferred, silently counted as dead.

It affected **74% of Vault entries**, 8,724 people in total. One picture
was filed with 107 unresolved names.

TMDB carries `birthday` and `deathday` on its own `/person/{id}` records.
The information was always there and was never asked for.

**The rule now: each database answers what it is good at, and neither is
asked to answer for the other's gaps.** Wikidata resolves the people it
knows, with real death dates. TMDB answers for everyone else.

### Three states, not two

| | |
|---|---|
| `dead` | a death date, or an age beyond `MAXIMUM_AGE` (122) |
| `alive` | a birth date within a human lifespan, no death date — **veto** |
| `unknown` | neither date, or the lookup failed |

`unknown` is the point. Two states force a guess, and the guess was always
"dead", because that is what silence looked like. It is now counted and
stored as `unknownCount` and it is **never** read as dead. For a 1935
picture nearly every unknown really has died; for a 1965 picture that
assumption is worthless. The number is what lets a page say so.

The age test cuts both ways deliberately: someone born in 1890 with no
death date is a missing record, not a survivor.

### The worked example

*The Wizard of Oz* was minutes from being filed. Wikidata has 32 people on
it, all with death dates, Jerry Maren last on 24 May 2018 — which is why
it was described as closed more than once, including in this repository.

TMDB credits **Caren Marsh**, Judy Garland's stand-in, born 16 April 1919,
no death date. She is 107. The picture has not wrapped.

### Crew counts on both sides

The check now reads TMDB's `crew` as well as its `cast`. The Wikidata side
has counted crew since the eight crew properties were added, so cast-only
was the inconsistency, not the fix. On a 40-picture sample it reopens 5%.

## A second copy of the logic is a second copy of the bug

`recheck.js` and `recover.js` each carried their own version of the TMDB
check — the same three queries, written out again. Both kept the bug after
the original was fixed, because fixing one did nothing to the others.

Both now call `survivorsViaTmdb`. `recheck.js` went from 185 lines to 148.

This is the same lesson as `shared.js`, learned again in a place where it
mattered more: a drifting constant produces a cosmetic difference, but
drifting *logic* produces two different answers to "is this person alive".

`app.js` carried two more copies and kept the **original** bug through
three separate fixes to the others, because nobody fixing `lib.js` was
looking at the browser. A film page could show the bar at the top while
TMDB knew someone in it was alive — *The Wizard of Oz* did, on Caren Marsh
Doll, for as long as the site existed.

Resolved the same day by `verify.js`, below.

---

## verify.js, and the boundary drawn around decisions

*28 July 2026.*

**Decision.** The survivor test lives in one file at the repository root,
imported by the browser and by the poster. It fetches nothing; the caller
passes in `sparql()` and `tmdb()`.

**Why.** `shared.js` drew the shared boundary around **constants**. That
was the wrong line. Four copies of the survivor test existed — `lib.js`,
`recheck.js`, `recover.js`, `app.js` — and each fix touched one of them.
A drifting constant is a cosmetic difference; drifting *logic* is two
different answers to whether a person is alive.

Fetching is the one thing the halves genuinely cannot share: the poster
sends a User-Agent and retries on 429, and a browser is allowed to do
neither. Everything else — what the answers mean — is identical and now
provably so.

**The test for shared code** is not "is it a constant". It is *can the two
halves give different answers, and would that be a bug?*

---

## An absent death date is not a pulse

*The day's one bug, in six disguises. 28 July 2026.*

Every one of these was the same mistake: **silence read as an answer.**

| | |
|---|---|
| Stopped at Wikidata | Anyone TMDB named that Wikidata could not place was counted dead. 74% of the Vault. |
| Stopped at pass one | A Wikidata item with no `P570` was read as living, so TMDB was never asked. Robert Amon had a Wikidata item with no dates and a TMDB record saying he died in 1992. |
| Missed the unlinked | Péter Eötvös died in 2024, recorded on Wikidata, no `P4985` — so the id lookup missed him and TMDB had no `deathday`. |
| Took a placeholder literally | Bill Alcorn, "Soldier (uncredited)", born `1920-01-01` and nowhere else at all, closing out *Mildred Pierce* at 106. |
| Let SPARQL decide | Two Wikidata items claiming one TMDB id, and whichever row came back first won. *The Priest's Secret* held through two re-checks and reopened on the third, on row order alone. |
| Read a failure as a pass | An empty survivor list from a test that never ran. Measured: with TMDB unreachable, the re-check reported "21 still closed" where it should have reported none. |

**The rule.** Only a recorded death makes anyone dead. Absence does not,
and a lookup that failed does not. The three states are dead, alive and
unknown, and unknown is never read as either.

*Amended 30 July 2026.* Age does not either, with one exception that is
arithmetic rather than inference — see *An age nobody has reached is an
answer*. Nothing else about this entry changes: every disguise above was
silence being read as an answer, and silence still is not one.

**What it cost to be wrong.** The 1946–65 backfill rejected 1,711
candidates on the strength of this test — 1,711 pictures Wikidata declared
closed with a living person on them.

---

## Evidence, not thresholds

*28 July 2026.*

**Decision.** Three tuned numbers were removed. What replaced them is a
test for the evidence they were standing in for.

| was | now |
|---|---|
| "past 100, a 1 January birthday is a placeholder" | A birth date counts if it is **precise**, or if **both databases give one and agree on the year**. Wikidata publishes precision (`timePrecision`; 9 is year-only, 11 is to the day) so we ask rather than infer. TMDB publishes none, so there the 1 January ending stays a proxy — a limit of the source, not a choice. |
| "birth years within two of each other are the same person" | Exact year. A disagreement means no match, which leaves the person standing and vetoing — the direction to fail in. |
| "older than 112 is dead" | Older than 112 is **unknown**; older than 122 — Jeanne Calment's, the longest life on record — is **dead**. Two lines, because the error each risks runs the opposite way. See *An age nobody has reached is an answer*. |

**Why it is better rather than merely purer.** Antoine Petitjean is
recorded on Wikidata as born `1977-01-01`, precision 9, and linked to a
1959 picture. At 49 no age threshold would ever have caught him. An
imprecise date that nothing corroborates catches him immediately.

**Heuristics are not banned.** A judgement call that cannot be avoided is
fine; one dressed as a measurement is not. A heuristic may move somebody
between *alive* and *unknown*. It may never put anyone in *dead*.

---

## The Vault is served in pieces

*28 July 2026.*

**Decision.** The poster writes `archive.json` for itself and `vault/` for
the browser: a 1 KB summary, an ids file, and one file per decade a
picture closed in. The site never fetches `archive.json`.

**Why.** It was 1.5 MB, pulled on the landing page, the Vault, and — once
person pages started reading it — every person page. It is 4.5 MB now.
The landing page still costs 1 KB and the largest decade a reader can open
is 920 KB, fetched only if they open it.

**Both files are written by one call.** `saveArchive()` saves the archive
and republishes the shards; `saveState()` does the same for state and its
committed twin. A derived file that can be forgotten goes stale.

---

## A film is recorded as seen when it is queued, and not before

*28 July 2026. This entry replaces one that described the opposite as a
feature.*

**Decision.** `state.seen` records a picture at the moment it is queued.
Everything declined is left unrecorded.

**Why.** It used to be stamped on the way in — before the name check,
before the cast floor, before the survivor test. So a picture declined
because somebody was still alive could never be offered again, *including
after that person died*. The single event that resolves such a picture was
the event it had made itself deaf to. **1,367 pictures were sealed off
that way** before it was found; they have been cleared.

**The cost, accepted.** Films already declined get re-tested when they
surface again. That is exactly the work finding them requires.

---

## The desk will post, and the terminal will stay

*Designed 28 July 2026, not yet built.*

**Decision.** The authoring tool publishes. It does not draft and hand off
to `review.js`.

**Why.** Handing off means approving twice, and the second approval is the
blind one — a terminal cannot show the images you spent five minutes
judging. That is not two gates; it is one gate and a ritual, and rituals
carrying no information are how gates stop being read.

**The safety property was never "review.js is the only file".** It is *one
human approves one post at a time having seen the evidence*, and a browser
does that better than a terminal ever has. What makes it safe is a single
`publish.js` both front ends call, an endpoint that publishes exactly one
group, and rehearsal mode by default.

---

## The watcher is a button, not a service

*28 July 2026.*

**Decision.** `watch.js` runs when started by hand.

**Why.** A launchd agent was built and reverted. The repository lives under
`~/Desktop`, which macOS gates behind TCC, so a background agent cannot
read even its own launcher — it fails at exit 127 and no permission prompt
ever appears. Enabling it means Full Disk Access for `/bin/zsh`: every
script anything runs through zsh, forever, so one listener can start at
login.

Wrong trade, and the wrong thing to automate first. The watcher has never
fired on a real death and its name extraction is crude by its own
admission. The proven automation — the sweep — is not scheduled either.

**What improved instead.** The launcher restarts node if it dies, and
drops `BSKY_APP_PASSWORD` before starting: the watcher reads a public
firehose and cannot post, so it never needed the posting credential.

---

## An age nobody has reached is an answer

*30 July 2026. Found by one search.*

**Decision.** Past 122 — Jeanne Calment's 122 years and 164 days, the
longest documented life — a person is `dead` rather than `unknown`. A
person with no birth date is reached by the same arithmetic through the
picture's release year, since nobody worked on a film before they were
born. `OLDEST` (112) is unchanged and still moves people only from *alive*
to *unknown*.

**Why.** The ceiling existed and decided nothing. Three separate places
asked whether someone was living and none of them applied it:

- `verify.js` held it, and used it only to withhold *alive*.
- The film page never called `verify.js` for Wikidata's own credits at
  all. Its test was `!p.dod` — a missing death date, and nothing else.
- The person page's filmography test counted credits against deaths in
  SPARQL, so it had no way to express it.

**What it cost.** *The Fortieth Door* (1924) was held open by Bruce
Gordon, born 1850. He would be 176. Naval Gandhi, born 1897, held five
pictures open at once. Measured against Wikidata: of the pictures it still
shows as running, **14 of 65 from 1924, 27 of 170 from 1931 and 18 of 135
from 1945** were held open by nobody but someone past 112 with no recorded
death. They never entered the Vault, never became candidates, and nothing
anywhere reported them as a problem — the only way to find one was to look
at a page and know.

**What it does not buy.** A date. The inference says a person is gone and
cannot say when, so these pictures close on the last death actually
recorded and their unrecorded maker appears at the foot of the page with a
dash. That is the same shape as the 72% of Vault entries that already
carry a non-zero `unknownCount`; what changed is that Wikidata-credited
people are now read by the same rule as TMDB-resolved ones.

**Where it lives.** `beyondLiving()` and `couldBeLivingSparql()` in
`verify.js`, imported by the film page, the person page, both candidate
queries, the re-check, the recovery script and `explain.js`. Written once,
in the file that exists because this logic has been copied three times and
every copy kept the bug after the original was fixed.

---

## Listings are free

*1 August 2026.*

**Decision.** The pass applies no minimum cast. Every picture whose record
is complete — every credited maker dead — is judged and written down,
whether it has forty names on it or one.

**Why.** `MIN_CAST = 5` was demoted from a correctness guard to an
editorial one and then kept doing a third job nobody assigned it: deciding
what the archive contains. It gates `run.js:250` and `:263`, neither of
which can post — 37 of 11,457 Vault entries have ever been published, and
7,828 came from a backfill that cannot publish at all. An editorial rule
justified by what goes to Bluesky was governing an archive that is 99.7%
never-posted.

**What it was costing.** Complete-record pictures excluded by the floor,
by year: 585 in 1913, 775 in 1924, 668 in 1931, 516 in 1945, 768 in 1960.
Roughly 500–780 a year against a Vault of 11,457. And the floor counted
`P161` only, so a picture with four cast and twelve crew read as "4 on
record" — a cast-shaped gate on a crew-inclusive test.

**The measurement that settles it.** A floor is a bad proxy for thinness.
Of 40 Vault entries sampled, all of which passed `MIN_CAST`, a third are
under 50% of TMDB's credit list — *Rhubarb* (1951) is 30 of 113. The
floor keeps the pictures whose thinness is invisible and drops the ones
that announce it: a one-row roster tells a reader exactly what they are
looking at.

**So thinness is carried, not gated.** Every work record holds
`makerCount`, `tmdbCredited` and `coverage`, and the unknowns are listed
by name rather than counted. The claim states its own basis and the reader
decides.

**Where the floor still belongs.** `run.js:81`, the sweep, where a human
reads a queue of pictures destined to be posted. A 45-day window with no
floor queued 540 films, 397 with nothing but a director on record. That is
a queue-management problem and it is real — but it should count makers
rather than cast, and it has nothing to do with what the archive holds.

---

## The door held open

*1 August 2026.*

**Decision.** A living person appears on this site as a credit on a
picture. Never as an entry in a list. There is no ranked list of last
survivors, and there will not be one — not sorted by age, not by how close
their picture is to closing, not at all. The same facts are published as a
documented dataset, for people who come looking on purpose.

**What was proposed and rejected.** The pass can identify, exactly,
every picture that hangs on one living person: 40,962 still running,
**19,751 of them held open by a single person.** As a page that is a death
watch. Every date in it is already public, which is beside the point —
the aggregation is the artifact. A list of human beings ordered by
proximity to their own death is not a fact about cinema, whatever it was
assembled from.

**The framing that replaces it.** When a picture wraps, the world
circumscribed by that picture goes out — not the film, which survives, but
the living connection to it: nobody left who was there. Until then the
door to that world is held open, sometimes by one person.

That is the same sentence read from the other end, and everything about it
is different. A watch list asks *when will this person die*. This asks
*what is still reachable, and for how long* — the subject is the world, the
person is the one holding the door, and it is addressed to the reader.

**Four rules follow.**

1. The subject of a page is a picture. A living person is a credit on it.
2. Never sort living people by age, proximity or fragility. Sort by the
   picture, oldest first, which keeps the subject where it belongs.
3. Don't aggregate private individuals. Someone with a Wikipedia article
   has a public record; a bit player with one credit did not ask for
   this. Sitelink counts already give a usable line — `fame` computes
   them.
4. The language is *held open by*, not *last surviving*.

**The site already draws this and never says it.** The gold bar rising as
the living block shrinks IS the door closing, and when one person is left
the bar sits one row from the top. The page shows it perfectly and does
not name it. What is missing is the other direction: you can only see a
door about to shut if you already knew to open that film. Nothing lets a
reader ask which doors are nearly closed.

**So the surface to build is an invitation, not an index.** Oldest
pictures still open, first. It expires, which is exactly why it is worth
publishing.

**The research case, and why "obituary" is the wrong word for it.** News
desks and preservationists do prepare material in advance, and they have
Liza Minnelli covered. They have never heard of Caren Marsh Doll, who is
107 and the reason The Wizard of Oz has not closed. But the higher use of
that fact is not the obituary — it is the interview. The value expires
while somebody can still answer the phone, and the framing decides which
one happens: *who can still tell us about this picture* prompts a call,
*who is about to go* prompts a draft. The first is defensible to the
person themselves, which is the test.

**The honesty clause, which makes the metaphor better rather than
weaker.** The door is held open by more feet than we can see. Below-the-
line crew is in no free database, so the people we can name are the ones
somebody wrote down — Caren Marsh Doll counts only because TMDB records a
stand-in. There are pictures this archive calls closed that still have
someone living who was there: a grip, an extra, a child on set, recorded
nowhere.

Which is the strongest argument for the whole project. The recorded world
is smaller than the real one, and the only way it grows is if somebody
asks while there is still somebody to ask.

---

## The corpus replaces the Vault

*2 August 2026.*

**Decision.** The archive is what the corpus pass produced — 355,717
pictures judged across 136 release years, 122,839 of them closed. The
11,457-entry Vault built by the queue path is superseded rather than
merged.

**Why not merge.** They disagree, and the corpus is right where they do.
Roughly one entry in five of the old Vault carries a wrap date that moves
under the current rules — 45 of 1924's 199 — because dates were computed
from Wikidata's credits alone while the verdict used both databases. The
old Vault also has no country, no genre, no coverage figure, no record of
when it was checked or under which rules. Reconciling two archives with
different answers costs more than rebuilding one, and leaves a reader
unable to tell which they are reading.

**What is lost.** `postedAt` and `postUrl` — which of the 37 published
entries went to Bluesky and where. That is a small, real thing and it
should be carried across rather than dropped.

**What is inherited.** Nothing else. The corpus is derived entirely from
the pass, which is derived entirely from Wikidata and TMDB, and every
record in it says when it was checked and under which thresholds.

---

## The drawers stay

*2 August 2026.*

**Decision.** The Vault keeps decade drawers. A drawer opens onto years,
and a year opens onto pictures.

**Why.** Browsing starts at a decade because that is how anybody thinks
about film. What does not survive the new scale is a drawer that opens
onto a list: the 2010s hold 16,015 closings, about 6 MB. As year shards
the same decade is roughly 600 KB a file, and the busiest year in the
corpus — 2022, with 1,980 closings — is 773 KB.

So the affordance is unchanged and one level deeper, which is a smaller
ask of a reader than a new one to learn. `summary.json` carries
`closingDecades` with per-year counts, so a drawer shows numbers before it
fetches anything.

---

## Cloudflare R2, and the manifest goes last

*2 August 2026.*

**Decision.** The built corpus is served from Cloudflare R2. `dist/` is
never committed.

**Why R2.** Every rebuild mints a new immutable version and old ones
linger, so zero egress fees and cheap storage matter more than they would
for a site. Range requests work, which keeps the SQLite-over-HTTP door
open if arbitrary querying is ever wanted. A custom domain is a
configuration rather than a project.

**Why the order matters.** Everything under `v/<version>/` is immutable,
so a deploy is a copy and never a replacement. `manifest.json` is
overwritten last, and until it points at a version that version is
invisible — which makes a half-finished upload harmless rather than a
broken site, and makes rollback a one-file write.

---

## Everybody gets the same treatment

*2 August 2026.*

**Decision.** No hand-written post for a particular closing. Every picture
gets the sentence the archive builds from its own facts.

**How it came up.** The Wizard of Oz is held open by one living person,
and a prepared send-off was drafted with a ruby-slippers angle: *"it was
her feet that clicked the slippers together."*

**Why it was dropped, and the order matters.** The claim could not be
sourced. It traces to an uncited sentence on Wikipedia, from there to a
tabloid, from there to every birthday piece, and from there to social
posts stating it as fact — while the specialist Oz literature attributes
the physical business to Judy Garland's *double* and declines to say who
is in that shot. She has never been found saying it herself. A project
whose method is *only a recorded fact counts* cannot lead its most
quotable post with a circular citation.

**And then the better reason.** Once the angle was gone, so was the case
for a special post at all. The moment an archive hand-writes one entry it
has favourites, and the reason for this favourite turned out to be an
error. Uniform treatment is also what makes the eventual post credible:
an archive that has been quietly posting closings for a year reads as
doing its job, where the same post as a debut reads as having waited for
somebody to die.

**What survives the decision.** She is alive, she gives interviews, and
the one person who knows whether those are her feet is 107. That is the
*"who can still tell us about this picture"* case in its purest form, and
the answer expires. Asking is worth more than posting.


---

## Two ways in, and the second is a place rather than an order

*2 August 2026. Revised the same evening — see the end.*

**Decision.** The landing page offers ten genres and ten regions, each
opening onto its five best-known closings, **and they stack**.

**Why.** A sort is a way of ordering everything, and the page already had
three. None of them answers the question a reader actually arrives with,
because nobody arrives liking *cinema* — they arrive liking Danish
documentaries, or Russian horror, or Westerns, and the archive had no way
to be told so short of 123,956 closings behind one link.

The doors are sorted by fame for the same reason the *Best known* list
exists: a door that opens onto five titles nobody recognises is a door
nobody opens twice. **Danish** gives *Häxan*, *Ordet*, *Day of Wrath*.
**Western** gives *Stagecoach* and *High Noon*.

**Where the work happens.** Precomputed in `build-corpus.js` and carried
in `summary.json`, which the page already fetches. The facts table can
answer this in the browser — it carries genre and country per row — but
it is 3 MB and carries neither titles nor fame, so the alternative was
fetching the corpus to draw twenty buttons.

**The count arrives with the click.** Twenty labels each trailing a
number is a table. One line naming what is open — AMERICAN COMEDY 4,811 —
is an answer to the question that clicking it just asked.

### The revision: they stack

This was first built one facet at a time, on the argument that crossing
genre with region is the Vault's job and would be a matrix on a page
meant to be five titles and a way through. That was wrong, and the
counter-argument is in the phrases themselves: **"Russian horror" and
"Danish documentaries" are two words each.** Nobody holds one of those
words in their head while they scroll for the other. Asking a reader to
choose between *Danish* and *documentary* is asking them to un-say the
thing they came in saying.

So every combination is precomputed — ten genres, ten regions, and the
117 of 120 crossings that have anything in them. About 55 KB, taking
`summary.json` from 30 KB to 82 KB, and a crossing then costs the same
lookup as a single door.

**What the crossings turn out to be worth** settles the argument better
than the reasoning did. *Canadian comedy* is 27 pictures and opens with
*The Railrodder* and *The Romance of Transportation in Canada*. *Canadian
Western* is exactly one, *Wolf Dog*, released 1958 and closed in 2011.
Neither is reachable in a single-facet archive, and both are the kind of
thing somebody tells another person about.

**Crossings with nothing in them are not written**, which is what lets
the page dim a door rather than let it be clicked into an empty room. The
dead doors stay visible rather than disappearing: a row that reshuffles
on every click stops being a place, and the gaps are themselves
informative — with *Western* chosen, Danish, Indian and Soviet go quiet,
and that is a fact about the corpus.

**Sorts and doors clear each other.** A sort is a statement about the
whole archive and cannot be one about a tenth of it, so choosing one
closes every door; the doors are lists of five that are already chosen,
so while one is open no sort is marked current. The three sorts stay
clickable throughout, because they are also the way out.

---

## The version has to hash the shape, not only the contents

*2 August 2026.*

**Decision.** `FORMAT`, a hand-bumped integer, is folded into the corpus
version digest. Bump it whenever the layout of anything published
changes.

**How it came up.** `doors` was added to `summary.json` and the version
did not move. The digest reads the closings — every id and every wrap
date — and every one of them hashed identically, because none of them had
changed. Only the shape had.

**Why that is a fault and not a convenience.** Everything under
`v/<version>/` is immutable and served with a year's cache lifetime,
which is the whole reason the corpus can be static. A version that does
not move means the URLs do not move, which means a returning reader keeps
last year's copy of `summary.json` and never sees the new field. The
landing page would have been correct on every fresh visit and a year
stale on every returning one, and nothing in the build would have said
so.

**Why hand-bumped rather than derived.** Hashing the publisher's own
source would be automatic and would reissue 101 MB for a corrected
comment. The failure mode of the manual version — forgetting — is the one
this project already lives with on the `?v=` in `index.html`, and it is
visible in the same place: a change that should have moved the version
and didn't.
