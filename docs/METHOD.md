# How a wrap is determined

*The procedural account. This is the editable source for the "Methods and
sources" section on the site; the page renders this text and should not
diverge from it.*

*It describes the procedure by which this project decides that a picture
has wrapped. It is written to be held against the record and found wrong.
Every threshold is named, every source is named, and every step at which a
judgement is made rather than a fact retrieved is marked as such.
Measurements are point-in-time and dated.*

**Last revised 29 July 2026. Figures measured against the archive the same
day, at 11,457 entries.**

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

## 4. Three states, of which only one is an answer

Every person examined is placed in one of three states.

**Dead** requires a recorded death date from one of the two databases, or
a Wikidata assertion of death carrying no date. Nothing else places anyone
here. Death is never inferred from age, from silence, or from the absence
of a record.

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

**The rollup stage is restricted to works typed as films and requires a
recorded publication date.** Television series, miniseries and anything
undated cannot be reached by a backfill at any year. This is a boundary of
the corpus, and it is invisible from the data.

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

A candidate is dropped if Wikidata records **fewer than five cast
credits**. This threshold is editorial, not logical, and should be read as
a choice. Without it, a forty-five day sweep produced 540 pictures of
which 397 had no cast recorded at all — documentaries and concert films
where a single director is the only person on record, "closing" the moment
that one person died. Two properties of the threshold matter: it counts
ordinary cast credits only and not voice credits, so an animated picture
with forty voice performers and no live cast scores zero and is dropped;
and the watcher applies it not at all.

Every entry currently in the archive satisfies the floor.

## 7. The survivor test

At this point Wikidata holds that everyone it knows of is dead. The test
asks whether Wikidata knew the whole cast.

**A TMDB identifier for the picture is required.** Without one there is
nothing to ask, and the procedure reports that it did not run rather than
returning an empty result. **1,077 entries in the current archive have no
such identifier and have been tested against Wikidata alone**; 599 of them
are pre-1930 releases, where TMDB's coverage largely stops.

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
fire for names longer than sixty characters or containing quotation marks,
and it asks for the name as English text even when the name was taken from
a non-English label. Because this pass can only move a person out of
*alive*, its failure costs a closing and never produces a claim.

The test returns three things: the people found alive, a count of the
unknowns, and **whether the test actually ran**. Any person in the alive
list stops the picture. The unknown count is stored with the entry and
stops nothing.

## 8. The classification rule

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
distinction is material.** A queue may also be filed into the archive
without announcement. Of the 11,457 entries currently held, **37 were
announced and 11,408 were filed without individual review.** The
protection that a person reads every item is real for anything published
and does not describe the archive at large.

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
therefore means one of two things, and the record cannot currently tell
you which: it was tested and someone was found alive, or it was never
tested. Only the first is a finding.

As of 29 July 2026 the archive holds **11,457 entries**. The backfill has
been run across **every release year from 1900 to 2026 — 127 years, no
gaps.** Before this month it had covered only 1930–1945, and any analysis
resting on a snapshot earlier than 29 July 2026 inherits that much
narrower shape.

Release years present in the archive run from **1901 to 2012**, and three
entries carry no release year at all:

| Release decade | Entries |
|---|---|
| 1900s | 18 |
| 1910s | 1,160 |
| 1920s | 2,189 |
| 1930s | 2,362 |
| 1940s | 2,330 |
| 1950s | 2,549 |
| 1960s | 700 |
| 1970s | 115 |
| 1980s | 25 |
| 1990s | 4 |
| 2000s | 1 |
| 2010s | 1 |

The steep decline after the mid-1960s now reflects the world rather than
the scan: those years have been asked about, and few of their pictures
have closed. The decline before 1910 is a property of how much of early
cinema was recorded at all.

By *closing* date — the date the last credited person died, which is the
event this archive is actually about — the distribution runs 1940s 10,
1950s 63, 1960s 344, 1970s 870, 1980s 1,557, 1990s 2,080, 2000s 2,190,
2010s 2,558, 2020s 1,785. The earliest closing held is *Lattermaskinen*
(1910), which wrapped on 10 April 1942.

Fifty-seven countries are represented, but coverage is heavily American
and European, and this is a property of the sources rather than of cinema.
For the years 1930 to 1945, Wikidata holds 8,285 American titles and 1,681
French ones against 399 Japanese titles, from an industry then producing
roughly five hundred pictures a year, and 37 Indian titles across the
entire sixteen years.

## 13. What the record does not currently state

Set down because a reader assessing this dataset needs it, and because
none of it is visible from the data.

**Entries do not record when they were verified, or against which
sources.** An entry confirmed this morning under the current procedure is
not distinguishable in the data from one filed under an earlier and less
careful version of it.

**Most of the archive has not been re-checked since it was filed.** Every
entry was verified minutes before filing by the procedure described here,
but a full pass over the whole archive under the current logic has not yet
been completed at the time of writing.

**Removals leave no trace.** Entries reopened by a re-check are deleted.
Two passes removed 278 and 65 entries respectively, and neither left a
record of what was removed, when, or on whose account. A reader who cited
an entry that later reopened has at present no way to discover that.

**1,077 entries have no TMDB identifier** and were therefore tested
against Wikidata alone. A stored flag intended to mark these appears on
only 964 entries, because the flag postdates part of the archive;
filtering on that flag returns a wrong answer, and the absence of an
identifier is the reliable test.

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

Where this record is wrong, it is most likely wrong in one of three ways:
a person who worked on the picture was never entered into any database; a
death occurred and was never recorded; or a person is recorded in both
databases under no shared identifier and no matching name. The procedure
above is designed to reduce the second and third. It does nothing about
the first.
