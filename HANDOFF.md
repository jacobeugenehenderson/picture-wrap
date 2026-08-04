# Handoff — 4 August 2026, before dawn

Read this before touching anything. Nothing is running. Every job this
project has is finished, audited, and deployed to both hosts.

## The one sentence

**The archive stopped claiming things it could not support, and then it
started checking itself.** Closings went 97,395 → 95,567 across five rule
changes, every one of them moving pictures *out* of the Vault and none
into *dead*. Then the two surfaces that had never been checked against
each other — the corpus and the film page — were made to agree on all
260,112 pictures where the comparison is possible.

Two rules moved from *asserted* to *reproduced* in one night: 34 and 27.

## Where things stand

| | |
|---|---|
| **The corpus** | 137 release years, 329,957 pictures — **95,567 closed**, **16,201 unclassified**, 216,816 running, 1,373 unchecked |
| Audit | **137 years, 0 failures** — and it is a real check now; on 3 August it was silently failing 123 of them |
| Pages checked | **both pages, 260,112 of 260,112 agree** with the corpus on identical people — canon rule 27, `check-pages.js`, exits zero |
| Built | `dist/`, version `50ed51ad6729`, gitignored |
| **Corpus hosted** | Cloudflare Pages, `picture-wrap-corpus`, at `https://picture-wrap-corpus.pages.dev/` |
| **Site hosted** | GitHub Pages from `main`, at picture-wrap.com. **Two hosts** |
| Live site | current with `main`, `?v=107`, modules `?v=60` |
| Verified | 57,810 closings (60%) checked against both databases; 37,765 (40%) against Wikidata alone |
| The closer | 94,743 closings name one; **7,069 (7%) rest on a date only TMDB records** |
| Undated | 5,968 closings carry no day-precise death |
| Disputed | 927 closings where two sources give different dates, published with the disagreement |
| Evidence | 1.8 GB in `pass/`; durable copy 149 MB at `~/Desktop/picture-wrap-evidence`, **re-sealed and in agreement** |
| Licence | corpus **CC0**, code **MIT** |
| Bluesky | 26 posts; 37 entries survive |

## What happened on 4 August

Five rule changes, and the thread through all of them is the same: a
claim was resting on something that did not support it.

**The audit was broken and said it was fine.** `audit.js` had its own
verdict branch that predated the third state, so it re-derived *closed*
for all 23,583 unclassified pictures and reported **123 of 137 years as
unreproducible** — while this file recorded "137 years, 0 failures",
because nobody had re-run it. The corpus was right and the checker was
wrong, which is the worse direction: a check that cries wolf stops being
read. Everything below was only safe to attempt because this was fixed
first.

**The verdict existed four times.** Anyone living holds a picture open,
nobody recorded dead leaves it unclassified, the rest have closed —
written out in `judge.js`, `rebuild.js`, `audit.js` and `app.js`, and
wrong in one of them. Now `verdictFor` in `verify.js`, called by all four.
Canon rule 35. `verify.js` existed to prevent exactly this and did not,
because what was shared were the *parts* of the rule and not the rule.

**A birth year is enough to hold a picture open.** *The Squeaking Shoes*
(2004) was listed as wrapped while its own page showed two men born 1956,
recorded nowhere as dead. Rule 4 demanded a day-precise birth date before
anyone could be called living — precision to hold a picture OPEN, and none
to let it CLOSE, which is the only claim here that can be wrong about a
living person. 3,132 closings rested on somebody it had silenced.

**…but a lone imprecise TMDB date places nobody.** Removing that rule went
too far: *Mildred Pierce* reopened on Bill Alcorn, "Soldier (uncredited)",
existing as `1920-01-01` in TMDB and nowhere else, at a notional 106. The
line is neither precision nor nothing — a Wikidata item at year precision
is somebody catalogued as a person; `1920-01-01` from TMDB is a year in a
date-shaped field.

**Uncredited people vote on nothing, in either direction.** TMDB lists
everyone who appeared; this archive is about people *credited*. They no
longer hold a picture open and no longer date its wrap. *Intolerance*
(1916) was closed on Peggy Cartwright, "Little Girl (uncredited)"; it now
closes on **Lillian Gish, 1993**. *Some Like It Hot* closes on **Nehemiah
Persoff, 2022**. Applying it to the whole corpus needed a three-hour
re-fetch of 44,424 pictures, because `role` was only stored for years
passed after that field existed.

**Fifteen death dates corrected, three rejected.** The first time anything
here has overwritten a date on evidence other than its own pass. The
rejections are the more interesting half — see *The corrections*.

**And then rule 27 stopped being asserted.** It was the only rule whose
subject was the code rather than the data: the film page applies the rules
itself, in the browser, in a second implementation nothing reached. It had
drifted three times.

The backlog proposed sampling against live Wikidata and explaining the
differences away — a test that cannot separate drift in our code from a
credit added last Tuesday. So the question was narrowed until it had an
exact answer: **given the same people, do the two implementations reach
the same verdict?** The page's classifier moved into `verify.js` as
`classifyRoster`, and `poster/check-pages.js` feeds it the corpus's own
evidence. Offline, complete rather than sampled.

It found 500 disagreements and all of them were the page's fault:

- **161** — the page read 113-to-122-year-olds as living. `statusOf` calls
  that band *unknown*; the page excluded only people past 122, so somebody
  aged 115 vetoed a picture the corpus had closed.
- **339** — the film page could not draw a wrap without a date, and that
  took three fixes because the same error had been made at three depths.
  `wrapped` was `!!wrapDate`. An emptied roster claimed nobody was
  credited. And `beyond` was read as "we cannot say" when rule 8 says
  *dead*. Every one of them was **deriving what something MEANS from how
  it is DISPLAYED**.

260,112 of 260,112 now agree, and the checker exits zero so it can gate a
deploy. What it cannot see is whether the page's live query gathers the
same people the pass did — rule 27's irreducible half.

### And on the site

- **Licences**: the terms this project operates under are downloaded and
  kept in `licences/`. The corpus is CC0, the code MIT, and Methods says
  so instead of saying nothing has been decided.
- **The TMDB logo** is in the colophon, closing the required notice
  rather than sitting above it as a badge.
- **Link previews**: `og:`/`twitter:` tags and `card.png` — a pasted link
  draws a real card now. Site-wide only.
- **The share message** reports what the page counted: *"One of the 54
  people who made Mildred Pierce (1945) is still living."*
- **Privacy** says how many, not who — and discloses that the browser asks
  Wikidata directly, so a search term goes to them rather than to us.
- **The unclassified rows** went from 72px to 31px: `.closing-missing` had
  been written into `app.js` and never given a CSS rule.
- **All / Confirmed** leads the Vault's filters instead of closing them.
- **Browsing tiles fold renamed states** — Weimar Republic, Nazi Germany
  and East German become German — while dissolved ones do not, because
  folding Soviet into Russian would pick one successor and erase others.

## Redeploying

**Two hosts, and both must move.**

```
node poster/build-corpus.js
npx wrangler pages deploy dist --project-name picture-wrap-corpus --branch main
git push origin main          # the site; GitHub Pages serves from main
```

**Bump both `?v=` in `index.html`** whenever `app.js` or `style.css`
changes, and the module `?v=` at the top of `app.js` whenever `verify.js`,
`shared.js` or `corpus.js` changes. They stand at **104** and **58**.

**The version digest now covers the tile-folding table too**, because
`summary.json` lives inside the immutable tree and a change to the chip
row would otherwise move no URL.

## The order things must run in, which nothing enforces

Three deep now, and every layer was learned by breaking it:

```
retest.js        (network — re-judges, and DROPS corroboration)
  provenance.js  (network — re-corroborates)
    rebuild.js   (offline — re-derives verdicts from evidence)
      audit.js       (offline — does the corpus reproduce itself?)
      check-pages.js (offline — does the film page agree with it?)
        build-corpus.js
          archive-pass.js   (re-seals the durable copy)
```

The two checks answer different questions and both exit non-zero on
failure. `audit.js` asks whether the corpus can be re-derived from its own
evidence; `check-pages.js` asks whether the browser would reach the same
verdict from the same people. Neither subsumes the other, and the second
only exists because the first cannot reach the browser.

**`retest.js` wipes what `provenance.js` did.** Corroboration is an
annotation the judgement knows nothing about, so re-judging rebuilds a
picture's people from scratch and drops it. Tonight's retest took 19,614
corroborations down to 1,024 and **nothing failed, no audit caught it** —
it was found because a figure gathered for this handoff disagreed with a
figure in the docs. Re-running provenance put it back to 19,679, and the
closer dated by TMDB alone went from 25,509 (27%) back to 7,069 (7%).

**`rebuild.js` re-derives; it must not be asked to remember.** Six bugs
today were one shape — something stored being carried through instead of
re-derived: `p.status`, `datesAWrap` twice (the decision path and the
evidence-write path are different arrays), the `reason`, one-way
reopening, and tested opens wrongly exempted. If a value is a function of
a date, and the date can move, re-derive it.

## The corrections

`pass/date-corrections.tsv` holds 15 applied;
`pass/date-corrections-rejected.tsv` holds 3 with reasons. Applied by
`poster/correct-dates.js`, which is deliberately not automatic.

**The rejections are the lesson.** `provenance-disputes.tsv` matches on a
name and a birth YEAR, which manufactures disputes out of two people who
share both. Paul J. Smith: Q3371503 is the animator, born 1906-03-15,
died 1980; ours is the Disney composer, born 1906-10-30, died 1985-01-25.
Nothing was wrong. There were two men, and acting on that row would have
replaced a correct date with a stranger's.

So the disputes file now carries **the Wikidata birth date and how far it
is from ours**, and Paul J. Smith reads *"229 days apart — CHECK, may be
two people."* 314 people remain disputed:

| | |
|---|---|
| 256 | exact birth date — one person, two death dates. Real |
| 23 | within a week — one person |
| **21** | **more than a week apart — may be two people** |
| 14 | one side records only a year — thin |

## What to do next, in order

1. **The per-picture link previews — read `docs/HOSTING.md` first.**
   Previews work; the exception is that every card is the front-page card.
   It is **not** a hosting job: hash routing means a crawler never sends
   the id to any server, so path routing is the prerequisite and it
   touches no infrastructure. The brief has the three options, the DNS
   inventory, and the mail-forwarding hazard that comes with a nameserver
   move. Do the routing first; the hosting can wait for an unhurried hour.

2. ~~The person page has no checker.~~ **Done.** It needed an extraction
   rather than a checker, as expected: `readPeople` was dropping every
   credit with no dates, which is why it needed a `credited` count and why
   rules 6 and 7 could not be expressed there. `creditRows` in `shared.js`
   keeps them, and `wikidataClosed` collapsed to one call. Both pages now
   read the same code and both check clean.

   **Every surface that has ever drifted is now checked.** What remains
   unreachable is whether a page's live query gathers the same people the
   pass did, and no offline test can answer that.

3. **The 256 real disputes**, if you want them — 314 people, of which 256
   share an exact birth date with the Wikidata item and are therefore one
   person with two recorded deaths. The tooling exists now: pull the
   references, tier them by whether the source is a register or another
   user-edited site, check the birth date, and feed
   `pass/date-corrections.tsv`. Fifteen went through it tonight and three
   were rejected as different people.

4. **`vault/` is down to `suppressed.json`**, which stays — `app.js:1449`
   fetches it on every page load. `archive.json` stays too: it is the
   poster's record of what it *posted*, and the corpus does not hold that.

Then the Desk, still the largest thing not built on the posting side.

## The machinery

| file | what it does |
|---|---|
| `poster/pass.js` | one release year, judged, with the working written down |
| `poster/judge.js` | the judgement itself, shared by the pass and the repairs |
| `poster/audit.js` | re-decides a year from its own files, network unplugged |
| `poster/rebuild.js` | re-derives conclusions from stored evidence, offline |
| `poster/retest.js` | repairs verdicts that predate a rule change; needs the network |
| `poster/provenance.js` | asks Wikidata whether it holds a death we took from TMDB |
| `poster/correct-dates.js` | applies reviewed date corrections. **The only path that overwrites a date from outside our own pass** |
| `poster/archive-pass.js` | re-seals finished years into the durable archive; offline |
| `poster/dedupe.js` | collapses pictures a year's files hold more than once; offline |
| `poster/enrich.js` | genre, country and fame per year |
| `poster/build-corpus.js` | pass output → static sharded files + `manifest.json` |
| `corpus.js` | the browser client for those files |
| `verify.js` | the single judgement, imported by the site, the poster and the pass |
| `poster/check-pages.js` | does the film page agree with the corpus? Offline, canon rule 27 |
| `make-card.py` | draws `card.png`, the link preview |

## Reproducing from what is on disk

```
node poster/dedupe.js  --years 1890-2026    # offline, idempotent
node poster/rebuild.js --years 1890-2026    # offline, minutes
node poster/enrich.js  --countries          # the label dictionary
node poster/build-corpus.js                 # → dist/
```

## Known and unfixed

- **Rule 27's other half is unreachable offline.** Both pages gather their
  own people live from Wikidata. `check-pages.js` proves they draw the
  same conclusions from the same people; nothing can prove they were
  handed the same people.
- **37,765 closings (40%) rest on Wikidata alone**, almost all because the
  picture has no TMDB record. A floor, not a bug.
- **7,069 closings rest on a date only TMDB recorded**, and 832 name no
  closer at all.
- **404,494 TMDB-sourced people still have no stored role**, so the
  uncredited rule cannot be applied to them offline. They sit in pictures
  where the answer cannot change; if that stops being true, `retest.js`
  selects on exactly this.
- **`pass/removed.jsonl` holds the departures and nothing reads it.**
  `build-corpus.js` publishes 3,087 as `removed.json`; the site does not
  fetch it. Deliberate — a page about what the archive got wrong answers a
  question about the archive, not about film.
- **Old corpus versions are not retained.** A Pages deploy replaces the
  origin, so a reader holding a manifest less than five minutes old can
  404 until it revalidates.
- **Nothing lints CSS.**
- **Nothing is scheduled.** Cron is blocked by TCC under `~/Desktop`.

## Everything else

`README.md` indexes the documents. `VERIFICATION.md` is how a wrap is
decided, and its canon — **36 rules** — is the list to check any change
against; the prose after it carries the full account of today.
`METHOD.md` is the citable version and **its figures predate 4 August**,
which it says at the top. `SOURCES.md` is what is accessed, collected and
published, including the two TMDB clauses read in full on the 3rd.
`FINDINGS.md` is what the archive says rather than how it works.
`BACKLOG.md` holds the open work. `licences/` holds the terms themselves.
