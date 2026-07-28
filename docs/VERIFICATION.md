# How we decide a picture has wrapped

Plain prose, start to finish. No code. It is written to be held against
the code and found wrong, so every claim here is meant to be checkable.

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
declared wrapped over them. That is a deliberate choice, and it is the
main way this system can still be wrong.

## How a picture comes up for consideration

Three routes, all of which end in the same test.

**The sweep** is the ordinary one. We ask Wikidata for everyone who died
in the last few days and has a screen credit. For each of them we ask,
from the film's side, which of their pictures now have nobody living —
meaning Wikidata holds no credited person on that film without a death
date. Anything that comes back is a candidate.

**The backfill** handles pictures that closed before any of this existed,
where there is no future death to react to. Asking the question directly
for a whole year times out, so it goes in two stages: a cheap per-year
rollup that counts credited cast against dead cast and keeps the films
where those match, then the exact, crew-inclusive test on each survivor of
that filter.

**The watcher** listens to newsrooms on Bluesky. When one reports a death
it resolves the name and asks whether that person closes anything. It runs
ahead of Wikidata, because the wrap test does not need the new death date
— everyone else on the picture is already recorded. What it produces is
marked provisional.

## Two filters before we ask the expensive question

A candidate is dropped if the film has **no name in any language** we
asked for, because there is nothing to publish.

A candidate is dropped if Wikidata records **fewer than a floor number of
cast members**. This is editorial, not logical. Without it, a wide sweep
queued hundreds of films with nobody but a director on record —
documentaries and concert films that "closed" the moment one person died.
Nothing false would have been published, because a post states its own
basis, but a queue that long is a queue nobody reads, and the protection
here is that a human reads it.

## The survivor test

This is the heart of it. Wikidata thinks everyone is dead; we now ask
whether Wikidata knew the whole cast.

**We need a TMDB id for the film.** Without one, the test cannot run and
returns no objection. This is worth sitting with: the test can only ever
raise its hand. Silence from it is not agreement, it is absence. Around a
hundred entries in the Vault have no TMDB id and have therefore never been
tested by anything except Wikidata's own view of itself.

Given an id, we ask TMDB for the film's full credits, cast and crew. Then
we set aside everyone TMDB names who is *already linked from the film's
own Wikidata item*, because Wikidata's test has covered those people
already. What is left is the interesting set: people TMDB credits on this
picture whom Wikidata did not connect to it.

For each of them we ask three questions in order.

**First, does Wikidata know this person by their TMDB id?** If it does, we
take their birth date, how precise that birth date is, and their death
date if any. If *two or more* Wikidata items claim the same TMDB id, we
discard all of them and treat the person as unknown to Wikidata. Two items
claiming one identifier is a contradiction, not a source, and picking one
would mean picking whichever the query service happened to return first.

**Second, what does TMDB itself hold?** We ask this for everyone Wikidata
has not buried — which is a wider group than "everyone Wikidata has never
heard of". A Wikidata item with no death date is not a living person; it
is a person nobody has recorded the death of, and TMDB may well hold that
death date. Skipping this step was how a man who died in 1992 spent months
vetoing a picture.

Now we decide, using both records together.

- Either database gives a death date → **dead**.
- Neither gives a birth date → **unknown**.
- The only birth date is imprecise and uncorroborated → **unknown**.
- The birth date puts them past the oldest age we will credit → **unknown**.
- Otherwise → **alive**.

**Third, for anyone still standing, we ask Wikidata by name.** Some people
Wikidata knows perfectly well are not linked to their TMDB id, so the
first question missed them. We look for a person with exactly that name,
who is a human, whose birth year matches exactly. If exactly one such
person exists and they have a death date, they are dead. If several match,
that is ambiguity and we change nothing.

The test returns two things: the names of everyone found alive, and a
count of the unknowns. **Any name in the alive list stops the picture.**
The unknown count is recorded alongside the entry, and stops nothing.

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
is printed so the evidence can be opened and read. There is a flag to file
a queue into the archive without posting any of it, used for backfilled
history, which is a bulk import rather than news.

**Filing does not re-test anything.** Whatever the queue believed when the
picture was found is what goes into the archive. If the logic has changed
in between, the archive inherits the older judgement. This has bitten us.

## Re-checking

Pictures can un-wrap. Somebody adds a living cast member to Wikidata and
an entry that was true when filed stops being true.

The re-check walks the whole archive and asks two questions of each entry.
First, straight to Wikidata: does this film have any credited person with
no death date? If the query fails we mark the entry unchecked and move on
— a failed query is not a verdict. If it returns anyone, the picture
reopens.

Second, if the film has a TMDB id, the full survivor test above. If it has
no TMDB id, the entry is marked unchecked. It stays in the archive, but it
is not counted as verified, because nothing verified it.

Anything that reopens is removed, and its id is cleared from the record of
films already considered, so a future sweep can find it again.

## What we have actually asked about

Everything above describes how the question is answered. It says nothing
about which pictures have been asked, and those are different facts.

The Vault is not "every picture that has wrapped". It is every picture we
have got around to asking about, and that set has a shape:

- **The backfill has been run over 1930 to 1945, and nowhere else.** That
  is 98.6% of the Vault.
- **The sweep has caught what has closed since the poster started
  running.** That is the rest — a few dozen entries, mostly post-war,
  each one a real death that happened while we were watching.

The join between those two is not a gradient, it is a cliff. There are
230 entries released in 1945 and **two** released in 1946. Nothing changed
about cinema in 1946; that is simply where the range we typed stopped.

This matters most on a person's page, where a career crosses the boundary
and the archive does not. Of ten people sampled out of the Vault, only
27% of their closed-looking films had an answer recorded. The ones from
the 1930s and 40s came out at 30–100%. Doris Day came out at 4%.

So a picture missing from the Vault means one of two things, and the
Vault cannot tell you which: it was asked about and someone was alive, or
it was never asked. Only the first is a finding.

There is nothing clever to do about this. The cliff goes away by running
the backfill over more years, and not otherwise.

Separately, around a hundred entries have no TMDB id. They were tested by
Wikidata alone, because there was nothing to ask TMDB about. They sit in
the Vault alongside entries that both databases agreed on, and nothing on
the page distinguishes them.

## What this cannot know

Below-the-line crew — grips, gaffers, second unit — are in no free
database. Cast lists are routinely a fraction of the real cast. A page can
show a picture wrapped while somebody who worked on it, and was never
entered anywhere, is alive.

Nothing in this document fixes that. The guards exist to keep us from
adding *avoidable* errors on top of it, and the unknown count exists so
that the size of the gap is visible rather than hidden.
