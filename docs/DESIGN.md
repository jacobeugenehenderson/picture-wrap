# Design

## The bar

One list per picture. The living above, the dead below, a gold bar between.

As people die they cross from the top section to the bottom. The living
section shrinks and **the bar rises**. When there is nobody left it leaves
the roster entirely and comes to rest **under the title** — which is both
the top of the page and the end of the journey the whole design is about.

So the bar has two homes and its position is the entire answer. Under the
title: wrapped. Anywhere else: not. Nothing else has to say so, and after
28 July nothing else does.

The bar's height *is* the reading. There is no count, no fraction, no
progress percentage, no "12 of 40 remaining" anywhere in the interface. You
see how much is left.

This is the whole design. Everything below is in service of it.

### Consequences

**No counts on any page.** The system computes them constantly — they decide
which side of the bar a row falls on and whether a film has wrapped — but
they are never rendered. The one exception is the crew fold's count, which
describes a collapsed card, not a state of anyone's life.

**The extremes are silent.** A recent film has the bar at the bottom. A
wrapped film has it at the top with nothing above. Neither is labelled.

**One gold bar per picture.** The crew fold has its own living/dead divider,
deliberately rendered as a *hairline* — a thin gold gradient fading out at
both ends. The Vault has none at all: everything on it has already crossed,
and a divider there would spend the bar's meaning for nothing.

**When a picture has wrapped, the bar leaves the roster** and sits under
the title. It used to cap the list instead, which meant a collapsed crew
card floated above it and softened the one moment the design exists to
state. Under the title there is nothing above it by construction.

---

## Sort order

Since the bar is the only quantitative element, ordering carries the rest.
The rule makes the two rows **flanking the bar** the meaningful ones:

- **Dead: most recent death first** → directly below the bar is who just went
- **Living: oldest last** → directly above the bar is who is probably next

The boundary reads as motion without stating anything.

Unknown birth dates sort to the *top* of the living block, away from the bar.
A missing date must never win the "probably next" position.

This is also why age order beats billing order for the living. Billing tells
you about the film; age tells you about the bar.

---

## Life spans

One format for everyone, and the difference between living and dead is simply
whether the span closes:

```
1940–              still going
1924–2004          closed
```

The open dash does the work no label or colour needs to. Tabular figures keep
the dashes in a column so the open ones read as a group at a glance.

Under a closed span sits the exact death date — *1 July 2004* — which is what
earns a row its place next to the bar. Living rows have nothing there, which
is its own quiet statement.

Missing birth date on a dead person renders `?–2004`, never a broken dash.

---

## Portraits

All portraits are **desaturated**. Commons photos span a century of
processes; a 2015 red-carpet shot beside a 1972 publicity still otherwise
reads as a bug. Grayscale is what makes the list one object.

Dead rows drop to `0.72` opacity — a second signal, deliberately much softer
than the dates so it registers as texture rather than a competing system.

Coverage is ~67%, so the layout must work with no image at all. Portraits are
progressive enhancement; an empty frame holds the column.

---

## The person page

Same instrument, rotated. Their pictures, newest first, divided by the bar:
still running above, wrapped below.

**Newest first, not oldest.** A filmography reads as a document oldest-first,
but newest-first makes this bar mean what it means everywhere else — the
oldest still-open picture sits directly above it, the one most likely to
close next, and the most recently closed sits directly below. Same rule as
a film page, same direction as the Vault.

**Each row carries the roles held on that picture** — "Director ·
Screenwriter · Actor" for Manhattan, "Actor" for Scenes from a Mall. Rows
rather than IMDb-style sections, because sections would fragment the bar: a
picture's living/dead status is independent of the role, so Director and
Actor would each need their own and the page's one instrument would stop
meaning anything.

---

## The three zones of a film page

*Settled 28 July 2026, after several worse attempts.*

| | |
|---|---|
| Above the bar | living — anyone either database gives a birth date and no death |
| Below the bar | gone — anyone either database gives a death date |
| Below the credits | credited on the picture, no date on record anywhere |

The third zone is the one that took work. Those people were once hidden in
a fold headed **"Credited, no record"** with a count, and a sentence
underneath the roster explaining why the bar had not risen. Both are gone.

**They are listed, because it is a listing.** They were in the picture. An
em-dash where the dates go says exactly what we hold, and that is the whole
disclosure — a heading saying *no record* turns an absence into a finding.

**They are uncounted, in both directions.** Reading a blank as a death is
the mistake this project exists to avoid; reading it as a pulse would hold
every old picture open forever.

Set apart rather than folded away: the portrait column goes, which shifts
the names left and is most of the signal, and the type quietens. It should
read as an appendix to the list, not as rows that failed.

### What was tried and rejected here

- **A sentence under the roster** — *"Everyone on screen is gone. Someone
  who worked behind the camera is still here."* It existed because a living
  crew member sat inside a collapsed fold, so the page needed prose to
  explain a bar that had not risen. Fixing the cause removed the need.
- **A `+` marker** on names sourced from TMDB. Provenance is not the
  reader's question, and a symbol that needs a key is the same failure as a
  fold that needs a heading.
- **A badge beside the title** meaning *wrapped*. Redundant the moment the
  bar moved under the title, and two gold marks competing.

The rule that came out of it: **if a listing needs a sentence underneath
saying why it looks wrong, fix the listing.**

---

## Structure of a film page

```
  Title card           title
                       ── GOLD BAR ──                 (if closed)
                       year · country + type · director
                       FINAL PICTURE WRAP · date      (if closed)
                       X was the last of its makers.  (if closed)
  Share                share · copy link · bluesky
  Behind the camera    crew, collapsed to one row
  The roster           living · GOLD BAR · dead       (bar here if open)
  ── appendix ──       credited, no date on record
  Correction           edit this picture on Wikidata
```

The title card is one object: name, bar, provenance, date, closing line.
It was four separated things, and the wrap stamp was boxed — which made
two announcements out of one fact, since the bar directly above it had
already said *wrapped*. What the line carries now is the date, which the
bar cannot say.

**Type and country come before the director** in the meta line. On an
obscure or foreign title, *"1964 · French film"* identifies it better than
a name you've never heard. The demonym is used, not the country — "French
film", not "France film" — taken from one country rather than every
co-producer, or The Umbrellas of Cherbourg reads as West German.

The appendix is the third zone, described above.

**The correction line is the last thing on the page**, and it points at
that picture's Wikidata item rather than at us — a fix there is read by
everything downstream, and this archive is only one of the things reading
it. It used to live inside the fold that was removed, which meant the one
affordance on the page sat behind a disclosure triangle.

Crew sits **above** the cast, the way a title card runs. Collapsed it costs a
single row, and on an old picture it is a who's who in its own right — which
is why it is a bordered card rather than a footnote.

---

## Type

| | |
|---|---|
| Display | Iowan Old Style → Palatino → Book Antiqua → Georgia |
| Interface | system sans |
| Figures | tabular everywhere a date or span appears |

No web fonts. No CDN. The site loads nothing from anywhere.

Serif for anything that is *content* — names, titles, quotes. Uppercase
letterspaced sans for anything that is a *label* — section headings, the wrap
stamp, filter names. The archive's line is set in italic serif rather than
the uppercase label style, because it is a line someone says, not a category.

---

## Colour

The whole theme is custom properties at the top of `style.css`. Light and
dark are both defined; dark follows `prefers-color-scheme`.

| | |
|---|---|
| `--paper` | warm off-white / near-black |
| `--ink` `--ink-soft` `--ink-faint` | three levels, used consistently |
| `--gold-dark` `--gold` `--gold-light` | three stops, so the bar has a sheen |

The gold is a three-stop gradient rather than a flat fill. That was to stop
it reading as a CSS block; that it lands on Oscar statuette was luck, and
worth keeping.

Gold appears in exactly four places: the bar, the masthead rule, the crew
hairline, and focus/hover accents. It is never decoration.

---

## Voice

Plain. The facts are doing the work.

The Bluesky post is the strictest example:

> Casablanca (1942) has wrapped.
> The last of its company, Madeleine LeBeau, died 1 May 2016.

No adjectives, no elegy, no "sadly". Anything added reads as the project
being pleased with itself. When a character name is available it is included;
when it is not — which is most of the time — the plain form has to stand
alone, so it is written to.

Where the data is thin the site says so in its own voice rather than hiding:

> Everyone on record here has died — but only a handful were ever recorded,
> so this is a gap in the archive more than an ending.

---

## What was tried and cut

**A landing paragraph.** Explained the mechanism instead of the idea. The
masthead tagline carries it alone.

**An on-screen / everyone toggle.** Replaced by the crew fold, which is
better: the cast is always the picture, nothing is hidden, and the crew is
available rather than alternative.

**Released / Closed pulldowns on the Vault.** Replaced by decade folds with
years nested inside. The sections are the navigation, and a year with no
closings simply doesn't appear — a gap a filter would have shown as an
empty result. A country filter row survived, because 31 countries in one
list is genuinely hard to read past.

**Explanations of things the layout already said.** The caveat under the
wrap stamp restated the fold beneath it. The fold's paragraph restated its
own title. Both cut to nothing.


## The viewer

Click any portrait and it opens at `?width=960` — 100–160 KB. Never the
original: they run from 280 KB to, in one case, 5.4 MB, and nothing about
a portrait on this site needs that.

**In colour, and this is the one place the desaturation lifts.** The
roster greys portraits because a column of them spanning a century reads
as an accident; a single picture at size has no such problem, and there
you are looking *at* the photograph rather than along a row of them.

The portrait claims the click before the row does — rows navigate to a
person's page, and enlarging is a different intention. Escape closes it,
so does clicking anywhere outside the picture. Focus lands on the dialog
rather than the close button, so a mouse user is not shown a focus ring
they did not ask for; tab still reaches the button and then the ring is
earned, in gold rather than system blue.

The caption carries the name and a link to the file on Commons. At
thumbnail size the colophon credit is defensible; showing someone's
photograph at 960px is closer to display, and the file page is where the
licence and the author live.

---

## Contrast

Every colour clears WCAG AA against its own background in both themes, and
the secondary tones clear it by a wide margin — 8.5:1 and 6:1 rather than
the 4.5:1 floor, going to 11:1 and 8:1 below 480px.

AA is the threshold for *legible*, and most of these greys are set small,
uppercase and letterspaced, which costs more than a contrast ratio knows
about: the word loses its outline and has to be read letter by letter. A
phone is also small, often at arm's length, and often in daylight.

| | light | dark |
|---|---|---|
| `--ink` | 16.4:1 | 15.4:1 |
| `--ink-soft` | 8.5:1 *(11.1 mobile)* | 9.0:1 *(11.5 mobile)* |
| `--ink-faint` | 6.0:1 *(8.0 mobile)* | 6.2:1 *(8.2 mobile)* |
| `--gold-dark` / `--gold` | 5.4:1 | 7.9:1 |

The small type scale also goes **up** on mobile, not down: `--size-tiny`
0.7rem → 0.78rem, `--size-small` 0.8rem → 0.86rem.

Hues are fixed. If you change a value, re-measure.

---

## The tab

The tab is the only part of the site visible while you are looking at
something else, so it carries the same two facts the page leads with:
which picture is open, and whether it has wrapped.

| | |
|---|---|
| Landing | `Picture Wrap` |
| A film | `Mildred Pierce (1945) · Picture Wrap` |
| A wrapped film | `The Wizard of Oz (1939) — wrapped · Picture Wrap` |
| A person | `Ann Blyth (1928–) · Picture Wrap` |
| The Vault | `The Vault — 2,819 pictures · Picture Wrap` |
| Loading | `Pulling the call sheet · Picture Wrap` |

Two rules behind that table. **The qualifier goes last**, because tabs
truncate from the right and a name cut short is still a name. And **the
title is plain text** — `document.title` renders `&ndash;` as those eight
characters, so real dashes only, never the entities the markup uses.

The count on the Vault is the whole Vault, not the filtered view. A tab
that changes size because you clicked "French" is reporting on the widget,
not on the archive.

Loading messages reach the tab as well. A background tab on a slow
Wikidata query otherwise sits on the title of whatever you were reading
before, which is the one thing it must not say.

### The icon

`favicon.svg` is the drawing: the roster, divided. Two rows above the bar,
two below and dimmer, the bar full-bleed and a little above centre because
that is the direction it moves. Its gradient is the same five stops as
`.bar` in `style.css`, copied by hand — nothing imports anything here, so
they only stay in step if you change both.

The field is ink, not paper, and this is the one place the site's warmth
gives way. A favicon sits on browser chrome we don't control and can't
query: paper disappears against a light tab strip, and gold on near-black
is the only version legible against either. At 16px the pairs of rows
blur into single blocks — checked, and it still reads as a list with a
gold line through it, which is the whole mark.

The two PNGs are rasterisations for Safari before 16 and for iOS home
screens. Regenerate them from the SVG rather than editing them:

```sh
qlmanage -t -s 180 -o . favicon.svg && mv favicon.svg.png apple-touch-icon.png
qlmanage -t -s 32  -o . favicon.svg && mv favicon.svg.png favicon-32.png
```

`theme-color` paints the browser's own chrome, and carries both `--paper`
values behind a `prefers-color-scheme` query, so the frame matches the
page it is framing in either theme.
