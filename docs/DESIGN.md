# Design

## The bar

One list per picture. The living above, the dead below, a gold bar between.

As people die they cross from the top section to the bottom. The living
section shrinks and **the bar rises**. When it reaches the top there is
nothing above it and the picture has wrapped.

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

**When a picture has wrapped, the bar rises above everything** — above the
crew card too, since everyone in it is gone as well. Nothing sits above the
bar once there is nobody left. The Wizard of Oz is the case that showed
this: a collapsed card floating above the line undercut the one moment the
design exists to state.

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

## Structure of a film page

```
  Title card           title · year · country + type · director
                       FINAL PICTURE WRAP · date      (if closed)
  Share                share · copy link · bluesky
  ── GOLD BAR ──                                      (if closed)
  Behind the camera    crew, collapsed to one row
  ─ message ─          only when the cast is complete but crew survive
  The roster           living · GOLD BAR · dead       (bar here if open)
  Credited, no record  people TMDB names and Wikidata doesn't
```

**Type and country come before the director** in the meta line. On an
obscure or foreign title, *"1964 · French film"* identifies it better than
a name you've never heard. The demonym is used, not the country — "French
film", not "France film" — taken from one country rather than every
co-producer, or The Umbrellas of Cherbourg reads as West German.

**Credited, no record** is the third state. TMDB names people Wikidata has
never heard of; they are listed, shown with an em-dash where a lifespan
would be, and deliberately not counted either way. Counting them as living
or as dead would both be a guess.

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
