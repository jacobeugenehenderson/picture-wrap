# Hosting, and the per-picture link preview

*Written 4 August 2026, after scoping the move and deciding not to make
it that night. Nothing here is urgent. It is written to be picked up cold.*

## Where things actually stand

**Link previews work.** Paste picture-wrap.com anywhere — iMessage, Slack,
WhatsApp, Bluesky — and you get a real card: the gold bar, the wordmark,
*The picture wraps twice*, the domain. `og:` and `twitter:` tags are in
`index.html` and `card.png` is drawn by `make-card.py`.

**The exception is that every card is the same card.** A link to *Mildred
Pierce* previews identically to a link to the front page. That is the only
thing left, and it is genuinely an exception rather than a gap: most links
anyone pastes are the front page, and the ones that are not still draw a
correct, handsome card that says what the site is.

So this is a next-phase item, not a defect.

## Why it is not a hosting problem

The backlog carried this as *"move the site to Cloudflare Pages and a
Function can answer crawlers with real `og:` tags."* **That plan does not
work as written**, and the reason is worth stating plainly before anybody
spends a weekend on it.

`app.js` routes on `location.hash`. A URL is
`picture-wrap.com/#/mildred-pierce/Q979726`, and **the fragment is never
sent to a server** — not to Cloudflare, not to GitHub, not to anyone. A
crawler asking for that URL sends `GET /`. There is nothing for a Function
to read.

Moving hosts does not change that. **The id has to be in the path first.**
Everything else here is downstream of that one fact.

## What a move would still buy

Not previews, but not nothing:

- **One host instead of two.** Today a change to what a closing says needs
  `wrangler pages deploy` *and* `git push`, and forgetting the first is
  the easiest mistake this project offers.
- **CORS could relax.** The corpus would be same-origin instead of a
  cross-origin fetch from `picture-wrap-corpus.pages.dev`.
- **Functions become available at all**, which is the prerequisite for the
  preview work and for anything else server-shaped later.

## Three ways to go

### C — Path routing. The one that actually delivers previews.

Not a hosting question. Add real paths — `/x/Q979726` — while keeping
`#/x/Q979726` working forever, so the 26 Bluesky posts and every shared
link survive. Share buttons start emitting paths. The router already finds
the Q-id wherever it sits in the URL, which is most of the work.

Reversible, touches no infrastructure, provable locally. **This is the
prerequisite for A and B both.**

### A — A Worker in front, GitHub Pages stays the origin.

Nameservers move to Cloudflare; a Worker answers crawler requests with
per-picture `og:` tags read from the corpus, and passes everyone else
through to GitHub Pages untouched.

Smallest infrastructure change. The site does not move. Reversible by
unproxying. Does not collapse the two hosts.

### B — Full move to Cloudflare Pages.

One host, CORS relaxes, Functions everywhere.

**The cost worth naming:** Pages deploys a *directory*, and the site files
sit at the repo root beside `pass/` (1.8 GB), `node_modules/` and `docs/`.
So it needs a deploy directory assembled first — which is a build step,
and `README.md` says of this project: *"No backend, no build step, nothing
shipped that it didn't write."* That property has been load-bearing for a
year. Trading it for one fewer deploy command is defensible and should be
a decision rather than a side effect.

## What the DNS actually looks like

Verified 9 August, after moving mail to Google Workspace. **The nameservers
are at Namecheap, not Cloudflare**, which is what makes A and B bigger than
they sound:

```
NS     dns1.registrar-servers.com, dns2.registrar-servers.com
A      185.199.108.153 .109 .110 .111        GitHub Pages
www    CNAME jacobeugenehenderson.github.io
MX     1 smtp.google.com                     Google Workspace
TXT    v=spf1 include:_spf.google.com ~all
TXT    google-site-verification=...          domain ownership
TXT    google._domainkey → v=DKIM1; ...      DKIM signing
```

Mail is `max@picture-wrap.com`, an alias on the `jacobhenderson.studio`
Workspace account — `picture-wrap.com` is attached there as a **secondary
domain**, so the alias costs no seat. It lands in the same inbox and can
send as itself. Namecheap's own email forwarding is **off**; the MAIL
SETTINGS dropdown on Advanced DNS is set to *Custom MX*, which is what
makes MX editable at all. The old `eforward*` records are gone and should
not come back.

A Cloudflare Pages custom domain on the **apex** needs the zone on
Cloudflare's nameservers. So A and B both begin with a nameserver move,
and a nameserver move means **recreating the MX record and all three TXT
records by hand**.

> **The hazard:** miss them and mail to `max@picture-wrap.com` stops
> arriving, silently, with no error anywhere. Nothing on the site would
> look wrong. Write the records down before changing anything, and check
> mail after.

That step belongs to whoever owns the registrar login. It is not something
to automate.

> **A second hazard, learned the hard way on 9 August.** Namecheap's
> Advanced DNS editor commits the **whole table** on SAVE ALL CHANGES. If
> the table is showing fewer rows than the zone actually has, saving
> deletes the difference. Editing the MX rows took the four `A` records
> and the `www` CNAME with them, and the site stopped resolving entirely —
> not a slow failure, an immediate NXDOMAIN.
>
> It was a two-minute fix only because the records above had been `dig`ged
> and written down first. Do that before touching anything, and re-check
> the full zone after every save, not just the row you meant to change.

## The order to do it in

1. **C, path routing.** Delivers the previews. No infrastructure, no DNS,
   no downtime, reversible. Do this alone and the exception closes for
   anyone crawling a path URL.
2. **A, the Worker**, when there is an unhurried hour for the nameserver
   move and the mail records.
3. **B** only if collapsing to one host is wanted for its own sake, with
   the build-step trade made deliberately.

Do not start at A or B. Without C they buy tidiness and no previews.

## What would be built, concretely

For C:

- `path()` in `shared.js` emits `/x/<slug>/<id>` alongside the hash form.
- The router reads `location.pathname` as well as `location.hash`; it
  already finds the Q-id wherever it appears, so this is mostly plumbing.
- `history.pushState` on navigation, with the hash form kept as a
  permanent redirect target rather than deleted.
- GitHub Pages needs a `404.html` that serves the app, since it has no
  rewrite rules — that is how a static host fakes path routing today, and
  it is ugly but it works and needs no move.

For A, additionally:

- A Worker that recognises crawler user-agents, reads the picture from the
  corpus by id, and returns a minimal HTML head with `og:title`,
  `og:description` and the existing `card.png`. Everyone else passes
  through.
- Per-picture card *images* are a separate and much larger question. Text
  alone is most of the value.

## What is already true and should not be re-litigated

- Site-wide previews are live and correct.
- `card.png` carries no count, deliberately: a figure baked into a
  committed PNG goes stale and nothing would catch it.
- The `og:` description is deliberately not the same string as
  `<meta name="description">` — a card is read in a second beside an
  image, a search result is read cold.
