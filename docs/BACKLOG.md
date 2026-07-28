# Backlog

Things deferred deliberately, with enough context to pick them up cold.
Roughly in the order they're worth doing.

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

The re-check computed `unknownCount` per entry and it's stored, but only
film pages show the caveat. A Vault row claiming a picture closed on 36%
of its cast looks identical to one that closed on 100%.

Either show the number, or mark the thin ones, or filter them out. The
data is already in `archive.json`.

---

## Link previews

Hash routing means `picture-wrap.com/#/film/Q979726` never sends the film
id to a server, so a shared link gets the generic site metadata.

Bluesky is solved — posts carry images now, and an `external` embed lets
us supply title and description directly. Everywhere else (Slack, iMessage,
Mastodon) still shows the generic card.

Fixing it properly means the poster prerendering a small static HTML file
per archived film with real `og:` tags. Bounded set, no new
infrastructure. See DECISIONS.md → hash routing.

---

## More backfill

The archive covers **1930–1945 releases only**. Two obvious extensions:

- **1946–1965.** The biggest gap by far, and where closings are dense —
  old enough that casts have gone, recent enough to be well documented.
  Would roughly double the Vault. About three hours unattended.
- **Pre-1930.** The silent era, and the most interesting end: 1,069
  pre-1920 films were already closed on cast alone. If you ever want to
  name the first picture ever to wrap, it's in there.

Both need `recheck.js`-style TMDB verification, which the backfill path
does **not** currently do — only the sweep does. Fix that first or the
Vault fills with false closings again.

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

---

## Vault maintenance script

`OPERATIONS.md` describes a monthly re-check for pictures that *un-wrap*
when someone adds a living cast member. `recheck.js` does exactly this
already — it just needs to be a cron line rather than a thing you
remember.
