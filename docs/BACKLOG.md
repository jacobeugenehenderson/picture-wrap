# Backlog

Things deferred deliberately, with enough context to pick them up cold.
Roughly in the order they're worth doing.

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
  `review.js` and the desk. `review.js` currently builds the archive entry
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

## Link previews outside Bluesky

Hash routing means `picture-wrap.com/#/mildred-pierce/Q979726` never sends
the id to a server, so a shared link gets the generic site metadata.

**Bluesky is solved** — posts carry the portrait and posters directly, so
no card is needed. Everywhere else (Slack, iMessage, Mastodon, Discord)
still shows one generic card for every page on the site.

The fix without a server: have the poster prerender a small static HTML
file per Vault entry with real `og:` tags. GitHub Pages will serve them,
and the site itself stays a single-page app — those files exist only to
be scraped.

**`publishVault` in `lib.js` is now the hook.** It already writes derived
files beside the archive on every save, so this is a function call in a
place that exists rather than a new step anyone has to remember.

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
