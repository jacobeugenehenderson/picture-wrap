# Backlog

Things deferred deliberately, with enough context to pick them up cold.
Roughly in the order they're worth doing.

---

## Alt text that actually describes the image

**Priority: high.** Currently the alt text is a caption, not a description:

```
portrait   "Ann Blyth"
poster     "Poster for Mildred Pierce (1945)"
```

Someone using a screen reader learns nothing from that beyond what the
post already says. Alt text should describe what is *in* the picture.

Better:

```
"Ann Blyth in a 1952 studio publicity photograph, in three-quarter
 profile against a plain backdrop."

"Theatrical poster for Mildred Pierce, 1945. Joan Crawford in a fur
 coat, a gun and a beach house behind her."
```

Where the material could come from:

- **Commons file descriptions.** `wbgetentities` on the `M`-id of a
  Commons file returns structured data, including `P180` (depicts) and a
  caption. Many portraits have a real description; some have only a
  filename, which is often still informative — *"Studio publicity Ann
  Blyth.jpg"* gives you year and context.
- **TMDB has no alt text for posters**, so poster descriptions would have
  to be built from what we know — title, year, the two star names we
  already fetch — or written by hand for the handful that recur.
- **Falling back honestly** matters: if nothing is known, `"Portrait of
  Ann Blyth"` is better than an invented description. Never guess at
  image contents.

Related: the site's `<img>` tags use `alt=""` on portraits, treating them
as decorative. That's defensible since the name is adjacent in the DOM,
but worth revisiting with the same care.

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
