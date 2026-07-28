# How we decide a picture has wrapped

Plain prose, start to finish. No code. It is written to be held against
the code and found wrong, so every claim here is meant to be checkable.

Last audited against the code on 28 July 2026. The audit found nine
errors in the previous version of this file; they are corrected below.

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

Separately, 113 entries have no TMDB id. They were tested by Wikidata
alone, because there was nothing to ask TMDB about, and nothing on the
page distinguishes them from entries both databases agreed on.

## What this cannot know

Below-the-line crew — grips, gaffers, second unit — are in no free
database. Cast lists are routinely a fraction of the real cast. A page can
show a picture wrapped while somebody who worked on it, and was never
entered anywhere, is alive.

Nothing in this document fixes that. The guards exist to keep us from
adding *avoidable* errors on top of it, and the unknown count exists so
that the size of the gap is visible rather than hidden.
