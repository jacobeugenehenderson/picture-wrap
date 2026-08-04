# How a wrap is determined

*The procedural account, in full. The site's "Methods and sources" page is
the abridged version of this document, written for a reader rather than an
auditor. The two must not contradict each other; where the page is silent,
this is the answer.*

*It describes the procedure by which this project decides that a picture
has wrapped. It is written to be held against the record and found wrong.
Every threshold is named, every source is named, and every step at which a
judgement is made rather than a fact retrieved is marked as such.
Measurements are point-in-time and dated.*

**Last revised 3 August 2026, and re-measured against the archive it now
describes.** Every figure below is taken from the corpus of 97,395
closings published on 3 August 2026, unless it names its own date.

> **Figures on this page predate 4 August 2026.** On that day the rule
> requiring a day-precise birth date before anyone could be called living
> was withdrawn — it demanded precision to hold a picture open and none to
> let one close. 10,031 pictures moved into *running*: the corpus is now
> **94,446 closings and 16,069 unclassified**, from 97,395 and 23,161.
> Every proportion below was measured against the larger figure and has
> not been re-derived. `docs/VERIFICATION.md` carries the account.

Until 3 August this document measured the 11,457-entry Vault that the
corpus superseded on 2 August. That is worth recording rather than
quietly correcting: for one day the citable account described an archive
an order of magnitude smaller than the live one, and a reader checking the
site against this document would have found neither wrong nor able to be
reconciled. Where a superseded figure is instructive it is kept and marked
as superseded; where it is merely stale it is gone.

---

## 1. The claim, and why it is asymmetric

A picture has wrapped when every person recorded as having worked on it is
dead. That is the entire claim, and it is a claim about living people, so
the two ways of being wrong do not cost the same. To say a picture is
still running when it has in fact closed is to miss something. To say it
has closed when someone is alive is to publish that a living person is
dead.

Every rule below is arranged around that asymmetry. Where a rule could be
set either way, it is set in the direction that keeps a picture open.

## 2. Sources, and how they are joined

Two databases are used, and they are not used for the same thing.

**Wikidata** is authoritative here for credits and for death. It is
CC0-licensed, requires no key, imposes no caching limit, and its death
dates are well maintained because they feed Wikipedia's infoboxes. Every
verdict rests on it.

**The Movie Database (TMDB)** is asked one question that matters: *did
Wikidata know the whole cast?* Its cast and crew lists are substantially
fuller than Wikidata's. It is also asked, secondarily, for characters
played and for its own birth and death dates.

The two are joined on identifiers that Wikidata itself stores — TMDB's
film id, series id and person id are all recorded as Wikidata properties.
**No step of this process matches people by name across the two
databases.** The single exception is a late, deliberately guarded pass
described in §7, which matches on name *and* exact birth year together and
refuses to act when more than one person clears both.

Neither database is complete, and they are incomplete in different places.
That is the reason both are consulted rather than one.

## 3. What "everyone" means

A maker is anyone recorded on the picture under one of ten credit
relations: cast, voice cast, direction, screenplay, cinematography, music,
production, editing, production design and costume design. Voice cast is
counted separately from cast because animation records its performers
there and would otherwise appear to have no cast at all.

**Below-the-line crew — grips, gaffers, sound, second unit — is absent
from every free database and is therefore absent here.** No procedure in
this document addresses that gap, and none can. A picture may be shown as
wrapped while someone who worked on it, and was never entered into any
database, is alive. This is the central limitation of the record and it is
not reducible by better method.

"Everyone" throughout this document means *everyone recorded*.

### How many names a closing actually rests on

The phrase does most of its work at the thin end of the corpus, and the
distribution is not a footnote to the claim — it is a description of what
the claim means.

| names on the record | share of closings |
|---|---|
| one | 34.0% |
| two | 15.5% |
| three or four | 18.2% |
| five to nine | 17.2% |
| ten to nineteen | 11.2% |
| twenty or more | 3.9% |

**Half of all closings rest on one or two recorded people.** For those, a
wrap marks the end of a filing entry rather than the end of a living
connection to the picture: a 1911 one-reeler whose only recorded name is
its producer closes the day that producer dies, while the dozens of
uncredited people who made it are outside the record entirely and some of
them certainly outlived him.

The share is U-shaped by release decade rather than simply declining, and
the shape follows how fully credits were recorded rather than anything
about cinema:

| release decade | closings resting on one or two names |
|---|---|
| 1890s | 93% |
| 1900s | 81% |
| 1910s | 57% |
| 1920s | 43% |
| 1930s | 31% |
| 1940s | 31% |
| 1950s | 37% |
| 1960s | 60% |
| 1970s | 73% |
| 1980s | 81% |

The middle of the century is the only stretch where a wrap approximates
the thing it sounds like. Before it, studio-era credit lists had not been
transcribed; after it, Wikidata's coverage of recent pictures thins again.
Any statement about the archive as a whole is a statement about a
population whose meaning changes across it.

### Two ways to be the last of a picture's makers

They are structurally different and neither has anything to do with
prominence.

**One name standing for a production.** The people who close the most
pictures are producers and directors credited on hundreds of shorts where
they are the only recorded name: William Nicholas Selig closed 859
pictures, Siegmund Lubin 522, Lewin Fitzhamon 417, Georges Méliès 381. The
median number of credits on the pictures they closed is one or two. They
did not outlive their collaborators; they *were* the record.

**The youngest person on a crowded set.** Where a credit list is long, the
last survivor is usually whoever was a child on it — Dickie Moore, Cora
Sue Collins, Robert Blake and Phyllis Coates all appear as closers of
1930s and 1950s pictures. Of everyone who closed five or more pictures,
roughly 110 were sixteen or younger when the picture was released; that is
a small number of people closing a large number of well-documented
pictures.

This distinction explains results that otherwise look like findings about
film. Documentaries close earlier and faster than any other genre in every
release cohort measured, which is not a property of documentaries: they
credit a handful of adults where a musical credits dozens of performers
including children.

### The unit of analysis is the death, not the picture

A consequence of the above, and it bears on any statistic computed from
this archive. Pictures do not close independently of one another. One
death can close hundreds, so counting pictures counts consequences of an
event rather than events.

| release decade | closings | distinct deaths | closings per death |
|---|---|---|---|
| 1900s | 3,027 | 364 | 8.3 |
| 1910s | 23,947 | 3,458 | 6.9 |
| 1920s | 12,909 | 3,931 | 3.3 |
| 1930s | 13,814 | 4,647 | 3.0 |
| 1950s | 11,062 | 5,039 | 2.2 |
| 1960s | 8,291 | 4,374 | 1.9 |

Selig's single death accounts for 812 of the 1910s closings; Méliès's for
280 of the 1900s, or 9% of that decade. **Any measure of confidence over
early-cinema figures should be computed on distinct deaths, and a
per-picture count overstates it by up to sevenfold.** By the 1950s the
inflation is roughly double, which is material but not disqualifying.

## 4. Three states, of which only one is an answer

Every person examined is placed in one of three states.

**Dead** requires a recorded death date from one of the two databases, a
Wikidata assertion of death carrying no date, or an age past the longest
documented human lifespan (§8). Silence never places anyone here, and
neither does a lookup that failed. The age rule is arithmetic rather than
inference, and it is the only route into this state that does not rest on
somebody having recorded something.

**Alive** requires a birth date the procedure will credit (§8) and no
recorded death anywhere. This is the state that stops a picture closing.

**Unknown** means there is no usable evidence either way. It is not a weak
form of dead. It is counted, stored and published alongside each entry,
and it never blocks anything.

The consequence must be stated plainly: **unknowns do not protect a
picture.** A picture can be declared wrapped over people the procedure
could not answer for. This is the largest judgement in the project. It is
defensible on grounds of era — for a picture released in 1935, a person
with no recorded dates is very probably dead — but nothing in the
procedure tests era, and the same rule applied to a 2005 release would be
reckless.

Across the current archive there are **42,863** such people. The median
entry carries two of them; 3,195 entries carry none.

## 5. How a picture comes up for consideration

Four routes. Three can bring a picture forward for testing; the fourth
governs only what a visitor is shown.

**The sweep** is the ordinary route. Wikidata is asked for everyone whose
death was recorded in a recent window and who holds a screen credit. For
each such person the question is then asked from the film's side: which of
their pictures now have no credited person lacking a death date?

Two features of that question are consequential. First, the test is over
the *objects* of credit relations, and an object need not be a person — so
a picture crediting a production company as producer can never pass,
because a company has no death date. Second, the query requires at least
one credited person who *does* have a death date, so a picture with no
recorded credits at all never comes back.

**The backfill** handles pictures that closed before this project existed,
where there is no forthcoming death to react to. Asking the full question
across a whole release year exceeds the query service's time limit, so it
runs in two stages: a cheap per-year rollup that counts recorded cast
against recorded dead cast and keeps only the pictures where those match,
followed by the exact, crew-inclusive test on each survivor of that filter.

**The rollup stage requires a recorded publication date**, so anything
undated cannot be reached by a backfill at any year. This is a boundary of
the corpus and it is invisible from the data.

It was until recently a much larger boundary. The rollup asked only for
works typed as *film*, and Wikidata does not file early cinema that way:
1912 holds 2,326 short films against 597 films, so four fifths of that
year was never examined — not judged wrongly, never seen. Twelve classes
are now asked for, covering short, silent, animated and anime film, serial
film, television film and play, miniseries and television series. Music,
publications and video games are excluded, since a composer credit on an
album is a credit and an album has no cast to outlive. Television series
*episodes* are excluded as a matter of scale rather than principle: the
unit here is the work, and 2015 alone holds 1,911 episodes.

**The watcher** monitors news accounts for reported deaths, resolves the
named person, and asks whether that person closes anything. It runs ahead
of Wikidata's own recording, which is possible because the wrap test does
not need the newly reported death date — everyone else on the picture is
already recorded. Its output is marked provisional. It applies neither
screening filter described in §6, and it exempts the reported person from
testing, which means every picture it drafts carries one person nobody has
checked.

**The website** runs the survivor test live, in the visitor's browser, on
any film page that would otherwise be drawn as wrapped. It is the only
consumer of the test that refuses to make the claim when the test does not
complete.

## 6. Screening

On the sweep and the backfill, two filters are applied before testing.

A candidate is dropped if the picture has **no name in any of the
sixty-two languages requested**, since there is nothing to publish and
nothing to call it.

A candidate reaching **the announcement queue** is dropped if Wikidata
records fewer than five cast credits. This threshold is editorial, not
logical. Without it a forty-five day sweep produced 540 pictures of which
397 had no cast recorded at all — documentaries and concert films where a
single director is the only person on record, "closing" the moment that
one person died. An unreadable queue defeats the only protection this
project has, which is that a person reads every item before it is
announced.

**It no longer governs what is examined or what is recorded.** It had been
applied at three points, two of which lead to filing rather than
announcement, so a rule about what is worth posting was deciding what the
archive contains — and it was excluding pictures whose record is complete
at a rate of 500 to 780 a year: 585 in 1913, 775 in 1924, 768 in 1960.
It also counted ordinary cast credits only, so a picture with four cast
and twelve crew read as "four on record", and an animated picture with
forty voice performers and no live cast scored zero.

A floor is in any case a poor proxy for thinness. Of forty archive entries
sampled, all of which cleared it, a third rest on under half of TMDB's
credit list — *Rhubarb* (1951) is 30 credits of 113. The floor keeps the
pictures whose thinness is invisible and drops the ones that announce it.
Thinness is now carried per entry instead, as a maker count, a TMDB credit
count and the ratio between them.

Every entry in the published archive predates this change and satisfies
the old floor.

## 7. The survivor test

At this point Wikidata holds that everyone it knows of is dead. The test
asks whether Wikidata knew the whole cast.

**A TMDB identifier for the picture is required.** Without one there is
nothing to ask, and the procedure reports that it did not run rather than
returning an empty result. **38,637 closings — 46% — have been tested
against Wikidata alone for want of one**, concentrated in early and
non-English cinema where TMDB's coverage largely stops. They are marked
as such wherever they appear; see §12.

An identifier is not a guarantee that the test ran. TMDB answers for some
pictures with an empty cast and crew, and an empty credit list is not a
finding of nobody: the procedure reports that it did not run, and the
verdict is left as it was rather than being strengthened by silence.

Given an identifier, TMDB's full credits are retrieved — cast and crew
both, and for series the aggregate credits across all seasons rather than
the billed regulars only. Everyone TMDB names who is *already linked from
the picture's own Wikidata item* is then set aside, because Wikidata's own
test has already covered those people. That justification holds for the
sweep and the backfill. It does not hold for the watcher, for the reason
given in §5.

Each remaining person is then put to three questions, in order.

**First, does Wikidata know this person by their TMDB identifier?** If so,
their birth date, the recorded precision of that birth date, and their
death date if any are taken. If two or more Wikidata items claim the same
TMDB identifier, all of them are discarded and the person is treated as
unknown to Wikidata. Two items claiming one identifier is a contradiction,
not a source; choosing between them would mean choosing whichever the
query service happened to return first, which is not stable between runs.

**Second, what does TMDB itself hold?** This is asked for everyone
Wikidata has *not buried* — a wider group than those Wikidata has never
heard of. A Wikidata item carrying no death date is not a living person;
it is a person whose death nobody has recorded there, and TMDB may hold
that death date. Omitting this step allowed a man who died in 1992 to veto
a picture for months.

The classification rule (§8) is then applied to both records together.

**Third, Wikidata is asked again, by name.** Some people Wikidata knows
perfectly well are not linked to their TMDB identifier and were missed by
the first question. A person is sought with exactly that name, typed as
human, whose birth year matches exactly. If exactly one such person exists
and carries a death date, they are recorded as dead. If several match,
that is ambiguity, and nothing is changed. This pass runs for anyone not
already dead, including people currently reading as unknown. It does not
fire for names longer than sixty characters, or containing quotation
marks, backslashes or control characters — TMDB's names are typed by
members of the public, and a malformed one does not merely fail, it makes
the whole batch of sixty fail — and it asks for the name as English text
even when the name was taken from a non-English label. Because this pass can only move a person out of
*alive*, its failure costs a closing and never produces a claim.

The test returns three things: the people found alive, a count of the
unknowns, and **whether the test actually ran**. Any person in the alive
list stops the picture. The unknown count is stored with the entry and
stops nothing.

## 8. The classification rule

*Every rule in force is enumerated in `VERIFICATION.md` under **The
canon**, with the file it lives in and whether the audit checks it. This
section explains the reasoning; that table is the list.*

Applied to the two records held apart rather than merged, because whether
two sources independently agree is itself evidence.

- A death date from either database, or a Wikidata assertion of death
  without a date → **dead**.
- No birth date from either → **unknown**.
- No birth date of day precision, and the two databases do not agree on
  the year → **unknown**.
- A birth date placing the person past the oldest age credited →
  **unknown**.
- Otherwise → **alive**.

Two thresholds in that rule are chosen numbers and should be read as such.

**What counts as a birth date.** Wikidata records a precision with every
date, and a date known only to the year is stored as the first of January
because it must be stored as something; the precision is read rather than
guessed. TMDB publishes no precision at all, so there a birthday falling
on the first of January is the only available signal, and it is an
inference about the source rather than a fact from it. A birth date is
therefore credited if it is precise to the day, **or** if both databases
supply one and they agree on the year. A single imprecise, uncorroborated
date is a year somebody typed into a field.

**The oldest age credited is 112.** This is not a claim that nobody has
lived longer; Jeanne Calment reached 122. It is the age past which a birth
date and no death record ceases to be evidence in either direction. It
moves people from *alive* to *unknown* and is not permitted to move anyone
to *dead*. Being wrong with it costs a picture its closing, which is the
cheap error. Where the two databases disagree on birth year, the age test
uses the **later** year — the youngest reading, the one most likely to
keep a person alive.

**The oldest age admitted is 122.** Jeanne Calment lived 122 years and 164
days, which is the longest life anyone has documented, so past it the
answer stops being *unknown* and becomes *dead*. The two thresholds are
different in kind: 112 is chosen and 122 is the record, and the error each
one risks runs in the opposite direction, which is why they sit apart.

A missing birth date does not put a person out of reach of this. Nobody
worked on a picture before they were born, so the release year is an upper
bound on the birth year, and a person credited on a picture older than the
longest life on record cannot be living whatever else is unrecorded.

The inference produces a death and never a date. A picture can close on it
— which is the whole point, since before it a maker born in 1850 with no
recorded death held one open in perpetuity — but a closing date is always
somebody's recorded death, and the people this rule speaks for are shown
without dates and counted in `unknownCount`.

**Two further rules are arithmetic and not judgement, and neither carries
a chosen number.**

*Nobody worked on a picture released before they were born.* A credit
whose birth year is later than the release year is set aside: it votes on
nothing and dates nothing. This catches name collisions, which the two
databases produce and we inherit — *Under Western Skies* (1910) was dated
3 June 2024 by William Russell, born 1924, while the William Russell born
1884 sits two credits below him in the same cast list. Every one of the
longest release-to-wrap gaps in the corpus was this. The rule had applied
since 2026 to the people TMDB names and never to Wikidata's own credits,
which is to say to half the people it should have.

*A picture cannot have closed before it was released.* A death earlier
than the release date cannot date the wrap. Source authors and composers
of pre-existing music are genuinely credited and are correctly counted as
dead — Edgar Allan Poe is credited on *The Murders in the Rue Morgue*
(1914) — and none of them can be the last of a picture's makers. So are
people appearing only as archival footage, which is how Frederik VIII of
Denmark came to date a 1937 film.

People set aside by either rule remain in the record, flagged. The
evidence should show that somebody was seen and set aside, not silently
lose them.

**Dating the wrap.** The last death decides, at whatever precision it was
recorded. The tempting alternative — take the last death recorded *to the
day*, which always yields a printable date — is wrong in a way that
matters: *Los misterios del turf argentino* would read "Julio Irigoyen was
the last of its makers, 29 August 1967" while Aparicio Podestá, also
credited, died in 1979. Twelve years and the wrong name, bought with a
prettier date. It affected 56 of 1,188 pictures in a single year.

A closing therefore carries one of three dating states:

- **day** — the last death is recorded to the day. Only this may print as
  a date, and only this may name a person as the last of the makers.
- **year** — the last death is real but recorded only to the year. The
  picture closed that year, on a day nobody wrote down.
- **none** — no death is recorded anywhere. The picture is closed by the
  age rules above and has no place on a timeline.

Precision is read from the source and never inferred from the shape of the
date. Wikidata publishes a precision for the death separately from the
birth, and reading one for the other put a wrap on 2000-01-01. TMDB
publishes no precision at all, so there a death falling on the first of
January is treated as a year. Both databases' dates pass through the same
validation: TMDB's did not until 1 August 2026, and `"7-9-1980"` reached a
wrap date intact.

## 9. When the test cannot run

An empty list of survivors from a test that never ran is not a finding of
nobody, and the two are distinguished throughout. The test reports that it
did not run when there is no TMDB identifier for the picture, when the
credits retrieval fails, when TMDB holds no credits for the picture, or
when any query errors. It also reports that it did not run if no TMDB
credential is present.

Consumers split the two cases:

- **No identifier exists.** Nothing can be asked, and that will be equally
  true tomorrow. The picture proceeds on Wikidata's answer alone and is
  marked as having had no second opinion. Refusing these outright would
  quietly excise the obscure, the silent-era and the non-English end of
  cinema, which is a large part of what closes.
- **The lookup failed.** A question was asked and nothing came back. The
  sweep and the backfill defer the picture and do not record it as
  considered, so it returns on a later run. The watcher declines to draft.
  The re-check marks the entry unchecked rather than confirmed. The
  website declines to draw the picture as wrapped.

## 10. Approval, and what publication does and does not certify

A picture that passes enters a queue. Nothing about being in the queue is
public.

Entries approved for announcement are read individually by a person, with
each picture's Wikidata item linked so the evidence can be opened. That
approval is the only thing that publishes.

**This describes the announcement path and not the bulk one, and the
distinction is material — more so now than when it was written.** Of the
**97,395 closings held, 37 were announced on Bluesky after a person read
them.** Every other one was decided by the procedure in this document and
published without individual review. The protection that a human reads
each item is real for anything posted and describes essentially none of
the archive.

**Filing does not re-test.** Whatever the finder concluded at the moment
of discovery is what enters the archive. If the procedure changed in the
interval, the archive inherits the older judgement. This has produced
errors before, and it is the reason the ordering in §11 matters.

## 11. Re-checking, and drift

Pictures can un-wrap. Someone adds a living cast member to Wikidata and an
entry that was true when filed stops being true.

The re-check walks the archive and asks two questions of each entry.
First, of Wikidata directly: does this picture now have any credited
person with no death date? If that query fails the entry is marked
unchecked and left alone — a failed query is not a verdict. If it returns
anyone, the picture reopens. Second, the full survivor test of §7. If that
test could not run, the entry is marked unchecked; it remains in the
archive but is not counted as verified, because nothing verified it.

Anything that reopens is removed from the archive and cleared from the
record of pictures already considered, so a later sweep can find it again.
Removal is recorded in `pass/removed.jsonl`; see §13.

Two limits of this loop should be understood. Re-checking detects
**Wikidata** drift. There is no equivalent change feed for TMDB, so a
person added to a picture there, or a death date corrected there, surfaces
only in a full pass over everything. And a full pass is warranted by *this
procedure changing*, not by the calendar: two successive passes over 3,640
entries after the last logic change found zero further removals, while the
pass that accompanied the change removed 65.

## 12. What has actually been asked

Everything above concerns how the question is answered. It says nothing
about which pictures have been asked, and those are separate facts.

**The archive is not "every picture that has wrapped". It is every picture
the project has got around to asking about.** A picture's absence
therefore means one of three things: it was tested and someone was found
alive, it was tested and the test could not run, or it was never asked.
Only the first is a finding.

As of 3 August 2026 the pass has judged **every release year from 1890 to
2026 — 137 years, no gaps — and 329,957 pictures**, of which **97,395
have closed**, 23,161 are unclassified, 208,028 are still running, and
1,373 could not be checked because TMDB did not answer.

Each of those is a count of pictures, not of records. A picture with
release dates in two years was judged under both until 3 August, and was
counted twice for as long as that was true; 3,253 such duplicates were
removed that day, which is why a figure of 123,956 appears in documents
written before it.

### By release decade

| Release decade | Closings |
|---|---|
| 1890s | 589 |
| 1900s | 3,223 |
| 1910s | 24,457 |
| 1920s | 12,936 |
| 1930s | 14,245 |
| 1940s | 11,800 |
| 1950s | 11,408 |
| 1960s | 9,108 |
| 1970s | 7,644 |
| 1980s | 5,333 |
| 1990s | 3,566 |
| 2000s | 4,684 |
| 2010s | 9,081 |
| 2020s | 2,493 |

The 1910s are the largest decade and this is a fact about mortality rather
than about cinema: a picture from 1915 has had a century in which every
person on it could die, and the credit lists of the period are short.
The rise again after 2000 is the opposite effect and a caution — those are
overwhelmingly pictures with one or two recorded names, closed by a single
death, not the wrapping of major features.

### By closing date

The date the last credited person died, which is the event this archive is
actually about: 1900s 5, 1910s 280, 1920s 1,770, 1930s 2,852, 1940s 4,628,
1950s 4,777, 1960s 7,510, 1970s 9,185, 1980s 11,047, 1990s 12,085, 2000s
14,276, 2010s 15,859, 2020s 11,595.

The earliest closing held is *William McKinley Inauguration Footage*
(1897), which wrapped on 14 September 1901. The most recent at the time of
writing is *The Sundial* (1997), on 30 July 2026.

This distribution rises steadily and that shape is the archive working
correctly: more pictures have had time to close, and the databases record
recent deaths better than old ones. **It is not evidence that more
pictures are closing than used to.** Any reading of the recent end as a
trend is reading the sources.

### By country

**279 country labels are represented**, and coverage is heavily American
and European. This is a property of the sources rather than of cinema.
The largest are American 44,170, German 8,624, French 8,130, British
7,655, Danish 5,482, Australian 4,309, Indian 4,209 and Italian 3,654.

For pictures released between 1930 and 1945 the corpus holds 21,549
closings: 9,520 American, 1,845 British, 1,688 French, 1,586 German and
**284 Japanese**, from an industry then producing roughly five hundred
pictures a year.

**A figure this section once gave for India was wrong, and the mechanism
is worth keeping.** It said 37 titles across those sixteen years, which
was a count of pictures labelled *India* — and Wikidata labels a picture
with the state that existed when it was released, so almost every South
Asian picture of the period is filed under *British Raj*. The true figure
is **901: 869 under British Raj and 32 under India.** British Raj is the
fifth largest country label of the period, ahead of Italy.

The imbalance the sentence was describing is real and roughly ten to one.
The number it gave was out by a factor of twenty-four, and the mechanism
was the archive's own: asking a question in present-day terms of a record
kept in period terms. §8 of `FINDINGS.md` states the general form.

### The third state

**23,161 pictures are neither closed nor running.** No death is recorded
for anyone credited on them, nobody credited is recorded living, and they
are not old enough for arithmetic to settle it. They are **unclassified**,
and until 3 August 2026 they were in the Vault.

They were there because of the rule that unrecorded people never veto —
correct when a picture has thirty recorded deaths and two blanks, and
productive of a claim from nothing when every single person is a blank.
Median release year 2007, median one name on record. *Aanikoobijigan*
(2026) was published as wrapped with Zack Khalil, born 1991, credited on
it.

**A closing now requires a recorded death**, or a release year old enough
that §8 settles it regardless. Only two pictures reach the Vault by that
second route, so in practice every closing rests on a death.

The word differs from the one used for a person on purpose. A person with
no dates is *unrecorded*, which is a fact about them; a picture is
*unclassified*, which is a fact about this project. The picture is
recorded perfectly well. What is missing is our ability to say anything.

The site browses them by release year, which is the only date they have.
Nothing on that surface can carry a wrap date: the published rows omit
those fields entirely rather than setting them empty.

### How much of this rests on one database

**38,637 closings — 46% — were never checked against TMDB**, almost
always because the picture carries no TMDB identifier and there is
therefore nothing to ask. These are the archive's weakest claims, they are
marked *Wikidata alone* on the site, and the reason they are published
rather than withheld is that the pictures without an identifier are
overwhelmingly the obscure and the non-English, which is most of what
closes.

The remaining 58,758 were tested against both databases.

Of the 96,396 closings that name a closer, the date came from Wikidata for
69,564, from both databases agreeing for 19,111, and from **TMDB alone for
7,721 — 8.0%**. The middle figure is the work of `provenance.js`, which
asks Wikidata whether it already holds a death first recorded from TMDB;
it corroborates and never overwrites.

## 13. What the record does not currently state

Set down because a reader assessing this dataset needs it, and because
none of it is visible from the data.

**A published closing does not record when it was verified.** It records
*whether* it was checked against both databases — that is the *Wikidata
alone* mark, added 3 August — but not the date of the check, so a closing
confirmed under the current procedure is not distinguishable in the
published data from one decided under an earlier version of it. The
underlying records (§15) carry `checkedAt` and the code revision that
decided them; the published shards do not, and should.

**Re-checking is not continuous.** Every closing was verified at the
moment it was judged, and the whole corpus has been re-decided offline
from its own evidence since — but a picture only re-contacts the databases
when something asks it to. A living person added to Wikidata today will
not reopen a closed picture until the next pass over that year. Film pages
are computed live and will show it immediately; the Vault will not. That
disagreement is visible on the site and is the honest state of it.

**Removals are recorded on disk and are not published as a surface.**
A picture that reopens is absent from the next corpus. Since 3 August 2026
`pass/removed.jsonl` records every departure — what was published, when it
entered, when it left and who was found living — and the corpus carries
the subset that were wrong as `removed.json`.

The site does not show any of it. A banner on a picture saying the archive
previously claimed otherwise, or a page listing every such picture, answers
a question about this project rather than about film; the picture's own
page already shows the living person and the bar in the right place. The
record exists so a departure can be reconstructed, not so it can be
displayed.

The record opens with **138 wrong closings**, all dated 3 August 2026.
127 are pictures the survivor test had never actually run on — among them
*Gidget* (1959), published as closed while Jo Morrow, who played Mary Lou,
was alive and credited on TMDB. The other 11 were closed under one release
year while another release year's judgement named somebody living, which
is a rule this archive believed it already had and did not.

A further **23,161 departures** are in the same file and are a different
statement: those closings were not wrong so much as never grounded, and
they left because a closing now requires a recorded death. They are the
unclassified — see §12.

**The limits of that record should be read with it.** It begins on
3 August 2026; nothing before that date was kept and nothing can
reconstruct it, so the archive cannot say what it withdrew in July. Every
one of the opening entries carries no entry date, because those pictures
were published across many builds before any roll of what-is-published
existed, and a guess at when a claim began would be worse than a blank.

**Superseded, 3 August 2026.** This section previously reported that
1,077 entries had no TMDB identifier and that a stored flag marking them
was unreliable because it postdated part of the archive. Both facts
belonged to the 11,457-entry Vault. In the corpus the flag is no longer
stored at all: it is derived at build time from whether the survivor test
ran, published on every closing, and drawn on the site. The quantity is
**38,637 closings, 46%** — see §12.

**Upstream sourcing is uneven, and is not currently published.** Wikidata
death dates carry their own references. Across a sample of 40 pictures
taken on 29 July 2026, 443 of 545 deaths — 81% — carried a substantive
source, meaning a named work or a direct reference URL rather than an
import from another Wikipedia. Those sources are predominantly national
libraries and archival authority files: the Bibliothèque nationale, the
German Integrated Authority File, SNAC, the Internet Broadway Database,
filmportal.de, alongside user-contributed material such as Find a Grave.
The least-sourced entries in the sample were the non-English titles, which
is where every other measurement in this project also lands. **A reference
is not a verification**, and this figure measures whether somebody cited
something, not whether it is true.

## 14. How to check us

Every judgement in this record rests on two public databases, and both can
be queried by anyone without our involvement. For any entry, the picture's
Wikidata item lists the credits the verdict was computed over, and each
person's item carries their dates and the references behind them. TMDB's
credits for the same picture will show whether its cast list is fuller
than Wikidata's — that discrepancy is precisely what §7 exists to measure,
and it is the most productive place to look for an error in what we
publish.

For any claim in the published archive, the working behind it can be
supplied on request (§15): every person judged, the dates used, their
precision and their source. That is a slower route than opening a Wikidata
item and it exists for the cases where the disagreement is about our
procedure rather than about the data.

Where this record is wrong, it is most likely wrong in one of three ways:
a person who worked on the picture was never entered into any database; a
death occurred and was never recorded; or a person is recorded in both
databases under no shared identifier and no matching name. The procedure
above is designed to reduce the second and third. It does nothing about
the first.

One further caveat belongs here rather than in a footnote, because it
affects what a reader is looking at rather than what the archive holds.
**A person's page is not read out of the archive.** A filmography can
reach release years the pass has not run, and the archive is a dated
snapshot while Wikidata is live, so that page queries Wikidata directly
and applies §8's rules in the browser at the moment of reading. It shows
a picture as still running unless both the archive and the live query
agree it has closed — the cautious direction, and the one that means a
person's page can lag behind a picture's page rather than ahead of it.
The judgement on a picture's own page, and every count published here, is
the archive's.

## 15. The full corpus pass, and what is kept

Everything above describes how a verdict is reached. This section
describes an artefact that did not exist before 1 August 2026: a record of
*how each verdict was reached*, kept so that a conclusion can be checked
and so that a change of rule is a re-decision rather than a re-fetch.

Every pass this project had run kept the verdict and discarded the working.
The consequence was that any question about the archive — is that date
right, what would a different threshold do, how complete is that credit
list — cost a further multi-hour pass over the network, every time it was
asked.

The pass now walks one release year at a time and writes four things:

- **the verdicts**, one record per picture, each carrying its coverage, its
  unknowns *by name* rather than as a count, the time it was checked, and
  the thresholds and code revision that decided it;
- **the evidence**, every maker judged on every picture, with the dates
  used, the precision of each, which database each came from, and the
  verdict reached for that person;
- **a person table**, one row per human, merged across years;
- **a failure ledger**, so that a lookup which did not answer is recorded
  as such and can be retried rather than being silently absent.

**The guarantee has a boundary, and it was overstated.** Re-deciding from
stored evidence is sound only for pictures the survivor test actually ran
on. The pass short-circuits — the moment Wikidata shows a living person it
returns *open* without asking TMDB, which is what makes a corpus of this
size affordable — and for those pictures the stored evidence is a partial
population by construction.

So a rule that makes *alive* stricter does not turn them closed. It turns
them **untested**. On 2 August the born-after-release rule reached
Wikidata's own credits and left 965 pictures in that state, held open by
people who could not have worked on them; `rebuild.js` could not repair
them and `retest.js` exists for exactly this.

The record now names who a short-circuit rested on, in `heldOpenBy`, so
the next time a rule tightens the affected set is a query rather than an
inference. The audit reports this class separately from a genuine failure
to reproduce, because calling both a failure is how a real one gets lost.

**The test of whether that is sufficient is mechanical, not editorial.**
Every year is re-decided from its own files with the network unplugged;
every verdict and every date must reproduce. The same files are then
re-decided under a different age threshold, which must require no network
at all. And every wrap date must belong to a named person in the evidence
whose death is recorded to the day. A year that fails any of these has
kept too little.

As of 3 August 2026 the pass has judged **137 release years, 1890 to 2026,
with no gaps: 329,957 pictures**, of which 97,395 are closed, 208,028
still running and 1,373 could not be checked. Of the closings, **91,178
are dated to the day** (93.6%), 488 to a month, 4,197 to a year only, and
**1,532 carry no recorded death at all** (1.6%) — those are closed by
the arithmetic of §8 rather than by a date, and the record says so rather
than inventing one.

Release years 1890 to 1913 are complete and will not be revisited: nobody
credited on a picture from those years can be living, so §8 settles them
permanently.

**What a closing actually rests on.** The median closing rests on **two
recorded names**, and 30,265 of them — 31% — rest on exactly one. This is
the single most important caveat in this document and §3 states it in
full: a picture whose credit list holds one name closes when that person
dies, and the sixty people who actually made it were never in any free
database. Fourteen thousand closings rest on ten names or more.

**Coverage against TMDB is measurable on 59,634 closings**, being those
where the test ran and TMDB returned a credit list. The median is **0.33**
— Wikidata holds a third of the names TMDB does — and 66% of them rest on
under half of TMDB's list. Coverage is stated per closing so that a reader
can weigh one without taking the average on trust.

**The closer was in front of the camera** on 30,490 closings and behind it
on 39,732. On 26,178 neither database said, and those were judged before
the field existed rather than being genuinely unknown.

**None of this is published.** It is a working artefact of roughly two
gigabytes, a substantial part of it TMDB-derived, and the right to
redistribute that at scale has not been established. Access can be
arranged on request for research, preservation or journalism. The
per-picture basis for every claim remains on the picture's own page, and
this document is the procedure in full.

## 16. Naming, and withholding

Every person here is named from a public database. A living person who
does not wish to be named can ask, and the name is withheld from the page,
from the evidence and from the person table.

**Withholding takes the name and never the vote.** Removing a living
person from the reckoning would close a picture that has not closed, which
is simultaneously a false claim about the film and an erasure of that
person's work. The credit continues to count; the row states only that
somebody is there.

This is expected to be used approximately never, and the reasoning is
worth stating rather than assuming. Every date here is already published
by Wikidata and by IMDb, and screen credits are a matter of public record.
What originates here is not the data but the inference: no source states
that a particular person is the last living link to a particular picture.
That sentence is assembled by this procedure, and it is the only thing in
the record a person could reasonably object to.