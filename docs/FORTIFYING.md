# Fortifying the Vault

*Written 29 July 2026, after the frontier scan reached 1900–2026. A brief,
not a plan: the measurements are real, the design is a proposal.*

The goal is a dataset somebody could cite in a paper and defend. Not
paywalled, not gated — just reliable enough that a claim resting on it
holds up when someone checks.

The Vault is already strong on **method** and weak on **memory**.
Everything needed to judge a claim *today* is documented: the three
states, what the coverage is, the cast floor, the below-the-line gap. What
it cannot answer is **"what did this say on the day I cited it, and why
did it change?"**

That is the whole of what follows.

---

## The three gaps

### 1. Nothing records a removal

`recheck.js` prints reopened pictures to the console and deletes them.
**278 went in one pass, 65 in another, and neither left a trace in the
data.** If someone cited *Cats' Play* and it later reopened on Gyöngyi
Bürös, there is no way for them to find that out and no way for us to
reconstruct it.

**Fix.** `vault/removed.json`, appended to by anything that drops an
entry: the id and title, when it entered the Vault, when it left, and who
was found alive. `recheck.js` already holds every one of those fields and
discards them at the end of the run.

Highest value on this page. It turns a silent deletion into a retraction
record, which is the difference between a website and a citable source.

### 2. An entry does not say when it was checked

`wrapped` is the *death* date, not the verification date. So an entry
confirmed this morning under the fixed logic is indistinguishable from one
filed in March under the broken one.

**Fix.** `checkedAt`, and `checkedBy: "both" | "wikidata-only"`. That lets
a researcher filter to *entries confirmed against both databases since
28 July*, which is a materially different and much stronger dataset than
*everything*.

**Related, and already wrong.** `unverified` is a stored flag on 368
entries, but **481** actually have no TMDB id — the flag postdates most of
the archive. Anyone filtering on it gets a wrong answer. It should be
derived from the missing id, not stored.

### 3. There is no version to cite

Git holds dated snapshots but nothing names one.

**Fix.** `vault/manifest.json` — date, total, counts by decade,
unverifiable count, and the year ranges the scan has covered. That makes
*"Picture Wrap Vault, 29 July 2026, 8,100 entries, coverage 1900–2026"* a
thing that exists rather than something a reader has to assemble.

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
