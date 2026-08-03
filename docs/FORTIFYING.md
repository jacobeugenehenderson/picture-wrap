# Fortifying the Vault

*Written 29 July 2026, after the frontier scan reached 1900–2026. A brief,
not a plan: the measurements are real, the design is a proposal.*

The goal is a dataset somebody could cite in a paper and defend. Not
paywalled, not gated — just reliable enough that a claim resting on it
holds up when someone checks.

The Vault is already strong on **method** and weak on **memory**, and it
drops the evidence it was handed on the way in. Everything needed to judge
a claim *today* is documented: the three
states, what the coverage is, the cast floor, the below-the-line gap. What
it cannot answer is **"what did this say on the day I cited it, and why
did it change?"**

That is the whole of what follows.

---

## The four gaps

*Gap 1 was built on 3 August 2026 and gap 2 was half-built the same day;
both are marked below. Gaps 3 and 4 remain open.*

### 1. Nothing records a removal — BUILT, 3 August 2026

*This was the highest-value item on this page for five days. It is done,
and the shape it took differs from the one proposed here in one way worth
recording.*

**The problem.** `recheck.js` printed reopened pictures to the console and
deleted them. 278 went in one pass, 65 in another, and neither left a
trace. If someone cited *Cats' Play* and it later reopened on Gyöngyi
Bürös, there was no way for them to find that out and no way for us to
reconstruct it.

**What was built.** Two files, both in `pass/` rather than in the
published tree, because `dist/` is deleted and rebuilt on every run and a
record a rebuild can erase is not a record.

- `pass/published.json` — the roll: every picture currently published and
  the date it first appeared. This is the part the proposal above missed.
  "When did it enter" cannot be reconstructed after the fact from
  anything, so it has to be written down as it happens, and without it a
  retraction can say what was withdrawn but not how long the claim stood.
- `pass/removed.jsonl` — the ledger: one line per departure, carrying what
  was published, when it entered, when it left, the verdict that replaced
  it, and who was found living.

`build-corpus.js` diffs the two on every build and publishes the ledger
into the corpus as `removed.json`, so the retraction travels with the
thing it retracts. A film page states it above the roster.

**It opened with 138 entries rather than empty**, seeded by
`seed-removals.js` from a snapshot taken before the 3 August repair. An
empty record published on the day of the largest retraction this archive
has made would have read as *nothing has ever been retracted*, which is
the precise false impression the record exists to prevent.

**Seeded lines carry `entered: null` and keep it.** Those pictures were
published across many builds before any roll existed and the day each
first appeared is not recoverable. A retraction that guesses when the
claim began is worse than one that says it does not know, and the page
says it in those words.

**What is still missing.** `recheck.js` was never wired to the ledger —
departures are detected at build time by diffing, which catches everything
but attributes nothing to the run that caused it. And there is no page
listing retractions; they are reachable from the picture, which is the
case that matters, and not browsable.

### 2. An entry does not say when it was checked

`wrapped` is the *death* date, not the verification date. So an entry
confirmed this morning under the fixed logic is indistinguishable from one
filed in March under the broken one.

**Fix.** `checkedAt`, and `checkedBy: "both" | "wikidata-only"`. That lets
a researcher filter to *entries confirmed against both databases since
28 July*, which is a materially different and much stronger dataset than
*everything*.

**Related — DONE, 3 August.** `unverified` was a stored flag that
undercounted, because it postdated most of the archive. It is now derived
from `tested` at build time, published on every closing, carried as bit 4
of the packed flags byte, and drawn in the Vault as **Wikidata alone**.
55,610 of 120,556 closings, which is 46% and was never visible before.
The half of the fix above — `checkedAt` and a `checkedBy` that survives
into the published record — is still open.

### 3. There is no version to cite

Git holds dated snapshots but nothing names one.

**Fix.** `vault/manifest.json` — date, total, counts by decade,
unverifiable count, and the year ranges the scan has covered. That makes
*"Picture Wrap Vault, 29 July 2026, 8,100 entries, coverage 1900–2026"* a
thing that exists rather than something a reader has to assemble.

### 4. The citations already exist and we throw them away

*The largest single opportunity here, and it costs almost nothing.*

Wikidata death dates carry their own references. We ask for the date and
discard the provenance, so the chain stops at us — which is exactly the
wrong place for it to stop if somebody wants to cite this.

**Measured, 29 July 2026, 40 films sampled across the whole Vault:**

| | |
|---|---|
| Deaths carrying a real source | **443 of 545 — 81%** |
| Films where every death is sourced | 5 |
| …some sourced | 34 |
| …none | 1 |

"A real source" means `stated in` a named work (`pr:P248`) or a direct
reference URL (`pr:P854`), not merely *imported from another Wikipedia*.

**What those sources are.** Across three well-documented pictures the
distribution ran: Find a Grave 59, Internet Broadway Database 47, SNAC 45,
BnF authorities 41, the German Integrated Authority File 36,
filmportal.de 23, Discogs 15, Britannica 8, IMDb 7 — plus biographical
dictionaries cited down to the article, *"Arden, Eve (30 April 1912?–12
November 1990), stage, film, radio, and television actress"*. Wikipedia as
a source was 15 references out of roughly 370.

National libraries and archival authority files, in other words. That is
citation-grade provenance and it is sitting one query away.

**The gap follows the familiar shape.** The least-sourced entries in the
sample were *Росица* (Bulgarian, 1944) at 0 of 6, *Mask* (1938) at 2 of 8,
*Cuori nella tormenta* (Italian, 1940), a Swedish picture from 1961. The
same thin non-English end that every other measurement here lands on.

**What to build.**

- **A per-entry sourcing figure**, stored beside `unknownCount` — *"33 of
  34 deaths sourced"*. It is the first quality signal we would have that
  measures the *upstream* evidence rather than our own coverage, and it
  separates a claim resting on the Bibliothèque nationale from one resting
  on nothing.
- **The sources themselves in the shards**, so anyone working from the
  dataset can trace any claim without asking us. Probably not on the page
  — a film listing forty citations is unreadable — but in the data.

**The caution that must survive into whatever we publish.** A reference is
not a verification. Find a Grave is user-contributed; some chains bottom
out in another wiki. The figure measures *whether somebody cited
something*, not whether it is true. Publishing it as a quality score
without that distinction would be dressing a proxy as a fact, which is the
error this project spent 28 July undoing.

**This now has a first concrete use, which it did not have on 29 July.**
`provenance.js` found **337 people whose death date TMDB and Wikidata
record differently**, across 1,034 published closings — see
`FINDINGS.md` §7b. Nothing has adjudicated them, deliberately: the match
is a name and a birth year, which `verify.js` says is not good enough to
date a wrap.

Whether Wikidata's side carries a reference is exactly what would settle
them, one at a time and honestly. **Where it does, correcting our date is
a repair with a citation attached; where it does not, the disagreement is
two databases guessing and should stay published as a disagreement.**
That turns the sourcing query from a quality signal into an editorial
tool, and it is the cheapest route from 337 open questions to however
many of them are actually answerable.

---

## The re-check loop, and why it is not an overnight job

The instinct is repeated full passes. The evidence says otherwise.

The pass that removed 65 entries removed them because **we** changed the
logic. Two later passes over the same 3,640 entries found **zero**. Real
drift — somebody adding a living cast member to Wikidata — is rare. A
monthly three-hour pass would spend almost all of itself confirming last
month's answer.

The expensive part is also the wrong part: `survivorsViaTmdb` does
per-person TMDB lookups, while the cheap Wikidata question is one query
per film — and it batches.

### Measured, 29 July 2026

| | |
|---|---|
| 300 films, one batched query | **1.0 second** |
| Living people found in them | 0 |
| Of those 300, edited on Wikidata since 1 July | **21 (7%)** |

A complete cheap sweep of the whole Vault is ~32 queries. **Thirty
seconds, not three hours.**

### Three tiers

**Nightly — about 30 seconds.** Batched Wikidata question over every
entry: does this film now have a credited person with no death date? This
is the drift case, it is the one that actually happens, and it is cheap
enough to run every night without thinking about it.

```sparql
SELECT ?film ?p WHERE {
  VALUES ?film { … 300 at a time … }
  VALUES ?prop { … the credit properties … }
  ?film ?prop ?p .
  FILTER NOT EXISTS { ?p wdt:P570 ?d }
}
```

**Weekly — about 15 minutes.** Full survivor test, but only on entries
Wikidata has *edited* since the last run:

```sparql
?film schema:dateModified ?when . FILTER(?when > <last run>)
```

Roughly 700 films a month rather than 9,600.

**Rarely — hours.** The full deep pass over everything. Triggered by *our
logic changing*, not by the calendar. When the code that decides changes,
everything it decided is suspect; otherwise a full pass tells you nothing
the cheap one didn't.

### The limit worth stating out loud

All of that detects **Wikidata** drift. There is no equivalent change feed
for TMDB. If TMDB adds a person to a film, or corrects a death date,
nothing cheap will notice — it surfaces only in a full pass. Do not let
the nightly sweep imply otherwise in any documentation or on the site.

---

## Where the errata file fits

It is not separate work. Whatever any tier removes gets appended to
`vault/removed.json` with its date and its reason. The loop that fortifies
the data and the loop that publishes its own retractions are the same
loop, which is the argument for building them together.

---

## What this does not need

**A server.** All three tiers are the poster doing what it already does,
and every output is a static file the site can serve.

**More scanning.** The frontier scan covers 1900–2026. Fortifying is about
what happens to a claim *after* it is made.

**A paywall.** Stated for the record because the value here is exactly the
opposite: a dataset is worth citing in proportion to how easily somebody
can check it.
