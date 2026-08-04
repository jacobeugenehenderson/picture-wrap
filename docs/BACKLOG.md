# Backlog

Things deferred deliberately, with enough context to pick them up cold.
Roughly in the order they're worth doing.

---

## Making the Vault citable

**See [FORTIFYING.md](FORTIFYING.md).** Three gaps, in order: nothing
records a removal, an entry does not say when it was checked, and there is
no version to cite. Plus the re-check loop, which is thirty seconds a
night rather than three hours a month — measured, not assumed.

---

## The Desk — a place to prepare and send a post

**The largest item here, and designed but not built.** Today the flow is
`preview.js` (a static page you look at) then `review.js` (a terminal REPL
you type into), and the split is the problem: you judge the images in one
place and write the words in another, blind.

**Prep and send in one place.** A local web app — `poster/desk.js` on
127.0.0.1 with a random token, its client in `poster/desk/`, zero new
dependencies, `node:http` and native ES modules. Rehearsal mode by
default, so a tool that can publish starts unable to; `--live` to arm it.
Idle exit, because a browser tab holding a posting capability is more
dangerous than a terminal — a tab persists for days and a stray click has
no `readline` in front of it.

**It posts. That is the point.** The alternative is drafting in the desk
and approving again in the terminal, where you cannot see the images you
just spent five minutes judging. That is not two gates; it is one gate and
a ritual, and rituals carrying no information are how gates stop being
read. The safety property is not "review.js is the only file" — it is
*one human approves one post at a time having seen the evidence*, and the
desk does that better than the terminal ever has.

Friction added back on purpose: an endpoint that publishes exactly one
group and has no bulk form, arm-then-send, and the browser echoing back
the exact text and alt strings it displayed so the server can refuse a
mismatch. What was seen is what was posted, checked rather than hoped.

**Three extractions worth doing whether or not the desk is ever built:**

- `poster/publish.js` — the single publish-and-file path, called by both
  `review.js` and the desk. *(The name was briefly taken on 1 August by
  the corpus builder and given back; that file is `build-corpus.js`.)* `review.js` currently builds the archive entry
  twice in two field lists, which is why `backfilled`, `provisional` and
  `unverified` were dropped on one path.
- `poster/bluesky-text.js` — `LIMIT`, `measure`, `renderLinks`,
  `byteLength`. Pure and browser-safe, so the composer's counter and the
  API's check are the same function. A composer that says 298 while the
  API says 302 is untrustworthy the first time it happens.
- `poster/alt.js` — tier-1 alt text from metadata already being fetched
  and discarded. Improves the terminal path too.

**The limit is 300 graphemes, not bytes.** `Intl.Segmenter`, per
`DECISIONS.md`, deliberately reversed from an earlier byte count because
羅生門 is 3 graphemes and 9 bytes. Bytes survive only in facet offsets.
Anything measuring must keep those apart.

**`preview.js` is currently unrunnable**, incidentally: the queue holds
3,329 items in ~1,800 groups and it renders all of them with per-item API
calls and an 80ms sleep. Only 33 have a 2026 death date. Any tool must
default to the postable subset.

**Open, and the maintainer's call:** whether provisional cards should
refuse to arm until the Wikidata link is clicked (a real interlock that
becomes theatre within a week); whether the quote sits on the person post
or the pictures post; whether authored alt text is written into
`archive.json`, which the browser downloads whole; and whether
`preview.js` survives at all.

---

## Small things today turned up

- **The watcher applies neither filter.** No name check, no cast floor —
  so a newsroom report can queue a picture titled `Q12345678` with one
  credited person. `run.js` applies both; `watch.js` applies neither.
- **`state.rejected` is written and never read.** Rejection works only as
  a side effect of the seen list, which is fragile now that the seen list
  is written at a different moment. Wire it up or delete it.
- **`archive.json` and `vault/` hold the same data twice**, and both
  rewrite on every filing — about 3 MB of churn per run. Git deltas cope,
  but it is duplication with a cost.
- **Nothing checks CSS.** `npm run lint` reads JavaScript only. A grouped
  selector was deleted on 28 July and every page went full-bleed; the
  check that would have caught it is comparing the sorted set of
  selectors before and after a structural edit, which catches a lost block
  but not a wrong value.
- **Cron is blocked by TCC.** The repository lives under `~/Desktop`,
  which macOS gates, so a launchd agent cannot read even its own launcher
  — it fails at exit 127 and no permission prompt appears. Enabling it
  means Full Disk Access for `/bin/zsh`. Nothing is scheduled today; every
  run this project has done was typed.

---

## Alt text worth reading

**Priority: high, and route 1 costs FEWER requests than today.**
Currently it is a caption, not a description — both lines merely repeat
the post text, so a screen reader gets nothing the sighted reader didn't
already have in words.

`posterFor` in `lib.js` calls TMDB `/movie/{id}` and destructures
`poster_path` out of the response, discarding genres, original language,
release date and countries. `tmdbCastCount` calls `/credits` and discards
`crew`, which is where the director is. One `movieFor(tmdbId)` that
fetches once and keeps the object hands you era, genre, country and
director for nothing — and the terminal path improves even if the desk is
never built.

**What it should carry.** A sighted reader glancing at a 1945 noir poster
picks up era, genre and mood instantly: colour, shadow, typography. That
impression is what alt text can deliver and the post text can't. Not
"what is literally depicted" — describing pixels conveys nothing — but
what the image *does*.

**The rule to hold.** Never put information *only* in alt. If "this film
shaped a generation of young women" is worth saying, it belongs in the
post where everyone gets it. Alt text carrying the good version while
sighted readers get the thin one is backwards, however well meant.

**The hard limit: we cannot see the images.** No description of a poster's
visual character is derivable from Wikidata or TMDB. Routes, in order of
honesty:

1. **Build from real metadata** — director, country, genre, era, cast.
   Verifiable, no fabrication, much better than a bare title:
   *"Poster for Mildred Pierce, 1945. American film noir directed by
   Michael Curtiz, starring Joan Crawford."*
2. **Commons structured data for portraits.** `wbgetentities` on a file's
   `M`-id returns `P180` (depicts) and a caption. Often real; sometimes
   only a filename, though *"Studio publicity Ann Blyth 1952.jpg"* still
   gives era and context.
3. **A vision model reading each poster.** The only route to genuine
   visual description, and also a new dependency that invents things — on
   a project that spent its whole development removing confident
   wrongness. If used, review the output like a post, don't trust it like
   data.
4. **Hand-written**, for the few pictures that deserve it.

Falling back to *"Portrait of Ann Blyth"* beats an invented description.
Never guess at image contents.

**Related:** the site's roster portraits use `alt=""`, treating them as
decorative. Defensible — the name sits adjacent in the DOM — but it
deserves the same scrutiny.

---

## Poster art credits

Poster designers are exactly the people this project is about. Saul Bass
is remembered; whoever painted the 1952 Mexican one-sheet for *Acapulco*
is credited nowhere the film's page would show, and when they died nobody
marked it. The same silence the archive already documents, one layer up.

Sources worth investigating:

- **MoviePosterDB** — 740,000+ posters, searchable by designer, and it
  has an API at `api.movieposterdb.com`. The most promising.
- **CineMaterial** — artist and designer sections, ~13,000 posters.
- **IMP Awards** — an index of design companies, artists and
  photographers going back to 1912.
- **Posteritati** — 40,000+ originals, but a commercial gallery.

**Two constraints, both settled:**

- **It must never count toward wraps.** A poster artist isn't credited on
  the picture in the production sense, and folding them into the survivor
  test would quietly change what "wrapped" means.
- **Coverage will fail where the archive is densest.** Attribution is
  best for prestige American work and worst for the old, foreign and
  obscure — which is most of the Vault. The same shape as every other
  data problem here.

Best as its own layer: a credit line on the film page, perhaps eventually
a person page of their own.

---

## Quote-posting an obituary

When a newsroom reports a death, the closing is genuine added context —
but **quote, never reply.** A reply inserts into their thread and their
notifications; a quote sits on our own timeline. Same information, better
manners, and it doesn't become reply-guy behaviour when it happens to
every outlet that covers a death.

Mechanics are settled:

- `app.bsky.feed.searchPosts` finds candidate posts and returns the `uri`
  and `cid` a quote needs. Verified working — searching a person's name
  returned two real obituary posts with both fields.
- `app.bsky.embed.recordWithMedia` combines the quoted post **with**
  images, so quoting doesn't cost us the posters.
- `watch.js` sees the post that triggered a check and **throws its
  identity away**: `ws.onmessage` keeps `data.did` and drops the commit's
  `rkey` and `cid`, which is exactly what a quote needs. Capture it at the
  moment it arrives rather than searching for it later and hoping to
  match. (Whether `cid` is present on jetstream create events is
  unverified; the fallback is one `getPosts` call per candidate.)

**Should be a per-post choice, not automatic.** A `[q]uote` key in the
review screen that offers the candidate posts it found, or takes a pasted
URL. Automating it would produce exactly the behaviour the etiquette
concern is about.

---

## Rotating phrasings

The closing line is fixed: *"Nobody who made it is left"* for a single
picture, *"N pictures have lost the last of their company"* for several.
Read fifty times in a feed it will wear.

Wanted: a set of variants, chosen deterministically from the person's
Q-id so the same closing always renders the same way — the review screen
and the published post must never disagree.

Keep the register: plain, warm, no elegy, no adjectives doing emotional
work the facts already do.

---

## Coverage on the Vault rows

**Now worth more than it was.** `unknownCount` used to mean "people TMDB
named that Wikidata couldn't place" — a mix of the genuinely unanswerable
and the merely unlooked-up. Since the verification fix it means only the
first: people **neither** database has a birth or death date for, about
3.4 per picture.

That makes it a real confidence measure rather than a proxy for one. A
Vault row claiming a picture closed on 36% of its cast still looks
identical to one that closed on 100%.

Sharper again since 28 July: **113 entries have no TMDB id at all** and
were never tested by anything but Wikidata's own view of itself. That is
a different and worse kind of thin than a high unknown count, and nothing
on the page distinguishes either.

Either show the number, or mark the thin ones, or filter them out. The
data is already in `archive.json`, and `publishVault` in `lib.js` can
carry it into the shards for free.

Pairs naturally with the gaps page: an entry with a high `unknownCount` is
exactly an entry someone could improve.

---

## Link previews — iMessage, Slack, everywhere but Bluesky

*Raised earlier; re-diagnosed 2 August and the shape has changed. Named
for tomorrow alongside the TMDB logo.*

**There are no `og:` or `twitter:` tags on this site at all.** Not stale
ones — none. `index.html` carries a `<title>` and a `description` and
nothing else, so iMessage has no image to show and falls back to the
barest card it has. That is why the preview looks the way it does, and
it is also why the first fix is so cheap.

**Bluesky is solved** and needs nothing: posts carry the portrait and
poster directly.

### The part that is easy — DONE, 4 August 2026

The site-wide card ships: `og:` and `twitter:` tags in `index.html`, and
`card.png` at 1200×630, 25 KB, drawn by `make-card.py` rather than edited.

It is favicon.svg's composition at card scale — the gold bar full bleed,
the wordmark above it, the tagline below — because living above the bar
and gone below is the idea rather than the logo. Blowing the favicon up as
a *mark* was tried first and reads as a UI glyph; it is drawn for 16px.

**No count on it.** An earlier version read *97,395 PICTURES HAVE WRAPPED*
and filled the space better. A number baked into a committed PNG goes
stale the next time the corpus moves and nothing would catch it — the card
is not audited, not tested, and never looked at again once it works.

`og:description` is the epigraph, which is already `<meta name=
"description">` and the README's first line. Three places, one sentence.

### The part that is no longer what the old entry said

Hash routing means `picture-wrap.com/#/mildred-pierce/Q979726` never
sends the id to a server, so a per-picture card cannot come from static
metadata. The old plan — prerender one HTML file per entry and hook it to
`publishVault` — is dead twice over: `publishVault` no longer builds
anything, and the Vault has gone from 11,457 entries to **97,395**.
That many files is not something to put in a git repository or serve off
GitHub Pages.

Three live options:

1. **Move the site to Cloudflare Pages.** The corpus is already there,
   and a Pages Function can answer crawler requests with real `og:` tags
   read from the corpus while serving the app to everyone else. It also
   collapses two hosts into one and gives `picture-wrap.com` and the
   corpus a common origin, which would let CORS relax. The DNS lives at
   Namecheap and the apex currently points at GitHub Pages, so this is a
   DNS change plus a deploy, not a rewrite.
2. **Prerender the few that get shared** — the posting queue, a few
   hundred — rather than all 97,395. Cheap, and covers what actually
   circulates.
3. **Path routing instead of hash routing**, which would let a static
   prerender work per URL, but is a change to every link the project has
   ever published and should not be done for previews alone.

Option 1 is the one to weigh first, because the reason to do it is
bigger than previews.

---

## More backfill

**1946–1965 is running as of 28 July 2026** and is slower than the old
estimate: roughly 25 minutes a year, so eight to nine hours, not three.
Measured yields, candidates worth testing per year: 1945 → 323,
**1955 → 392**, 1965 → 174, 1975 → 70, 1985 → 10, 1995 → 2, 2005 → 1.

The richest ground is not where we mined first. After that:

- **1966–1985** — about an hour. Real but thinning.
- **1986–present** — forty years for perhaps a hundred candidates. Worth
  running once, not for the yield but so that "not in the Vault" starts
  meaning "we asked" rather than "nobody looked".
- **Pre-1930.** The silent era, and the most interesting end: 1,069
  pre-1920 films were already closed on cast alone. If you ever want to
  name the first picture ever to wrap, it's in there.

Both paths now run the same TMDB verification as the sweep, so a backfill
no longer refills the Vault with false closings.

---

## Television — mostly done, and the remainder is deliberate

**Series pages work as of 28 July 2026.** They carry `P4983`, the TMDB
*series* id, where films carry `P4947`; asking only for the second is why
every television page ran on Wikidata alone. BoJack Horseman had six
credited people and now has 229, because `aggregate_credits` returns
everyone who ever appeared where `/credits` returns only billed regulars.

Series can reach the Vault too, and four already have — via the sweep,
which was never type-limited. The old claim here that none could was
wrong.

What remains is the **backfill's** finder being film-only. Measured:
widening it to all of `KINDS`, plus `P580` for series start dates and
`P725` for voice credits, is free — 18s against 22s for 1955 — and yields
2–11 extra candidates a year, almost none of them series. A series has
hundreds of credits across years, so one wrapping is vanishingly rare.
Left film-only on purpose.

**The part worth taking from that measurement:** the cast floor counts
`P161` only, so an animated film with forty `P725` voice credits scores
zero cast and is dropped. A real miss and a one-line fix.

*I Love Lucy* is 16 of 17 gone — the last is Keith Thibodeaux, who played
Little Ricky. That page is the best argument for doing this.

---

## A gaps page

Films the site couldn't answer for, because Wikidata has too little on
record. Useful to a visitor, improves the project's own accuracy, and
invites contribution rather than surveillance — the better version of the
analytics idea that was rejected.

Would pair with a "help fill this in" link on thin film pages.

**Contact: link to Wikidata, not to us.** Someone who knows a missing death
date should be sent to the item itself, where the fix helps everyone
downstream rather than only this archive. A `mailto:` is the fallback for
people who won't edit Wikidata — it needs no backend, so the no-server
property survives.

Not Bluesky DMs: it would mean either publishing a handle that invites
everything, or enabling DM access on the app password, which was
deliberately left unchecked.

---

## Put the Vault re-check on a schedule

`recheck.js` exists and works — its first run removed 278 of 2,752 entries
— but it is run by hand. It should be a cron line, monthly, like the wide
sweep.

Not automated yet because it *deletes* Vault entries, and a scheduled job
that quietly removes things deserves a notification when it does.

---

## Watch the watcher's first real catch

`watch.js` has been tested with `--test` and its connection to eight
newsrooms verified, but no actual death has come through it. The first one
matters more than the code: crude name extraction, an unverified newsroom
claim, and a draft that lands in review flagged `provisional`.

Worth being at the keyboard for it rather than trusting it, and worth
checking afterwards whether the name-extraction heuristic produced noise.

---

## A genre timeline, and the trap in it

*Noted 1 August 2026. The data exists; the graphic does not.*

Genre is now recorded per picture, which makes "when did each kind of
picture close" answerable for the first time. It is also the most
misleading question in the archive if asked carelessly, and both halves
are worth writing down before somebody builds a chart.

**The trap.** Westerns rise from 0.4% of all closings in the 1910s to 6.1%
in the 2020s. That looks like a finding and is an artefact: it reflects
when westerns were MADE, against a corpus whose early years are mostly
one-reelers. Any genre chart plotted against closing date alone will
reproduce the release-date distribution and call it a discovery.

**The honest form** holds the release cohort fixed and compares survival
within it. Measured on pictures released 1950-59:

    documentary  91% closed, median wait 49 years
    western      72% closed, median wait 62 years
    crime        56%
    comedy       54%
    drama        51%
    musical      50%
    romance      47%
    horror       43% closed, median wait 63 years

Documentaries close first and fastest, in both the 1930s and 1950s
cohorts, and by a distance — 49 years against 62-63 for everything else.
The plain explanation is cast size and cast composition: a documentary
credits a handful of adults, a musical credits dozens of young performers,
and the last survivor of a picture is usually whoever was youngest on it.
That is a hypothesis the archive can test — the maker count and the
birth-year distribution are both stored — and it has not been tested.

Horror sits at the other end of both cohorts. Whether that is genre or
simply a proxy for young casts is the same open question.

**What a graphic should probably be.** Survival curves by genre, one
release cohort at a time, x-axis years-since-release rather than calendar
date. That form cannot express the artefact, which is its main virtue.

**And the confidence band must be computed on distinct deaths rather than
pictures** — see METHOD §3. Within a single genre cohort the concentration
is mild (no single death accounts for more than 4% of a genre's closings
in the 1930s or 1950s), but the correction is roughly a halving of the
effective sample, and for anything reaching back before 1920 it is a
division by seven.

---

## Two graphics the archive can support, and what each is actually about

*Noted 1 August 2026.*

### "Who counted", by release decade

The most useful graphic in the project, because it is the denominator
behind every other claim it makes. Share of pictures whose Wikidata record
carries each craft, measured across the corpus pass:

    decade  median makers   cast   director   writer   camera   music   editor
    1890s        1           19%      96%        7%      20%      1%       1%
    1910s        2           54%      92%       26%      13%      1%       1%
    1930s        5           67%      98%       50%      44%     42%      21%
    1950s        6           69%      94%       53%      45%     55%      27%
    1980s        4           66%      93%       50%      35%     47%      23%

Read it as a picture of cataloguing rather than of film-making. A director
is recorded for nine pictures in ten in every era — the record has always
known who directed. Everything else arrives late and unevenly: composers
appear at 1% before 1920 and 55% by the 1950s; editors are 1% until the
1920s; costume design is *under 1% in every decade of the corpus* and is
effectively absent as a craft.

This is the honest form of the coverage caveat in METHOD §3, and it
explains several results that otherwise look like history: the U-shaped
share of closings resting on one or two names, the U-shaped split between
on-screen and behind-the-camera closers, and the apparent early dominance
of producers among the people who close pictures. All three track this
table rather than anything about cinema.

It also carries the project's sharpest single fact about itself: **a
picture from the 1890s has a median of one recorded maker.** When that
person dies the picture "wraps", and what has ended is a catalogue entry.

### "One death, one body of work"

Within a genre and a release decade, the largest share a single person's
death closed:

    65%   91/139    1900s fantasy       Georges Méliès, director (d. 1938)
    32%   87/276    1910s documentary   William N. Selig, producer (d. 1948)
    30%   37/122    1930s family        Mae Questel, voice (d. 1998)
    29%   57/196    1900s documentary   Cecil Hepworth, cinematography (d. 1953)
    20%   16/81     1930s cartoon       Dick Lundy (d. 1990)

Two different phenomena share this shape and a graphic should not merge
them. Méliès is largely the first table showing through: he is the only
credited name on most of his own pictures, so his death closes them by
construction. Mae Questel is the real thing — 1930s cartoons carry full
credit lists, she voiced hundreds of them, and she outlived those casts by
decades. A whole genre of a decade held open until 1998 by one performer.

Everyone in this view is dead, which is why it can be built at all: the
living equivalent is the ranked list refused under *The door held open*.
The distinguishing test is not the metric but the tense.

---

## Faceting: any one column is less informative than any two crossed

*Noted 1 August 2026. The table exists; the interface does not.*

Every result this archive produced on its first day of having a corpus
came from crossing two columns, and every result that came from reading
one was wrong.

- Genre alone said westerns were rising through the century. Genre crossed
  with release cohort said they never were: that was when westerns were
  made.
- Genre alone said documentaries close fastest. Genre crossed with maker
  count said documentaries credit four adults where a musical credits
  forty people including children.
- Closer role alone said the archive shifted from crew to cast and back.
  Crossed with the coverage table it said credit lists got fuller and then
  thinner, which is a fact about cataloguing.

So the exploratory surface is not a set of charts, it is a cross-tab, and
`facts.bin` exists to make one cheap: 103,408 rows of 24 bytes, about
2.4 MB, one fetch, filtered in memory with no query engine.

**Two columns are there to keep it honest, and an interface should be
built so that ignoring them is harder than not.**

`closer` is the person whose death closed the picture. `corpus.js` offers
`count()` and no bare total, and it returns pictures *and* distinct
deaths, because pictures are consequences of an event rather than events.
The difference is not cosmetic:

    westerns as a share of closings, 1910s   1.5% by picture   5.4% by death
                                     1950s   5.6% by picture   7.0% by death

A quarter of the archive's apparent movement in that measure is one
counting error.

`makers` is how many people the record held. Nearly every apparent trend
here is that number changing over time. 52,203 closings — half the archive
— rest on one or two names, and they come from 13,492 deaths.

**What is missing before this is worth building.** Country is not in the
pass at all: the old Vault carried it and the work record does not, so
"which cinemas closed when" cannot be asked yet. It is a film-level fact
like genre and belongs in `enrich.js`, one query per year.

Also worth stating in any interface: the facts table holds closings only.
The 60,000 pictures still open are not in it, so every share it computes
has closed pictures as its denominator, which is a different question from
a share of all cinema.

---

## Wiring the corpus into the site — DONE

*Closed on the evening of 2 August; the hosting followed on 3 August.
Kept because the decisions below still explain the shape.*

The corpus pass produced 329,957 judged pictures and 97,395 closings,
audited, published as static shards by `build-corpus.js` and readable by
`corpus.js`. All three call sites now go through it, the decade drawers
open onto years, and the landing page reads its sorts and its doors out
of `summary.json`. Nothing in `app.js` opens `vault/*.json` any more —
which means **those files are now dead weight in the repository and
should be deleted**.

**The hosting is done.** `CORPUS_BASE` is an absolute URL and the corpus
is on Cloudflare Pages, chosen over R2 because 803 immutable static files
bulk-upload and deploy atomically — so the "manifest last" ordering has
nothing to guard against. The site itself stayed on GitHub Pages, which
is the two-host split that now costs a deploy step; see the link-previews
entry.

The decisions the work was done under, kept because they explain the
shape:

- **The corpus replaces the Vault.** Not beside it.
- **Decade drawers stay**, because a decade is where browsing starts — but
  a drawer opens onto *years*, not onto a list. A closing decade is up to
  6 MB (the 2010s hold 16,015 closings); a closing year is about 600 KB
  and the busiest year in the corpus, 2022 with 1,980, is 773 KB.
  `summary.json` carries `closingDecades` with per-year counts so a drawer
  can show numbers before it fetches anything.
- **Hosting is Cloudflare R2.** Immutable tree first, `manifest.json`
  last, so a half-finished upload is invisible rather than broken.

The three call sites:

| today | becomes |
|---|---|
| `loadIds()` → `vault/ids.json` (1 MB of quoted Q-ids at this scale) | `corpus.has(qid)` → 434 KB binary, one fetch, binary search |
| `loadDecade(key)` → `vault/<decade>.json` | `corpus.closed(year)`, behind a decade index |
| `loadSummary()` | `corpus.summary` |

**Two axes exist and confusing them is the first rule in FINDINGS.** The
Vault browses `closed` — when a picture's last maker died. `year` is when
the picture came out. Both are published.

**Still open:** how the ongoing sweep merges new closings into a corpus
the pass owns. The pass is a batch job over a release year; the sweep is
incremental and event-driven. Simplest coherent answer is that a new death
triggers a re-pass of the affected release years, which is minutes, but
nothing is built.

---

## Something that checks the person page against `verify.js`

*Raised 2 August, after the second time this drifted. **Half of it was
deleted rather than checked on 4 August** — see below — and what remains
is the half a checker is the right tool for.*

**The verdict no longer drifts, because there is only one of it.** Rule
35: `verdictFor` in `verify.js`, called by `judge.js`, `audit.js` and
`app.js`. Three lines that had been written out in four files, and were
wrong in two of them. Checking four copies for agreement was the wrong
instinct; deleting three of them is cheaper and permanent.

**What is left is the gathering, and that genuinely cannot be shared.**
The pass reads Wikidata and TMDB and writes the answer down. The browser
asks Wikidata live, and cannot afford the survivor test on a page load —
that is hundreds of requests per filmography. The difference is why a film
page moves the day a death is recorded rather than the day a pass is run.

So the surfaces will always be looking at different populations, and the
check below is for exactly that. Note that its test is **not equality** —
which is why it survives the extraction as a useful thing rather than a
tautology.

---

Rule 27 in `VERIFICATION.md` is *asserted*, and it is the only rule whose
subject is the code rather than the data: a person page asks Wikidata
directly and applies rules 6, 7 and 8 itself, in the browser, in a second
implementation the audit never reaches.

It has to be a second implementation. A filmography reaches release years
the pass may not have run, and the corpus is a snapshot while Wikidata is
live, so the page cannot read a verdict off the corpus alone. That is a
constraint, not a shortcut.

It drifted twice. First by omission — the page decided by counting
credits, deaths and the too-old, and rules 6 and 7 cannot be written as
counts, so Philip Glass (born 1937, credited on *Dracula* (1931) for a
1999 score) held that picture open on his co-workers' pages while the
Vault had it closed on Carla Laemmle in 2014. Fixed by returning the
people rather than the arithmetic, which at least makes a new rule a new
line of JavaScript over the same facts `verify.js` is given.

**What would check it.** For a sample of pictures the corpus has closed,
run the page's `readPeople` over the live filmography query and compare
verdict and wrap date against the stored closing. Disagreements are
expected — Wikidata moves — so the test is not equality but that every
disagreement is explained by a credit added since the pass ran. That is
a script, offline apart from the queries, and it would have caught this
in one run over any year.

Until it exists, the two are kept in step by hand, and the honest place
to say so is the *checked?* column.

---

## A quarter of the corpus cited TMDB where Wikidata had the same fact — RUN

*Raised and run 2 August, out of reading TMDB's terms. The largest of the
three things that reading turned up, and the one that is about the
archive rather than about paperwork.*

**Done.** `poster/provenance.js` ran over all 137 years in 52 seconds.
19,614 closings are corroborated — Wikidata records the identical death
date — taking TMDB-only dates from about 27% of published closings to
about 8%. `audit.js` was then run over every year: 137 audited, 0
failures, every verdict and wrap date still reproduces.

What remains open is the 1,207 disputed closings below, and propagating
the new `wikidataId`s into `works.jsonl`.

**27,058 of 98,925 published closings — 27% — are dated by a death only
TMDB recorded**, with no Wikidata equivalent in the evidence. That
includes Auguste Lumière dating *Workers Leaving the Lumière Factory*.
`METHOD.md` §2 says Wikidata is the source and TMDB the check. For a
quarter of the archive that is backwards.

**It is not a broken join.** All 27,058 are people never matched to a
Wikidata item, and 26,787 of them have a TMDB birth date, so the
name-and-birth-year rule could have fired. It never got the chance:
`deathsByName` exists to find a death for somebody TMDB calls living, and
once TMDB answers *dead* the person is settled and nothing asks further.
Efficient for the verdict, wrong for the citation — **the same shape as
the short-circuit in rule 19**, a memo whose dependency is not recorded.

**The dates are mostly there.** Of the 60 closers that date the most
pictures, 55 have a Wikidata item carrying a death date — Lumière is
Q4272245, d. 1954-04-10, the same date. But a label match alone also
returns a George Spence who died in 1850, so this needs the existing
strict rule (name plus exact birth year, exactly one candidate) and not a
bulk overwrite.

**The fix is written**: `poster/provenance.js`, and it is a
*corroboration* pass rather than a repair. `verify.js` documents the
name-and-birth-year rule as "good enough to stop claiming somebody is
alive, and not good enough to put a day on the headline claim", and that
does not get relaxed because a different caller finds it convenient. So
where the two sources agree the date is left exactly as it was and the
record simply stops saying the fact is TMDB's alone; where they disagree
nothing moves and the conflict is written down for a human.

**Dry run, 137 years, 38 seconds** (9,881 distinct people, WDQS answers a
batch of sixty in 0.2s):

| | |
|---|---|
| Wikidata records the identical date | **19,614 closings** |
| the two sources disagree | 1,207 |
| no single Wikidata candidate | 6,547 |

That moves TMDB-only dates from about 27% of published closings to about
8%, which is the difference between the licence question needing an
argument and not.

**The disagreements are the unplanned find, and they are the reason this
was worth doing even if the licence question vanished.** After separating
precision from contradiction — 318 had 1 January on one side with the
years agreeing, which is one source knowing less rather than the two
disagreeing — **337 people across 889 closings genuinely conflict.** They
are in `pass/provenance-disputes.tsv`, worst first by how many closings
each dates, and **1,034 closings now carry a `disputed` mark in the
corpus and on the Vault's rows** (a flagged closer flags every picture
they date). 0.86% of the archive.

The figures below are from the first run, before that separation:

| | |
|---|---|
| 1 January on one side — a year-only value, not a contradiction | 153 people |
| ...of which agree on the year, so are precision and nothing more | 135 |
| genuine day-level disagreements | 319 people |
| ...of which disagree on the **year** | 43 people, 216 closings |

**The 43 are almost all one digit.** Same day, same month, one character
different in the year:

| | TMDB | Wikidata | closings |
|---|---|---|---|
| Antonio Moreno | 19**8**7-02-15 | 19**6**7-02-15 | 20 |
| Mary Stuart | 2**0**22-02-28 | 2**0**02-02-28 | 12 |
| Zena Keefe | 197**7**-11-17 | 197**6**-11-17 | 40 |
| Alice Day | 199**9**-05-25 | 199**5**-05-25 | 11 |
| Tanis Chandler | 2**0**16-05-07 | 2**0**06-05-07 | 8 |

Antonio Moreno died in 1967 and Mary Stuart in 2002. **Wikidata is right
and this archive currently publishes the typo** — on 216 closings, and
Zena Keefe alone dates 40 of them.

Nothing has acted on these, deliberately: a name-and-birth-year match is
the weakest evidence in the project and it is not allowed to date a wrap.
Correcting them means reading the file. Where Wikidata carries a
reference, that is a repair; where it does not, it is a second opinion.

**Still to do after a real run:** the corroborated closers gain a
`wikidataId` in the evidence but `works.jsonl` is untouched, so the
published `last.id` stays null and 19,614 closings still cannot link to
the person who closed them. A `rebuild.js` pass would propagate it.

**What it is not.** Writing these dates *into* Wikidata and reading them
back as CC0 was considered and is licence laundering; it would also
manufacture a second apparent source for a single fact. Wikidata would
not want them regardless, TMDB being user-edited and not a reliable
source for a death on its own. The one clean contribution upstream is the
**identifier link** — P4985, TMDB person ID — which is a checkable claim
about who is who rather than an import of anyone's facts, and which would
stop the join failing for everybody.

---

## The TMDB credit is conditioned on the wrong thing — DONE

*Raised and fixed 2 August; the logo followed on 3 August.*

**Done.** The notice is unconditional, in the colophon on every page, in
TMDB's own wording. `revealTmdb()` no longer gates on a key, and the About
paragraph says what TMDB's role actually is: about one closing date in
thirteen rests on a death only TMDB records.

**The logo is in**, at Jacob's instruction on 3 August. `tmdb.svg` at the
repository root is TMDB's `blue_short` mark, unmodified — 10px, against a
46px wordmark, which is how the terms' *less prominent than your own
branding* condition is met. It is shown at full opacity deliberately:
dimming it to sit quieter against this palette would be an alteration of
somebody else's brand asset.

**It closes the notice rather than sitting above it.** Stacked, it read as
a badge bolted to the foot of the page and said TMDB four times in three
lines. The required sentence ends on the word TMDB, so the mark is that
word — `alt="TMDB"` keeps the wording intact for a screen reader, which
hears the notice exactly as the terms write it. A one-line variant was
tried and rejected: it read better and it abbreviated their required
wording, which is not ours to edit.

On the light palette the gradient's green end goes pale against cream.
Legible, and left alone for the same reason as the opacity.

All five marks are kept in `licences/logos/` with the terms themselves.
TMDB fingerprints its asset filenames with a SHA-256 of the contents and
all five of ours match, so they are verified intact rather than merely
downloaded.

The original defect, for the record:

`revealTmdb()` unhides the TMDB credit and the required disclaimer only
when a `TMDB_KEY` is present in the browser. The comment explains why —
*"it would be false to credit a source we never call"* — and that was
right when every page was computed live.

It is now stale. The corpus ships TMDB-derived dates whether or not a
visitor's browser ever calls TMDB, so on the live site the credit is
hidden while TMDB data is being served. TMDB's terms require the notice
*and the TMDB logo*, which appears nowhere.

Fix: unhide both unconditionally, and add the logo. The live-call
condition should govern nothing, because the data is present either way.

---

## A licence for the corpus — DECIDED 3 August 2026

**CC0 1.0 for the corpus, MIT for the code.** `LICENSE-CORPUS` and
`LICENSE`. Methods no longer says a licence is unset; it says what the
licence is. The citation format is requested, not required.

Two clauses turned up on 3 August when the terms were downloaded and read
in full rather than summarised, and both are recorded in `SOURCES.md` §6:
termination obliges us to **purge cached TMDB content**, which reaches
published `v/` shards on the CDN and not only local files; and
**"destination website"** appears among the commercial-use examples in
§2.A. Neither changed the decision. The second is the one to re-read if
this site ever earns anything.

The analysis that led there is kept below, unchanged.

---

*Open since 1 August. The `SOURCES.md` §6 question. The terms were read
on 2 August; what they say is below.*

Wikidata is CC0 and imposes nothing. Facts are not copyrightable in the
US; a database can attract sui generis rights in the UK and EU, which
would mean this project *holds* one rather than infringes one. The real
constraint is contractual — TMDB's API terms.

**What those terms actually say**, read 2 August 2026:

| clause | text |
|---|---|
| commercial | *"The license ... does not permit any commercial use of TMDB, the TMDB APIs, or TMDB Content"* |
| caching | *"Cache, for longer than 6 months, any information obtained through or from TMDB or the TMDB APIs"* — prohibited |
| derivatives | *"Make derivatives of the TMDB APIs or TMDB Content"* — prohibited |
| AI/ML | *"... in connection with, including for training, a machine learning (ML) or artificial intelligence (AI) based Application"* — prohibited |
| attribution | the TMDB logo, plus *"This [product] uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB"* |
| grant | *"non-exclusive, non-transferable, non-sublicensable"* |

They say nothing about factual data or database rights.

**The conflict CC0 creates.** CC0 grants commercial use, redistribution
and AI training. TMDB forbids all three. Rights you do not hold cannot be
granted, so CC0 across the whole corpus would purport to license the 27%
of dates above in ways the agreement prohibits.

**The counter-argument, which is probably decisive in practice.** A death
date is a fact, not expression. TMDB holds no copyright in *"Auguste
Lumière died on 10 April 1954"* and the terms claim none. The restriction
is contractual and binds this project rather than anybody downstream, so
the realistic consequence of being wrong is a revoked key, not a claim
against a reuser.

**Recommendation, unchanged in direction and better supported now: CC0**,
with the citation format in `SOURCES.md` requested rather than required —
but **fix the source question first**. If most of that 27% resolves to
Wikidata, CC0 goes from defensible-with-an-argument to plainly fine, and
the argument stops needing to be made. CC BY on a database creates
attribution stacking for reusers and buys little; ODC-BY exists if the
credit should bind.

**The caching clause is answered by the plan that already exists**, with
two conditions. Periodic re-scanning satisfies *"no longer than 6
months"* only if it **refreshes** stored values rather than only adding
new ones, and only if **old corpus versions expire**: `v/<version>/` is
immutable and served with a year's cache life, so a version published
eight months ago is TMDB data older than six months still sitting on the
CDN. `build-corpus.js` notes old versions can be deleted once nothing
references them; that has to become a policy rather than a possibility.
It also answers `SOURCES.md` §6.2, which is the same question in
different clothes.

---

## Posts that are not closings

*Raised 2 August. Blocked on the Desk, which is why the Desk matters.*

The pass produced material that would make good posts and has nowhere to
go. `queue.json` holds closings awaiting review; there is no path for a
written piece, and `preview.js` — the only tool that renders a queue —
is unrunnable.

Candidates, all verified against the corpus, all about people who are
already dead:

- **Georges Méliès's death in 1938 closed 65% of every fantasy film
  recorded from the 1900s.** Carry the caveat: he is the only credited
  name on most of them, so this is partly the record showing through.
- **Mae Questel held 30% of the decade's family films open until 1998.**
  The clean one — 1930s cartoons carry full credit lists and she genuinely
  outlived those casts.
- **William Nicholas Selig's single death closed 812 pictures.**
- **The last living links to silent cinema**, and the exact day each door
  shut: Carla Laemmle (*A Manly Man*, 1911 → 2014), Fay McKenzie
  (*Station Content*, 1918 → 2019), Don Marion Davis (*Down on the Farm*,
  1920 → 2020), Baby Peggy (*Playmates*, 1921 → 2020).
- **The Wizard of Oz is still open**, held by one person — which is a
  better post than its closing will be, and expires.

**A hand-written post for one specific closing was considered and
rejected** on 2 August. See `DECISIONS.md`, *Everybody gets the same
treatment*.

---

## Cast size and cast age, tested

*Raised 1 August. The data is stored and the test has not been run.*

Documentaries close earlier and faster than any other genre in every
release cohort measured — 38% closed against 2-6% for a 1979-87 cohort.
`FINDINGS.md` §6 asserts this is not about documentaries but about how
many people a picture credits and how young they were, since the last
survivor is usually whoever was youngest on set.

Both variables are in the evidence: `makerCount` per picture, birth years
per person. The test is a regression of closed-share on maker count and
median cast age within a fixed release cohort, with genre added last to
see whether it explains anything the first two do not. If it does not,
§6's claim is confirmed and genre can be documented as a sort knob rather
than a variable.

