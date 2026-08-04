# How we decide a picture has wrapped

Plain prose, start to finish. No code. It is written to be held against
the code and found wrong, so every claim here is meant to be checkable.

Last audited against the code on 2 August 2026. The audit of 28 July found
nine errors in the previous version of this file; the corpus pass of 1-2
August added six rules and corrected three. **The canon below is the
authoritative list**; the prose after it explains each one.

Last reviewed 3 August 2026, when rule 6 reached the film page, rules 30
and 31 were written down after the same picture was found in the Vault
twice, and rules 32 and 33 followed from building the retraction record —
32 because eleven pictures were closed under one release year while
another year knew somebody living.

**Last revised 4 August 2026, and it was the largest revision the canon
has had.** Rule 4 was withdrawn and rewritten, 4b and 35 were added, and
rule 2 changed — the canon now holds **36 rules**. Five rule changes moved
closings from 97,395 to 95,567, every one of them away from claiming
somebody is gone. The prose after the table carries the account of each,
in the order they happened, and the entry that matters most is the first:
for a day the audit was failing 123 of 137 years while this file recorded
that it passed.

---

## The canon

Every rule currently in force, what it decides, where it lives, and — the
column that matters — **whether anything checks it**.

A rule nobody checks is a rule that has already drifted from the code
once, in this project, three times. The audit reproduces every verdict
from stored evidence, so rules marked *reproduced* are verified against
95,567 closings on every run. The rest are asserted, and are listed as
asserted rather than quietly implied to be safe.

| # | rule | lives in | checked? |
|---|---|---|---|
| **What a person is** | | | |
| 1 | **Dead** — a death date from either database, a death Wikidata asserts without dating, or an age past 122 | `verify.js` `statusOf` | reproduced |
| 2 | **Living** — a birth year from either database, no death anywhere, age within 112. Precision is not required and must not be: the claim it would guard is the safe one | `verify.js` `statusOf` | reproduced |
| 3 | **Unrecorded** — anything else, including any age between 112 and 122, and any failed lookup. Never drawn as living: a person with no dates at all leaves the reckoning rather than sitting above the bar | `verify.js` `statusOf`, `app.js` `viewFilm` | reproduced |
| 4 | A birth date **places** somebody if Wikidata holds one at any precision, if TMDB's is precise to the day, or if both agree on the year. A lone imprecise TMDB date does not: `1920-01-01` is a year in a date-shaped field, not a birthday | `verify.js` `statusOf` | reproduced |
| 5 | Where the databases disagree on birth year, the **later** year is used — the reading most likely to keep a person alive | `verify.js` | asserted |
| 4b | **Uncredited people are outside the reckoning.** TMDB lists everyone who appeared and marks the difference in the character string; a person the picture did not credit does not veto a closing and does not date one either | `verify.js` `uncredited` | reproduced |
| **Arithmetic, not judgement** | | | |
| 6 | Nobody worked on a picture **released before they were born**; such credits vote on nothing and date nothing | `verify.js` `impossible`, `app.js` `readPeople` **and `viewFilm`** | reproduced |
| 7 | A picture **cannot close before it was released**; an earlier death cannot date it | `verify.js` `wrapDate`, `app.js` `readPeople` | integrity check |
| 8 | Past 122 a person is dead whether or not a death was recorded — including via the release year, when no birth date exists | `verify.js` `beyondLiving`, `app.js` `readPeople` | reproduced |
| **Dates** | | | |
| 9 | The **last** death decides the wrap, at whatever precision it carries | `verify.js` `wrapDate` | reproduced |
| 10 | Only a **day-precise** death may print as a date or name a person; a month gives a month, a year gives a year, anything coarser gives no position at all | `verify.js` `resolutionOf` | integrity check |
| 11 | Birth precision and death precision are **read separately**; neither answers for the other | `verify.js` `fromWikidata` | integrity check |
| 12 | Dates from both databases pass the **same parser**; a value that is not a date is not a date | `verify.js` `day` | asserted |
| **Identity** | | | |
| 13 | If **two or more Wikidata items claim one TMDB id**, none of them is used; the person falls to TMDB's own dates | `verify.js` `survivors` | asserted |
| 14 | A person may be buried by **name and exact birth year together**, and only when exactly one candidate matches and carries a death | `verify.js` `deathsByName` | recorded per person |
| 15 | Names carrying quotes, backslashes or control characters never reach a query | `verify.js` `deathsByName` | asserted |
| **What closes a picture** | | | |
| 16 | **One living person vetoes.** Not a majority, not a threshold | `judge.js` | reproduced |
| 17 | **Unrecorded people never veto**, and are counted and published by name | `judge.js` | integrity check |
| 18 | A test that **did not run** is not a finding of nobody | `verify.js` `ok` | asserted |
| 19 | The pass **short-circuits** on a living Wikidata credit and records who in `heldOpenBy`; a later rule making *living* stricter leaves those pictures **untested**, not closed | `judge.js`, `retest.js` | detected by audit |
| **What is in the archive at all** | | | |
| 20 | A maker is anyone credited under one of **ten credit properties** | `shared.js` `CREDITS` | asserted |
| 21 | A picture is one of **twelve work classes**, not `film` alone | `shared.js` `WORK_CLASSES` | asserted |
| 22 | Release year is the **latest** `P577` when a picture has several — the permissive reading | `pass.js` `worksQuery` | asserted |
| 23 | **No minimum cast.** The floor governs the announcement queue only, never what is recorded | `lib.js` `MIN_CAST` | asserted |
| **Labels** | | | |
| 24 | A genre label that merely repeats the work's type is dropped | `enrich.js` | asserted |
| 25 | A demonym belongs to whichever state **still uses it**; only a label every matching state has abandoned gets a dissolution footnote | `enrich.js` | asserted |
| **People** | | | |
| 26 | Withholding a name takes **the name and never the vote** | `pass.js`, `app.js` | asserted |
| **Where the rules are applied** | | | |
| 27 | A **person page and a film page ask Wikidata directly** and gather their own people, which no offline test can reach. What they CONCLUDE from those people is `verify.js`'s and is checked against the corpus on identical input | `verify.js` `classifyRoster`, `poster/check-pages.js` | **checked, 259,773 of 260,112** |
| **Disagreement** | | | |
| 28 | Where two sources give **different dates** for one death, neither is preferred: the published date stands and the disagreement is published beside it | `provenance.js` | asserted |
| 29 | Agreement on the **year** where one source records only a year is **not** a disagreement — it is one source knowing less | `provenance.js` | asserted |
| **One picture, one closing** | | | |
| 30 | A picture is **one work class**, the most specific Wikidata gives it; several classes are not several pictures | `pass.js`, `shared.js` `mostSpecificType` | asserted |
| 31 | A picture is **filed once**, under its earliest release year, however many release dates it has; the id decides, never the title | `build-corpus.js` | integrity check |
| 32 | A living person found under **any** release year vetoes the picture under **all** of them; a second release year cannot outvote a survivor | `build-corpus.js` | integrity check |
| **Retraction** | | | |
| 33 | A closing that leaves the corpus is **recorded, not deleted**: what was published, when it entered, when it left, and who was found living. The record is kept, not shown | `build-corpus.js` | asserted |
| **Evidence** | | | |
| 34 | A closing needs **at least one recorded death**, or a release year old enough that arithmetic settles it; nobody living and nobody dead is **unclassified**, not closed | `verify.js` `evidenced` | reproduced |
| 35 | **The verdict is drawn in one place.** Anyone living holds a picture open, nobody recorded dead leaves it unclassified, the rest have closed — and every surface calls the same function rather than retyping it | `verify.js` `verdictFor` | reproduced |

### What the audit actually does

Three questions per year, and the first is the one that makes this list
circular rather than decorative:

1. **Reproduction.** Re-decide every verdict and every wrap date from that
   year's own evidence, with the network unplugged. Any rule marked
   *reproduced* above is exercised 95,567 times per run, because a
   verdict that cannot be re-derived from the evidence means either the
   rule changed or the evidence is insufficient — and rule 19 is why those
   two are reported separately.
2. **Replay.** Re-decide under a different age threshold, from the files
   alone. If that needs the network, the evidence is incomplete.
3. **Integrity.** Every wrap date is day-precise, belongs to a named
   person in the evidence, and does not precede the release; unknown
   counts match the unknowns listed.

### The day-precision rule, and why it was withdrawn

*4 August 2026. The largest correction this archive has made to itself.*

A picture on the front page said *The Squeaking Shoes* (2004) had wrapped.
Its own page showed two men living: Mehrdad Jenabi and Vahid Nik-Khah
Azad, both born 1956, credited on it, recorded nowhere as dead.

Both are Wikidata precision 9 — a year, with `-01-01` standing in for a
day nobody recorded. Rule 4 required a birth date to be day-precise, or
corroborated by both databases on the year, before anyone could be called
*living*. Neither qualified, both came back *unknown*, unknown never
vetoes, and the picture closed on Akbar Abdi's death in July 2026.

**The rule was asymmetric and that is the whole of it.** Precision was
demanded to hold a picture OPEN — the safe direction, where being wrong
costs a closing — and demanded nothing to let one CLOSE, which is the
only claim on this site that can be wrong about a living person. The
comment defending it argued that precision matters for *alive* and not
for the line above it, which is true of the claim it was written for and
was never tested against the claim it enabled.

Measured before the change: **3,132 closings — 3.2% — rested on somebody
with a birth year, no recorded death, and an age under 112. 846 rested on
somebody who would be under 70 today.**

The line is now placement, not precision. If the record can put you in
time and shows no death, you are not evidence of a closing. If it cannot
place you at all, rule 17 still holds — and must, because **49.3% of
closings hold at least one person with no birth year anywhere**, and
holding those open forever would be a claim about a blank.

**And placement has to come from something that placed a person.** The
first version of this went too far and was narrowed the same night. With
precision dropped outright, *Mildred Pierce* (1945) reopened on Bill
Alcorn — "Soldier (uncredited)", existing as `1920-01-01` in TMDB and
nowhere else at all, holding the picture open at a notional 106. He is
the case the withdrawn rule was written for; the comment defending it
named him.

So the test is not precision and not nothing: **a lone imprecise date
from TMDB does not place anybody, and a Wikidata item at year precision
does.** `1920-01-01` is what TMDB stores when it knows a year and no
more — a year in a date-shaped field. A Wikidata item is somebody
catalogued as a person with the day absent rather than invented, which is
what Jenabi and Nik-Khah Azad are.

That distinction is what the original rule failed to draw. It demanded
day precision from everybody, so it silenced the two Iranian crewmen
along with the uncredited extra.

What it cost, offline, from evidence already on disk:

| | before | after |
|---|---|---|
| closed | 97,395 | **95,567** |
| unclassified | 23,161 | **16,201** |

9,220 pictures moved, every one of them into *running*. Nothing moved
into *dead*. The unclassified drop is the half nobody predicted: those
pictures were never unplaceable — they held a name and a year, and
calling them unclassified was its own quiet false claim.

It also found a second bug, in the tool doing the correcting.
**`rebuild.js` was carrying `p.status` through untouched** and re-deriving
only the verdict over it, so it was a re-decision about pictures and not
about people. The first run after the rule changed reported no reopenings
at all. It now re-classifies every person in the same order `audit.js`
does, and it can return a picture to *open*, which it never could before.

---

**And *reproduced* means only that the audit agrees, which is a claim
about the audit as much as about the rule.** Rule 34 was marked
*reproduced* on 3 August and was not: `audit.js` had its own verdict
branch, which returned `closed` whenever nobody was alive and had never
heard of the third state. It re-derived `closed` for all 23,583
unclassified pictures and reported **123 of 137 years as unreproducible**
— while `HANDOFF.md` went on recording "137 years, 0 failures", because
nobody re-ran it after the rule landed.

The corpus was right and the checker was wrong, which is the worse
direction for an audit to fail in: a check that cries wolf stops being
read, and this one had 23,583 wolves. Fixed on 4 August by importing
`evidenced` from `verify.js` — the same function `judge.js` and
`rebuild.js` ask — instead of keeping an opinion. 137 years, 0 failures,
and this time the run is in the commit.

The lesson is the one the README already states about `verify.js`: the
copy always outlives the fix. `audit.js` deliberately does not import
`survivors()`, because an audit that calls the thing it audits tests
nothing — but that argument covers the *gathering* of people, not the
*verdict* drawn from them, and the file had quietly extended it to both.

**So the verdict was extracted, later the same day.** Rule 35: three
lines that were written out in four files now live in `verify.js` as
`verdictFor`, and `judge.js`, `audit.js` and `app.js` call it. The
extraction is behaviour-preserving and was checked twice — 200,000
generated cases against the four expressions it replaced, and the full
137-year audit before and after, whose output is byte-identical.

It also fixed a fourth copy that had never fired. `app.js`'s test was
`dead + excluded === credited`, which returns TRUE when every credited
person is excluded and none is recorded dead — the unclassified case,
called closed. It was invisible because the whole test is ANDed with
corpus membership and `ids.bin` holds closings only, so the corpus
refused on the page's behalf. A rule that is wrong but covered for is
still wrong, and it is the kind that surfaces the moment the thing
covering for it changes.

**What extraction cannot reach**, and why rule 27 survives: how the
people are GATHERED still differs, irreducibly. The pass reads Wikidata
and TMDB and writes the answer down; the browser asks Wikidata live and
cannot afford the survivor test on a page load. That difference is why a
film page moves the day a death is recorded rather than the day a pass is
run. Sharing the verdict guarantees every surface draws the same
conclusion from the people it has — not that they have the same people.
The check described in `BACKLOG.md` is for that residue, and is the right
tool for it precisely because its test is not equality.

### Uncredited people stopped voting

*4 August 2026, and it changes wrap dates rather than counts.*

TMDB lists everyone who appeared in a picture, credited or not, and marks
the difference only in the character string: `Soldier (uncredited)`. This
archive's claim has always been about people **credited** on a picture —
"everyone" means everyone recorded — so an extra the picture declined to
record is outside it. Whether Bill Alcorn is alive says nothing about
whether the people who made *Mildred Pierce* are gone.

**Both directions, and the second is the one that moved things.** An
uncredited person does not hold a picture open, and does not date its
wrap either. *Intolerance* (1916) was closed on Peggy Cartwright, "Little
Girl (uncredited)", in 2001; it now closes on **Lillian Gish in 1993**.
*Some Like It Hot* was open on an uncredited survivor and now closes on
**Nehemiah Persoff, 2022**.

**The error runs against this project's grain, which is why the test is
literal.** Everywhere else, being wrong costs a picture its wrap. Here a
false match REMOVES a veto and can close a picture on somebody living. So
it matches the exact parenthesised word TMDB uses, nothing inferred, and
a person whose role was never stored is not uncredited — they are unknown
and they keep their vote.

**Which is the limit.** `role` was only written into the evidence for
years passed after the field was added, the same gap that leaves 27% of
closers without an on-screen flag. So this is complete on the film page,
which reads TMDB live, and partial in the corpus:

| | |
|---|---|
| pictures holding a TMDB-sourced person | 93,498 |
| closings dated by a *known* uncredited person, now fixed | 47 |
| closings dated by a TMDB person whose role was never stored | 7,325 |
| opens held by TMDB people whose roles were never stored | 18,169 |

**Re-fetched on 4 August**, and the corpus answers it now. `retest.js`
gained a third staleness clause — a verdict that turns on a credit we
never kept — which selected 44,424 pictures: a closing DATED by a
TMDB-sourced person with no stored role, or an open picture whose EVERY
living person is that. Three hours, and self-clearing, because judge.js
captures `role` on the way past.

| | before | after |
|---|---|---|
| TMDB-sourced people with a role kept | ~25% | **980,218** |
| people marked uncredited | 686 pictures' worth | **75,661** |
| closings dated by an uncredited person | 47 known, thousands unknowable | **0 of 96,107** |

The run also broke the strict form of the test. It matched `(uncredited)`
exactly, on the reading that TMDB has one convention; it has several. Mel
Blanc is `Bugs Bunny (voice / uncredited)` on *Jasper Goes Hunting* and
dated its closing until this looked for the word rather than the
parentheses. 228 roles in 144 forms sat outside the strict test and every
one of them said the same thing.

**A caution about verifying this, which cost an hour.** Checking "is any
closing dated by an uncredited person" by matching the closer's NAME
against the evidence reports false positives, because two people share a
name more often than seems possible. *Hunted Men* (1938) has two Mary
Parkers — born 1918, uncredited, died 1998; and born 1930, credited,
died 2023. The closer is the second. Match on identity.

It also found a third bug in `rebuild.js`. The file refused to re-derive
any `open` the pass had written, on the rule-19 argument that a
short-circuited open never gathered its population. True of a
short-circuit, false of a **tested** open, where the survivor test ran
over everybody — so fourteen pictures whose only survivor was an
uncredited extra sat open while the audit failed thirteen years pointing
at them. The exemption now turns on `tested`, which is what rule 19
actually says.

---

### Rule 27 is checked now, and it found two things

*4 August 2026. `poster/check-pages.js`.*

The backlog proposed sampling: run the page's logic over the LIVE
filmography for a few hundred pictures and explain the differences away.
That test cannot separate what it finds — Wikidata moves, so a
disagreement is either drift in our code or a credit added last Tuesday,
and telling those apart is a judgement about every result.

So the question was narrowed until it had an exact answer: **given the
same people, do the two implementations reach the same verdict?** The
page's classifier is now `classifyRoster` in this file, and the checker
feeds it the corpus's own stored evidence, shaped into the flat rows a
roster works on. Same input, so a disagreement is drift and nothing else.
Offline, complete rather than sampled, and it runs in the time it takes to
read the evidence.

**260,112 pictures could be compared** — the rest were skipped because the
corpus used somebody the page cannot see, which is TMDB-resolved people, a
death Wikidata asserts without dating, or a burial by name. Those are the
irreducible half of rule 27 and no offline test reaches them.

**161 disagreements were the page reading 113-to-122-year-olds as
living.** `statusOf` calls that band *unknown* — a birth date and no death
stops being evidence in either direction — and the page had no version of
it, excluding only people past 122. So somebody aged 115 vetoed a picture
the corpus had closed. Fixed: the band is in `classifyRoster`, and those
pages stopped contradicting the Vault.

**339 remain, and they are one thing.** The corpus can close a picture by
arithmetic alone — `evidenced` returns true when the release year predates
any possible living person — and it records that as a closing with no
date. **The film page has no way to draw a wrap without a date**: `wrapped`
is derived from having one. So an 1896 picture whose credits carry no
dates reads "Wikidata has no one credited on this one" while the Vault
lists it as wrapped.

That is a design gap rather than a rule drift, and closing it means giving
the page a wrapped-but-undated state — the title card, the bar's position
and the closing line all assume a date. 1,362 closings in the corpus carry
no date at all, so the gap is wider than the 339 the checker can see.

---

**Asserted means only that a human wrote it down.** Rules 5, 12, 13, 15,
18, 20-30 and 33 are not checked by anything, and the honest reading of that
column is that those are where the next drift will be found — which is
how rule 6 was found on 1 August, having been applied to half the people
it named for as long as it had existed.

Rule 27 is the same lesson a second time, and it is worth stating plainly
because it bounds everything above. **The audit checks the corpus, and the
corpus is not the only thing that decides.** A person page cannot read a
verdict off the corpus alone: a filmography spans years the pass may not
have reached, and the corpus is a snapshot while Wikidata is live. So it
asks Wikidata for the credits and judges them in the browser — a second
implementation of rules 6, 7 and 8, in a second language, that no audit
run touches.

It drifted exactly as the column predicts. Until 2 August the page
counted credits, deaths and the too-old, and closed a picture when the
numbers met. Rules 6 and 7 are not expressible as counts, so they were
not applied, and Philip Glass — born 1937, credited on *Dracula* (1931)
for the score he wrote in 1999 — held that picture open on this page
while the Vault had it closed on Carla Laemmle in 2014. Being alive, he
would have held it open indefinitely, and nothing would have explained
why.

The page now returns the people rather than the arithmetic, so a new rule
is a new line of JavaScript over the same facts `verify.js` is given,
rather than another `COUNT` column that some rules cannot be written as.
That makes the two implementations easier to keep in step. It does not
make them one implementation, and this row stays *asserted* until
something checks them against each other.

---

## The question

A picture has wrapped when everyone credited on it is dead. That is the
whole claim, and it is a claim about living people, so the cost of being
wrong is not symmetrical. Saying a picture is still running when it has
closed is a missed post. Saying it has closed when someone is alive is
telling the world a living person is dead.

Everything below is arranged around that asymmetry.

## Three states, and only one of them is an answer

Every person we look at ends up in one of three buckets.

**Dead** means a database gave us a death date. Nothing else puts anyone
here. We never infer a death from age, from silence, or from the absence
of a record.

**Alive** means we have a birth date we can credit and nobody recorded a
death. This is the bucket that stops a picture closing.

**Unknown** means we have nothing usable. It is not a soft version of
dead — it is the honest bucket, it is counted and stored, and it never
blocks anything. A picture can close with unknowns on it, and most do.

The consequence worth stating plainly: **unknowns do not protect a
picture.** If we cannot answer for someone, the picture can still be
declared wrapped over them. That is the largest judgement call in the
project. It is defensible because of *era* — for a 1935 picture, a person
with no recorded dates is almost certainly dead — but nothing in the code
knows that, and the same rule on a 2005 film would be reckless. The
backfill's year range has been quietly protecting us.

The median Vault entry has two such people on it. There are 12,786 across
the archive.

## How a picture comes up for consideration

Four routes. Three of them can put a picture in the queue; the fourth is
the website, which decides what a visitor sees.

**The sweep** is the ordinary one. We ask Wikidata for everyone who died
in the last few days and has a screen credit. For each of them we ask,
from the film's side, which of their pictures now have nobody living.

Two details that phrasing hides. The test is that no *object* of a credit
property lacks a death date — and the object need not be a person, so a
film crediting a production company as producer can never pass, because a
company has no death date. And the query also requires at least one
credited person who *does* have one, so a film with no recorded credits
at all never comes back.

**The backfill** handles pictures that closed before any of this existed,
where there is no future death to react to. Asking the question directly
for a whole year times out, so it goes in two stages: a cheap per-year
rollup that counts credited cast against dead cast and keeps the films
where those match, then the exact, crew-inclusive test on each survivor of
that filter.

The rollup is **films only** — a specific Wikidata type — and requires a
release date. Television, miniseries and anything undated cannot be
reached by a backfill at all, whatever year you give it. That is a second
boundary on the Vault, alongside the year range, and it is invisible.

**The watcher** listens to newsrooms on Bluesky. When one reports a death
it resolves the name and asks whether that person closes anything. It runs
ahead of Wikidata, because the wrap test does not need the new death date
— everyone else on the picture is already recorded. What it produces is
marked provisional.

**The website** runs the same survivor test live, in the browser, on any
film page that would otherwise show a picture as wrapped. It is the only
caller that refuses to make the claim when the test doesn't complete.

## Two filters, and they are not applied everywhere

On the **sweep** and the **backfill**, a candidate is dropped if the film
has **no name in any language** we asked for, because there is nothing to
publish; and if Wikidata records **fewer than five cast members**. The
second is editorial, not logical. Without it, a wide sweep queued hundreds
of films with nobody but a director on record — documentaries and concert
films that "closed" the moment one person died.

Two things to know about that floor. It counts one property, the ordinary
cast credit, and **not** the voice-acting credit — so an animated film
with forty voice actors and no live cast scores zero and is dropped. And
**the watcher applies neither filter**: a newsroom report can queue a
picture with one credited person and no title but a Q-number.

## The survivor test

This is the heart of it. Wikidata thinks everyone is dead; we now ask
whether Wikidata knew the whole cast.

**We need a TMDB id for the film.** Without one there is nothing to ask,
and the test says so rather than returning a clean result — see "when the
test cannot run" below. Around 113 Vault entries have no TMDB id and have
never been tested by anything except Wikidata's own view of itself.

Given an id, we ask TMDB for the film's full credits, cast and crew. Then
we set aside everyone TMDB names who is *already linked from the film's
own Wikidata item*, because Wikidata's test has covered those people
already.

That justification holds for the sweep and the backfill. It does **not**
hold for the watcher, whose Wikidata test deliberately exempts the person
the newsroom just reported — so if that person carries a TMDB id they are
set aside here too, and nobody has checked them. It is intended, since
the whole point is running ahead of Wikidata, but it means the watcher
has one unexamined person on every picture it drafts.

For each remaining person we ask three questions in order.

**First, does Wikidata know this person by their TMDB id?** If so we take
their birth date, its precision, and their death date if any. If *two or
more* Wikidata items claim the same TMDB id we discard all of them and
treat the person as unknown to Wikidata. Two items claiming one identifier
is a contradiction, not a source, and picking one would mean picking
whichever the query service happened to return first — which is not
stable between runs.

**Second, what does TMDB itself hold?** We ask this for everyone Wikidata
has not buried — a wider group than "everyone Wikidata has never heard
of". A Wikidata item with no death date is not a living person; it is a
person nobody has recorded the death of, and TMDB may well hold that death
date. Skipping this step was how a man who died in 1992 spent months
vetoing a picture.

Now we decide, using both records together.

- Either database gives a death date → **dead**.
- Neither gives a birth date → **unknown**.
- No birth date is precise, and the two do not agree on a year → **unknown**.
- The birth date puts them past the oldest age we credit → **unknown**.
- Otherwise → **alive**.

When the two databases disagree about a birth year, the age test uses the
**later** year — the youngest reading, the one most likely to keep someone
alive. Same asymmetry as everywhere else.

**Third, we ask Wikidata by name.** Some people Wikidata knows perfectly
well are not linked to their TMDB id, so the first question missed them.
We look for a person with exactly that name, who is a human, whose birth
year matches exactly. If exactly one such person exists and they have a
death date, they are dead. If several match, that is ambiguity and we
change nothing.

This runs for anyone not already dead — including people currently reading
as *unknown*, not only survivors. It silently skips names longer than
sixty characters or containing a quote, and it asks for the name as
English text even when the name came from a non-English label. Those are
the conditions under which this pass quietly does not fire.

The test returns **three** things: everyone found alive, a count of the
unknowns, and whether the test actually ran. Any name in the alive list
stops the picture. The unknown count is recorded alongside the entry and
stops nothing.

## When the test cannot run

An empty survivor list from a test that never ran is not a finding, and
telling those apart is what the third return value is for. It comes back
false when there is no TMDB id, when the credits fetch fails, when TMDB
has no credits at all for the film, or when any query throws.

Every caller now reads it, and they split the two cases using something
they already know:

- **No TMDB id.** Nothing to ask, and that will be as true tomorrow. The
  picture goes through on Wikidata's answer alone and is marked
  unverified. Refusing these would quietly drop the obscure and
  non-English end of cinema, which is most of what closes.
- **The lookup failed.** We asked and got nothing. The sweep and the
  backfill defer the picture and do not record it as seen, so it comes
  back round. The watcher declines to draft. The re-check marks the entry
  unchecked. The website declines to raise the bar.

The whole survivor test is also contingent on a TMDB key being present in
the environment. Without one it reports that it did not run. The re-check
refuses to start at all.

## What counts as a birth date

An imprecise birth date on its own is not evidence that someone is alive.

Wikidata answers this properly — every date it holds carries a precision,
and a date known only to the year is stored as the first of January
because it has to be stored as something. We ask for the precision rather
than guessing from how the date looks.

TMDB publishes no precision at all. There, a birthday falling on the first
of January is the only signal available, and it is a guess about the
source rather than a fact from it. That is a limitation of TMDB, not a
rule we chose.

So a birth date counts if it is precise, **or** if both databases give one
and they agree on the year. Two sources agreeing is evidence even when
neither is precise. One imprecise date, uncorroborated, is a year somebody
typed into a field, and a year is not a person.

## The oldest age we will credit

There is a maximum age past which we stop calling someone alive. It is a
chosen number and should be read as one.

It is defensible only because of what it decides. It moves people from
*alive* to *unknown* — never to *dead*. Being wrong with it costs a
picture its closing, which is the cheap mistake. It is not permitted to
bury anyone, and it used to, which was a bug of the same kind as every
other one this system has had.

## What happens to a picture that passes

It goes into a queue. Nothing about being in the queue is public.

A human works through the queue and approves each entry, and that approval
is the only thing that posts. Approving happens per group — one death
often closes several pictures at once — and each picture's Wikidata link
is printed so the evidence can be opened and read.

**That describes the posting path and not the bulk one.** There is a flag
to file a whole queue into the archive without posting any of it, and
another to skip the prompt entirely; together they are how 3,591 of 3,640
Vault entries got in. The human-reads-every-item protection is real for
anything published and does not describe the archive at large.

**Filing does not re-test anything.** Whatever the queue believed when the
picture was found is what goes into the archive. If the logic has changed
in between, the archive inherits the older judgement. This has bitten us.

Filing also builds each entry from a fixed field list, so anything the
finder recorded that the list does not name is dropped — including
whether the picture came from a backfill, whether the watcher flagged it
provisional, and whether it went through unverified. The Vault cannot
currently tell you which of its entries were bulk-imported.

## Re-checking

Pictures can un-wrap. Somebody adds a living cast member to Wikidata and
an entry that was true when filed stops being true.

The re-check walks the whole archive and asks two questions of each entry.
First, straight to Wikidata: does this film have any credited person with
no death date? If the query fails we mark the entry unchecked and move on
— a failed query is not a verdict. If it returns anyone, the picture
reopens.

Second, the full survivor test. If it could not run — no TMDB id, a failed
fetch, an error — the entry is marked unchecked. It stays in the archive
but is not counted as verified, because nothing verified it. Reading a
failed check as a pass is a bug this file used to describe as fixed while
three of its four failure modes were still live.

Anything that reopens is removed, and its id is cleared from the record of
films already considered, so a future sweep can find it again.

## What we have actually asked about

Everything above describes how the question is answered. It says nothing
about which pictures have been asked, and those are different facts.

The Vault is not "every picture that has wrapped". It is every picture we
have got around to asking about, and that set has a shape. It has **three**
origins, not two:

- **The backfill has been run over 1930 to 1945, and nowhere else.** That
  is 98.5% of the Vault.
- **The sweep and the watcher** have caught what closed while the poster
  was running. Only 37 entries have ever been posted.
- **A hand-written seed file** from before any of this was automated.

Of the 54 entries released outside 1930–45, nine are from 1929, three have
no year at all, and nine were filed rather than announced. "A few dozen
recent closings" was the previous version of this paragraph and it was
wrong in three ways.

The join between backfilled and swept is not a gradient, it is a cliff.
There are 230 entries released in 1945 and **two** released in 1946.
Nothing changed about cinema in 1946; that is simply where the range we
typed stopped.

This matters most on a person's page, where a career crosses the boundary
and the archive does not. Of ten people sampled out of the Vault, only 27%
of their closed-looking films had an answer recorded — 30–100% for the
1930s and 40s, 4% for Doris Day. That measurement was taken by hand on
28 July 2026 and is not reproducible from anything in the repository.

So a picture missing from the Vault means one of two things, and the Vault
cannot tell you which: it was asked about and someone was alive, or it was
never asked. Only the first is a finding.

Until 28 July 2026 there was a third case. Films were recorded as
"considered" *before* being tested, so a picture declined because somebody
was alive could never be offered again — including after that person died.
1,367 pictures were sealed off that way. The recording now happens only
when a picture is actually queued, and the sealed ids have been cleared.

There is nothing clever to do about the cliff. It goes away by running the
backfill over more years, and not otherwise.

Separately, entries with no TMDB id were closed by Wikidata alone, because
there was nothing to ask TMDB about. In the corpus that is 56,441 of
123,820 closings — 45.6%, not the 113 this paragraph counted when the
archive was the old 11,457-entry Vault.

Nothing on the page used to distinguish them from closings both databases
agreed on. The Vault states the proportion once above the list and offers
"checked against both databases" as a filter; a picture with no TMDB
record says so in full on its own page. It was briefly a per-row badge
reading "Wikidata alone", which at two rows in five was a column rather
than an exception and was read as meaning the opposite — that Wikidata
had been signal enough not to look further. The fact travels
as `unverified` on each closing and as bit 4 of the packed flags byte —
bits 4 and 5 were named in the manifest from the start and written by
nothing until 3 August, so any reader of a corpus older than format 6 will
see both bits clear and must read that as "not stated" rather than as
"tested".

## What this cannot know

Below-the-line crew — grips, gaffers, second unit — are in no free
database. Cast lists are routinely a fraction of the real cast. A page can
show a picture wrapped while somebody who worked on it, and was never
entered anywhere, is alive.

Nothing in this document fixes that. The guards exist to keep us from
adding *avoidable* errors on top of it, and the unknown count exists so
that the size of the gap is visible rather than hidden.
