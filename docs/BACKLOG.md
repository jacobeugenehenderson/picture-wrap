# Backlog

Things deferred deliberately, with enough context to pick them up cold.
Roughly in the order they're worth doing.

---

## The site still has the old verification bug

**Priority: highest. Do this first.**

`app.js:332` (`addCharacters`, film pages) and `app.js:664` (`survivingIds`,
person pages) each carry their own copy of the TMDB check, both with the
flaw fixed in `lib.js` on 28 July 2026: they resolve TMDB's cast against
Wikidata and treat anyone unresolved as dead.

**Consequence:** a film page can show the gold bar at the top — the picture
declared wrapped — while TMDB knows someone in it is alive. *The Wizard of
Oz* is the case to test with; Caren Marsh (TMDB person 1743897) is alive
and the site does not know it.

Nothing publishes from the browser, so this is a display error rather than
a Bluesky error. It is still the most visible thing we can get wrong.

**The fix is not to patch them.** It is to move the logic somewhere both
halves read, the way `shared.js` already holds the definitions. The
obstacle is that `lib.js` is Node-only — it does file IO and sends a
User-Agent the browser can't. Extract the pure verification into
`shared.js` (or a new `verify.js`) taking `fetch` as the only dependency,
and have `lib.js` and `app.js` both call it.

Three copies of this logic existed this morning. Two are gone. Do not
leave the third.

---

## Re-check the whole Vault under the fixed logic

**Priority: high.** All 2,819 entries were filed by the broken check. A
40-picture sample reopened 5% — roughly 140 wrong entries.

`recheck.js` is fixed and calls the shared function. It needs a full pass:

```sh
node recheck.js --dry-run --limit 200    # confirm the rate first
node recheck.js
```

It backs up to `archive.json.before-recheck` and clears reopened ids from
`state.seen` so they can close again later. Run it after the backfill, not
alongside it — they compete for the same TMDB quota.

Expect the Vault to shrink. That is the point.

---

## Alt text worth reading

**Priority: high.** Currently it is a caption, not a description — both
lines merely repeat the post text, so a screen reader gets nothing the
sighted reader didn't already have in words.

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
- `watch.js` already sees the newsroom post that triggered a check, so it
  could record that post's identity at the time rather than searching for
  it later.

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

Either show the number, or mark the thin ones, or filter them out. The
data is already in `archive.json`.

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
file per Vault entry with real `og:` tags. Bounded set — 2,819 files —
and GitHub Pages will serve them. The site itself would stay a single-page
app; those files exist only to be scraped.

---

## Re-run 1930–1945

**Priority: high.** The backfill's candidate query had a counting bug —
`?cast` was distinct over people, `?dead` was a row sum — so any film with
two release dates reported more dead than credited, failed the
`cast === dead` gate, and was never offered. Fixed in `lib.js`.

It dropped roughly **half of every year**: across 1935, 1939, 1942 and
1945, the gate admitted 887 films where it should have admitted 1,655.
*The Wizard of Oz* was one of them, reported as "20 cast, 21 dead" — the
most recognisable closed picture there is, and the Vault never had it.

The missed films were never marked seen (the finder never returned them),
so re-running the backfill over 1930–1945 will simply find them. They
still face TMDB verification, so expect a good share to reopen.

---

## More backfill

The Vault covers **1930–1945 releases only** — 2,819 pictures. Two obvious
extensions:

- **1946–1965.** The biggest gap by far, and where closings are dense —
  old enough that casts have gone, recent enough to be well documented.
  Would roughly double the Vault. About three hours unattended.
- **Pre-1930.** The silent era, and the most interesting end: 1,069
  pre-1920 films were already closed on cast alone. If you ever want to
  name the first picture ever to wrap, it's in there.

Both paths now run the same TMDB verification as the sweep, so a backfill
no longer refills the Vault with false closings.

---

## Television

Series are searchable and the poster handles them, but the backfill's
candidate finder is film-only (`P31=Q11424`), and series date from `P580`
rather than `P577`. So no series can reach the Vault yet.

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

## `state.json` is not backed up

It records every film the poster has ever considered — 3,805 of them — and
is deliberately gitignored, because it changes on every run and would make
the history unreadable.

If it is lost, a backfill re-offers everything from scratch. Worth a copy
somewhere that isn't this machine.
