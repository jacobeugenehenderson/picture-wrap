# Sources, and what is done with them

What this project reads, what it keeps, how it treats what it keeps, and
how to cite it. Written to be the answer to four different questions asked
by four different people: a reader who wants to know where a claim came
from, a researcher who wants to use the archive, someone who appears in it
and would rather not, and a lawyer.

Nothing here is legal advice, and the open questions at the end are marked
as open rather than answered.

---

## 1. What is read

### Wikidata

The primary source. Everything about who made a picture and when they
died comes from here.

| what | property |
|---|---|
| the picture | `P31` class, `P577` release date, `P495` country, `P136` genre |
| its people | `P161` cast, `P725` voice, `P57` director, `P58` writer, `P344` cinematography, `P86` music, `P162` producer, `P1040` editor, `P2554` production design, `P4805` costume design |
| a person | `P569` birth, `P570` death, `P18` image, `P106` occupation |
| cross-reference | `P4947` TMDB film id, `P4983` TMDB series id, `P4985` TMDB person id |

Accessed through the public SPARQL endpoint at `query.wikidata.org`, with
a User-Agent naming the project, a URL and a contact address, and a hard
cap of four queries in flight per process. Wikidata's content is CC0.

### TMDB

A second opinion, and only that. Wikidata's cast lists are often a
fraction of the real credits — *The Young Lions* has 19 of 76 — so TMDB is
asked who else was on a picture, and those people are then resolved back
against Wikidata by `P4985`.

| endpoint | fields used |
|---|---|
| `/movie/{id}/credits` | `cast[].id`, `name`, `character`; `crew[].id`, `name`, `job` |
| `/tv/{id}/aggregate_credits` | the same, through `roles[]` and `jobs[]` |
| `/person/{id}` | `name`, `birthday`, `deathday` |

No images, no synopses, no ratings, no titles beyond what a credit
carries. The attribution TMDB asks for — *"this product uses the TMDB API
but is not endorsed or certified by TMDB"* — is displayed in the site's
colophon.

### Wikimedia Commons

Portraits, by way of `P18`, served as thumbnails from Commons. Licences
vary by file and are held at Commons; nothing is re-hosted.

---

## 2. What is kept

Three artefacts, and they are kept for different lengths of time and
different reasons.

**The Vault** (`vault/*.json`, published). One record per closed picture:
title, year, country, genre, the date it closed, who was the last of its
makers, how many people were on record, how many were unaccounted for.

**The evidence** (`pass/`, ~2 GB, **not published**). Every
person judged on every picture, with the birth and death dates used, the
precision of each, which database each came from, and the verdict reached.
This exists so that a conclusion can be checked, and so that a change of
rule is a re-decision rather than a re-fetch.

**The person table** (`pass/people/`). One row per human: name, Wikidata
id, TMDB id, birth, death, and when we last looked. Roughly a million rows
at full corpus.

### This includes personal data about living people

Stated plainly because it is easy to forget while thinking about films:
the archive holds names and birth dates of people who are alive, and its
central question is whether they are. Every field is copied from a public
database and none of it is inferred about private life — but a collection
assembled around mortality is not the same object as the databases it was
assembled from, and the ethics of that are in `DECISIONS.md` under *The
door held open*. The short form:

- A living person appears as a credit on a picture, never as an entry in
  a list. There is no ranked list of last survivors and there will not be
  one.
- Living people are never sorted by age or by proximity to anything.
- Private individuals are not aggregated. A public record — a Wikipedia
  article — is the line.
- Corrections belong upstream. Every page links to the Wikidata item,
  because that is where a fix helps everybody rather than only us.

### Asking not to be named

`vault/suppressed.json` is a list of Wikidata ids, empty today, honoured
by the site and by the pass. Add an id and the name disappears from the
page, from the evidence and from the person table on the next run.

**It takes the name and never the vote.** Removing a living person
outright would change what the archive claims — a living maker is what
holds a picture open, so deleting one silently closes a picture that has
not closed. That is a false claim about a film and an erasure of the
person's work in the same move. So the row stays, holds its place, and
says only that somebody is there.

We expect this to be used approximately never. Every fact here is already
published by Wikidata and by IMDb, and screen credits are a matter of
public record. What is ours is not the data but the **inference**: no
source says *this person is the last living link to The Wizard of Oz* —
that sentence is assembled here. That is the thing a person could
reasonably object to, and it is the same thing that made a ranked list of
survivors unpublishable. The mechanism exists because the answer to such a
request should be a one-line commit rather than an afternoon's argument at
a bad moment.

---

## 3. How the data is treated in the code

**One judgement, in one file.** `verify.js` decides who is alive, dead or
unknown, and both the site and the poster import it. Three copies of that
logic have existed and each kept a bug after the original was fixed.

**Nothing is inferred into "dead" except arithmetic.** A recorded death,
or an age past the longest documented human life. Silence is never an
answer, and a lookup that failed is never read as a finding.

**Dates are validated at the boundary, not trusted.** Wikidata's are
sliced and their precision read; TMDB's go through the same normaliser —
they did not, and `"7-9-1980"` reached a published wrap date before
anybody noticed. A value's validation has to match what the value is
*used for*, and that changes: TMDB dates were a checker's opinion for a
year and became a printed claim in an afternoon.

**Strings from either source are escaped where they land.** Names and
character names reach the DOM only through `esc()`. Names reach a SPARQL
literal only after quotes, backslashes and control characters are
rejected, because TMDB's names are typed by members of the public.

**The archive records what it set aside.** A person who could not have
worked on a picture, or whom Wikidata buried under a name match, stays in
the evidence with a flag. The record should show that we saw somebody and
decided, not silently lose them.

---

## 4. What is not collected

No analytics. No cookies. No accounts. No logs of who read what — the site
is static files on a CDN and there is no server to log anything. Nothing
is collected about readers at all, which is why this document is entirely
about other people's data rather than yours.

---

## 5. Citing this

Every claim in the archive resolves to three things: a Wikidata item for
the picture, a Wikidata item for each person, and a date with a stated
precision. A citation should carry the picture's Q-id and the date the
archive was consulted, because the underlying databases change:

> Picture Wrap, "The Sawdust Trail" (Q18153746), wrapped 5 October 1974.
> Consulted 1 August 2026. Derived from Wikidata and TMDB.

Each work record carries `checkedAt` and the rule versions that produced
it, so an answer can be dated to the rules that made it. `METHOD.md` is
the procedure in full, written to be quoted.

The honest limits, which any citation of this work should carry with it:

- **"Everyone" means everyone recorded.** Below-the-line crew is in no
  free database. There are pictures called closed that still have someone
  living who was there.
- **Roughly one closing in ten has no day-precise date**, and about half
  of those have no recorded death at all — they are closed by arithmetic.
- **Coverage is uneven and measurable.** A third of sampled entries rest
  on under half of TMDB's credit list; every record carries its own
  `coverage`, and the thin ones say so.
- **The corpus is what Wikidata holds**, which is overwhelmingly American
  and European: 9,948 American pictures released 1930–45 against 410
  Japanese.
- **Country is the state that existed at the time.** A search under a
  modern name misses everything before it — 895 of the period's South
  Asian pictures are filed under *British Raj* and 33 under *India*, and
  this project cited the second figure alone for months.

---

## 6. Open questions

Marked open because they are decisions, not oversights.

1. **Answered on 3 August 2026: CC0 for the corpus, MIT for the code.**
   `LICENSE-CORPUS` carries the dedication and the reasoning; `LICENSE`
   carries the software. The citation format in §11 of Methods is
   requested rather than required.

   The TMDB conflict is real and is decided rather than dissolved. Their
   terms forbid commercial use, derivatives and AI training; CC0 grants
   all three. The reasoning is that a death date is a fact, TMDB claims no
   copyright in it, and a contractual restriction binds the party who
   agreed to it — this project — rather than anyone downstream. So the
   exposure is a revoked key, not a claim against a reuser. Entry 2 below
   is what made this defensible rather than merely arguable: TMDB-only
   dates are about 8% of closings, not 27%.

   **Two clauses read in full on 3 August that the earlier summary
   missed.** §1.D: if the licence ends, we must "promptly delete or
   otherwise purge all TMDB Content, **including any cached content**" —
   which reaches published `v/` shards on the CDN, not only local files.
   And §2.A lists a "destination website... or interactive query-response
   system" among its examples of *commercial* use. This site is a
   destination website. It is read as aimed at revenue, since the clause
   sits inside the commercial-use section and picture-wrap.com charges
   nothing, carries no advertising and earns nothing — but it is the
   sharpest sentence in the terms for this project and it should be
   re-read if that ever changes.

   The terms themselves are now kept in `licences/`, as downloaded.
2. **Answered on 2 August.** A quarter of the corpus cited TMDB where
   Wikidata held the same fact, because the pass stops asking once TMDB
   answers *dead*. `poster/provenance.js` asked: 19,614 closings are now
   corroborated by Wikidata recording the identical date, and TMDB-only
   dates fell from about 27% of closings to about 8%. No verdict or wrap
   date moved, and all 137 years still audit clean. What it exposed —
   1,207 closings where the two sources disagree, 216 of them on the
   year — is open and recorded in `BACKLOG.md`.
3. **How long the person table keeps someone we have decided is dead.**
   Indefinitely today, because that is what makes the next pass cheap.
   TMDB's six-month caching limit bears directly on this, and periodic
   re-scanning answers it only if the re-scan refreshes stored values and
   old published corpus versions are expired rather than merely
   supersedable.

Two questions that were open and are now answered:

**The evidence is not published.** It is a working artefact, roughly two
gigabytes, a large part of it TMDB-derived person data whose
redistribution at that scale we have not established a right to. Access
can be arranged on request for research, preservation or journalism — a
named person, a stated purpose. Publishing it wholesale buys checkability
we can provide another way; the per-picture basis is on the page, and
`METHOD.md` is the procedure in full.

**A person can ask not to be named**, and the mechanism is above rather
than promised.
