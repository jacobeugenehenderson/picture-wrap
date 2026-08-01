# What the corpus says, and what it only appears to say

Measured facts about the archive, each one paired with the thing that will
make it wrong if it is plotted carelessly. Written as raw material for
graphics rather than as an argument.

Every figure here is from the corpus pass, measured 1 August 2026 with
roughly a hundred release years judged and the pass still running. Figures
will move; the shapes should not.

**Read the rules in §0 before using anything below.** Four of the five
findings in this document were wrong the first time they were computed,
and all four were wrong in the same way.

---

## 0. Five rules for any graphic built from this data

1. **Hold the release cohort fixed.** Anything plotted against closing
   date alone reproduces the release-date distribution and presents it as
   a discovery. Westerns "rise" from 0.4% of closings in the 1910s to 6.1%
   in the 2020s purely because of when westerns were made.

2. **Count deaths, not pictures.** One death closes up to 812 pictures.
   Pictures are consequences of an event, not events, and a per-picture
   count overstates the evidence behind it by up to sevenfold in early
   cinema and roughly double by the 1950s. `corpus.js` offers no bare
   total for this reason.

3. **Carry the coverage denominator.** Nearly every apparent trend in this
   archive is the number of recorded credits changing over time (§1). A
   chart that does not show it will rediscover that artefact in a new
   costume.

4. **Say that the denominator is closings.** The facts table holds closed
   pictures only. Roughly 60,000 still-open pictures are absent, so every
   share computed from it is a share of what has closed, which is a
   different question from a share of cinema.

5. **Labels are period-accurate, not continuous.** A picture carries the
   state that existed when it was released. Country series break at 1947,
   1991 and 1992 by design, and those breaks are not events in film
   history.

---

## 1. Who counted — the denominator behind everything

Share of pictures whose Wikidata record carries each craft, by release
decade.

| decade | median makers | cast | director | writer | camera | music | editor | costume |
|---|---|---|---|---|---|---|---|---|
| 1890s | 1 | 19% | 96% | 7% | 20% | 1% | 1% | 0% |
| 1900s | 1 | 30% | 92% | 14% | 20% | 1% | 0% | 0% |
| 1910s | 2 | 54% | 92% | 26% | 13% | 1% | 1% | 0% |
| 1920s | 3 | 62% | 98% | 42% | 34% | 8% | 7% | 0% |
| 1930s | 5 | 67% | 98% | 50% | 44% | 42% | 21% | 0% |
| 1940s | 5 | 66% | 96% | 50% | 43% | 53% | 25% | 0% |
| 1950s | 6 | 69% | 94% | 53% | 45% | 55% | 27% | 0% |
| 1960s | 5 | 63% | 94% | 51% | 37% | 47% | 23% | 0% |
| 1970s | 5 | 67% | 93% | 53% | 37% | 48% | 25% | 0% |
| 1980s | 4 | 66% | 93% | 50% | 35% | 47% | 23% | 0% |

**This is a picture of cataloguing, not of film-making.** A director is
recorded for nine pictures in ten in every era — the record has always
known who directed. Everything else arrives late and unevenly. Composers
are at 1% before 1920 and 55% by the 1950s. Editors are at 1% until the
1920s. **Costume design is under 1% in every decade of the corpus** and is
effectively absent as a craft despite being one of the ten credit
relations the project counts.

A picture from the 1890s has a median of **one** recorded maker.

---

## 2. How many names a closing rests on

| names on record | share of closings |
|---|---|
| one | 34.0% |
| two | 15.5% |
| three or four | 18.2% |
| five to nine | 17.2% |
| ten to nineteen | 11.2% |
| twenty or more | 3.9% |

**Half of all closings rest on one or two people.** For those, a wrap
marks the end of a filing entry rather than the end of a living connection
to the picture.

The share is U-shaped by release decade and follows §1 exactly: 93% in the
1890s, 57% in the 1910s, 31% in the 1930s and 1940s, 60% by the 1960s,
81% by the 1980s. **The middle of the century is the only stretch where a
wrap approximates what it sounds like.**

---

## 3. Two ways to be the last of a picture's makers

Neither has anything to do with prominence.

**One name standing for a production.** The largest closers are producers
and directors credited on hundreds of shorts where they are the only
recorded name.

| pictures closed | median credits on those pictures | who |
|---|---|---|
| 859 | 2 | William Nicholas Selig, producer |
| 522 | 1 | Siegmund Lubin, producer |
| 417 | 1 | Lewin Fitzhamon, director |
| 381 | 1 | Georges Méliès, director |
| 368 | 6 | Hal Roach, producer |

They did not outlive their collaborators. They *were* the record.

**The youngest person on a crowded set.** Where the credit list is long,
the last survivor is usually whoever was a child on it — Dickie Moore,
Cora Sue Collins, Robert Blake, Phyllis Coates. Of everyone who closed
five or more pictures, roughly 110 were sixteen or younger when the
picture was released.

**The on-screen split traces the same U as §1 and §2:** 89% of 1890s
closings were by someone behind the camera, 42% in the 1930s, 78% by the
1980s. It is a knob for finding things, not a fact about film history.

---

## 4. The unit of analysis is the death

| release decade | closings | distinct deaths | closings per death |
|---|---|---|---|
| 1900s | 3,027 | 364 | 8.3 |
| 1910s | 23,947 | 3,458 | 6.9 |
| 1920s | 12,909 | 3,931 | 3.3 |
| 1930s | 13,814 | 4,647 | 3.0 |
| 1940s | 11,616 | 4,594 | 2.5 |
| 1950s | 11,062 | 5,039 | 2.2 |
| 1960s | 8,291 | 4,374 | 1.9 |

Selig's single death accounts for 812 of the 1910s closings. Méliès's for
280 of the 1900s — 9% of the decade.

What it does to a real measure, westerns as a share of closings:

| cohort | by picture | by death |
|---|---|---|
| 1910s | 1.5% | 5.4% |
| 1930s | 3.6% | 6.4% |
| 1950s | 5.6% | 7.0% |

**A quarter of that measure's apparent movement across the century is the
counting error rather than the world.**

---

## 5. One death, one body of work

The largest share of a genre-and-decade a single death closed.

| share | pictures | cohort | who |
|---|---|---|---|
| 65% | 91/139 | 1900s fantasy | Georges Méliès, director (d. 1938) |
| 32% | 87/276 | 1910s documentary | William N. Selig, producer (d. 1948) |
| 30% | 37/122 | 1930s family | Mae Questel, voice (d. 1998) |
| 29% | 57/196 | 1900s documentary | Cecil Hepworth, cinematography (d. 1953) |
| 20% | 16/81 | 1930s cartoon | Dick Lundy (d. 1990) |

**Two phenomena share this shape and a graphic must not merge them.**
Méliès is §1 showing through — he is the only credited name on most of his
own pictures, so his death closes them by construction. Mae Questel is the
real article: 1930s cartoons carry full credit lists, she voiced hundreds
of them, and she outlived those casts by decades. A whole genre of a
decade held open until 1998 by one performer.

Everyone in this view is dead, which is why it can be built at all. The
living equivalent is the ranked list refused under *The door held open* in
`DECISIONS.md`. The distinguishing test is the tense.

---

## 6. Genre is a sort knob, not an explanation

Survival within a fixed release cohort, which is the only honest form.

| genre | 1930-39 closed | 1950-59 closed | 1979-87 closed |
|---|---|---|---|
| documentary | 100% | 91% | 38% |
| western | 97% | 72% | 4% |
| comedy | 97% | 54% | 4% |
| drama | 95% | 51% | 5% |
| horror | 91% | 43% | 3% |

Documentaries close first and fastest in every cohort measured, and the
gap widens the younger the cohort: less than 2× in the 1950s, six to
nineteen times in the 1980s.

**This is almost certainly not about documentaries.** A documentary
credits a handful of adults; a musical credits dozens of performers
including children; and the last survivor of a picture is usually whoever
was youngest on it (§3). Genre is standing in for *how many people, and
how young*. Both of those are stored and the hypothesis has not been
tested.

**Do not plot median wait on an unfinished cohort.** The 1979-87 medians
are 33-39 years across every genre on cohorts 2-6% closed. That is not how
long these pictures take to close; it is how long the fastest 3% took.

---

## 7. Resolution — what a closing date actually claims

| how the last death was recorded | closings |
|---|---|
| to the day | 88.2% |
| to a month | 0.5% |
| to a year | 4.1% |
| not at all | 7.3% |

Only day-precision may print as a date or name a person. Wikidata's
precision ladder runs past the year into decade and century: 548 closings
were once dated from century-precision deaths, which serialise as
`1901-01-01`, and were filed as having wrapped in 1901.

**Every day of the calendar year is populated** — median 211 closings per
calendar date across all years, minimum 3, maximum 1,030. The busiest are
15 July, 10 October and 11 September, which is a recording artefact worth
showing rather than hiding.

---

## 8. Country

Period-accurate labels, so series break at every partition. Of 80 labels
in the corpus, 24 belong to states that no longer exist.

| pictures | label | |
|---|---|---|
| 116 | Austria–Hungary | to 1918, 7 successor states |
| 72 | British Raj | to 1947, 4 successor states |
| 46 | Soviet | to 1991, 15 successor states |
| 20 | Nazi Germany | to 1945, 4 successor states |
| 19 | Czechoslovak | to 1992, none recorded |
| 3 | Empire of Japan | to 1947, now Japan |

**A query for "Indian" pictures finds almost nothing before 1947**, and a
query for "British Raj" finds nothing after. Anyone crossing country with
era will hit that discontinuity and read it as a collapse in Indian
film-making, which is backwards: Indian production was enormous and is
almost entirely unrecorded here — 37 titles across 1930-45 against 8,285
American ones.

---

## 9. Ideas not yet built

**State turnover against fictional state turnover.** Real states appear
and dissolve across the corpus (§8) at a rate the archive can measure.
Invented ones — Ruritania, Freedonia, and their descendants — appear and
vanish on a different schedule, driven by what was politically sayable
rather than by what happened. Wikidata records fictional countries and
narrative locations (`P840`), so both series are obtainable and neither is
currently fetched. The interest is in the shape of the difference: real
turnover clusters at 1918, 1945, 1947, 1991; fictional turnover probably
leads or trails those dates, and by how much is a question nobody has
asked of this data.

**Cast size and cast age as the real variable behind §6.** Both are
stored. The test is direct and has not been run.

**Survival curves by cohort**, x-axis years-since-release, never calendar
date — the one form that cannot express the artefact in rule 1.
