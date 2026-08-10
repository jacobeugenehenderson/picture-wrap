# Diary

What it was actually like to do a thing, kept out of the reference docs so
those can stay short and true. Nothing here is a decision or a fact about
the archive — look in `DECISIONS.md` and `FINDINGS.md` for those. This is
for the traps, the wrong turns, and the hour lost to a dropdown.

Newest first.

---

## 9–10 August 2026 — moving mail to Google, and taking the site down doing it

The job was small: an address at the project's own domain. It took an
evening, and two of the three hard parts were interfaces rather than DNS.

### The site went down for a few minutes, and it was the editor

Namecheap's Advanced DNS page commits the **whole table** on SAVE ALL
CHANGES. Switching mail from the built-in forwarding to Custom MX left the
table showing fewer rows than the zone actually had, and saving deleted the
difference — the four GitHub Pages `A` records and the `www` CNAME went
with the MX rows. Not a slow degradation: an immediate NXDOMAIN, the
domain not resolving at all.

It was a two-minute fix only because the whole zone had been `dig`ged and
written down before anything was touched. That habit is now the standing
advice in `HOSTING.md`; this is why it's there.

The lesson generalises past this registrar: **re-check the entire zone
after every save, not the row you meant to change.**

### Google's DKIM page reissues the key

The panel that generates a DKIM key regenerated it at some point between
sessions, so the key in DNS and the key Google was checking for were
different strings. The error says the DNS record is wrong. The DNS record
was not wrong — it was correct at every resolver the entire time, and had
been byte-compared against what the panel had shown an hour earlier.

Before pasting anything at the registrar, compare the on-screen value to
what `dig TXT google._domainkey.<domain>` returns. Two keys were generated
for `.social` this way.

### The domain pulldown resets, and that cost the most

The same page's **Selected domain** pulldown reverts on reload, and every
failed attempt reloads it. So the button authenticates whatever the
pulldown reverted to, and the failure message names no domain — which
reads as "your DNS is wrong" for a domain you weren't even looking at.

**The tell is speed.** A real lookup takes a moment. An instant red banner
means it never checked. Reselect the domain immediately before every press.

This was the whole of the second evening, and the fix was reselecting a
dropdown.

### What actually went right

`dig` against the authoritative nameservers, before and after every single
change. Every failure in this whole exercise was diagnosed by comparing
what the zone served to what a vendor claimed it wanted, and the one real
outage was survivable because the baseline existed on disk. Namecheap
pushes zone edits on about a 30-second interval, so "it didn't save" and
"it hasn't pushed yet" look identical for half a minute — poll, don't
re-edit.
