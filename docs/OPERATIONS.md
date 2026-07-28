# Operations

## Daily

```cron
0 9 * * *   cd /path/to/poster && /usr/local/bin/node run.js >> sweep.log 2>&1
```

Then, whenever you feel like it:

```sh
node review.js --list      # what's waiting
node review.js             # work through it
node review.js --dry-run   # rehearse; posts nothing, writes nothing
```

At each item: `[a]pprove` `[s]kip` `[r]eject` `[e]dit` `[q]uit`.
Skip leaves it queued. Reject removes it permanently. Quit is safe.

**You review posts, not films.** One death closes several pictures at once,
so the queue is grouped by person and date — 182 pictures from the 1930
backfill became 144 posts. Every action applies to the whole group, and each
picture's Wikidata link is printed separately so you can check them all.

**Open the Wikidata links printed with each item.** That is the job. The
queue exists so a human looks at the evidence before a claim is published.

---

## Environment

```sh
export BSKY_HANDLE="picture-wrap.bsky.social"
export BSKY_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"   # app password, not account
export PW_SITE="https://picture-wrap.com"      # used in the post link
export PW_ARCHIVE="/path/to/site/archive.json"   # write where the site reads
```

An app password comes from Settings → Privacy and security → App passwords.
It can be revoked on its own; your account password cannot.

Put a real contact address in the `AGENT` string in `poster/lib.js`.

---

## Backfill

Films that closed before the poster existed will never fire an event — there
is no future death to react to. Run once:

```sh
node run.js --backfill 1930-1965
node run.js --backfill 1930-1965 --resume    # after an interruption
```

**Two passes per year**, because the direct question is too expensive: a
cast-only rollup to find candidates, then the exact crew-inclusive test on
each. The crew-inclusive per-year query times out at 65 seconds.

Expect roughly 30s per year plus ~0.5s per candidate. For scale, 1930
produced 727 films with cast data and 206 candidates worth testing.

Progress is saved after every year. `--resume` skips completed years, and
`state.json` makes any re-run cheap regardless.

**Expect a large queue afterwards.** Run `--list` before `review.js`.

---

## Maintenance

Two jobs the daily sweep cannot do. Both are cheap and neither is urgent,
but skipping them leaves quiet, permanent errors.

### Catch backdated deaths — monthly

The sweep asks for deaths whose **date** falls in the last N days. If
someone died in 2019 and an editor only records it next week, that death
never appears in any window and the closing is missed permanently.

This is not an edge case: late entries are commonest for minor figures,
who are exactly the people who close old pictures.

```cron
0 9 * * *   node run.js --days 3      # daily
0 4 1 * *   node run.js --days 730    # monthly, catches late entries
```

`state.json` makes the wide run cheap — anything already considered is
skipped, so it only surfaces genuinely new records.

### Re-check the Vault — monthly

**A picture can un-wrap.** If someone adds a cast member to Wikidata who is
still alive, that title's page immediately shows the bar below the top —
correctly, because pages are live — while the Vault still lists it as
closed from when it was filed. Page and index disagree.

Obscure old films are both where people add missing cast and what fills
the Vault, so this will happen.

There is no script for it yet. The check is one `wrappedFilmsQuery` per
Vault entry — fast individually, ~2,000 of them — dropping any that now
have a survivor. Worth writing before the Vault is public for long.

---

## Failure modes

| Symptom | Cause | Action |
|---|---|---|
| `WDQS 429` / `503` | Rate limited or service busy | Automatic — retries with backoff. Repeated failures: widen sleeps in `lib.js`. |
| A year fails during backfill | Query timeout | Logged, run continues. Re-run with `--resume`. |
| `Set BSKY_HANDLE and…` | Credentials missing | Export them. `--dry-run` needs none. |
| Post fails | Network, auth, or over 300 bytes | Item stays queued. Byte count shows before you approve. |
| Same film offered twice | Shouldn't happen | `state.json` records films when *considered*. Check it wasn't deleted. |
| Site shows an empty archive | `archive.json` not where the site fetches it | Set `PW_ARCHIVE`, or copy the file. |
| Every film says "the record is thin" | `MIN_CAST` set too high | It's 5. Below that, records are stubs. |

One bad person in a sweep never ends the run — the error is logged and the
sweep continues. Films are recorded as seen, people never are, so anyone who
errored is re-checked on the next run.

---

## Deploying the site

Three static files plus `archive.json`. Any host. It must be **served**, not
opened from disk, or the browser blocks the cross-origin calls.

```sh
python3 -m http.server 8000     # local check
```

There is no build step. Edit the files, upload the files.

`archive.json` is the only thing that changes after a review. If the poster
runs elsewhere, that one file is all that needs to travel.

---

## Verification status

Honest record of what has and hasn't been exercised.

**Verified live:** every SPARQL query; the daily sweep end-to-end; the
`MIN_CAST` rejection path; the unlabelled-film guard; the queue listing; post
composition with and without a character name; byte counts; CORS on both
endpoints; all four assets serving over HTTP; archive rendering against 26
real entries; backfill producing real closings.

**Not verified:** the approve branch in `review.js` — the step that posts and
writes `archive.json`. Node's readline discards piped input before
`question()` registers, so it could not be driven without a terminal. The
archive record's *shape* was confirmed by replicating the builder against a
live queued item.

**Do this on first real use:** run `review.js --dry-run`, approve one item,
confirm `queue.json` is untouched. Then run it for real on a single item and
check both the post and `archive.json`.

**Never verified in a browser.** The entire visual layer has been written but
not seen. Spacing is the likeliest thing to need adjustment.

---

## Keeping the halves in step

`CREDITS` and the minimum-cast rule exist in **both** `poster/lib.js` and
`app.js`. There is no shared module — that would require a build step, which
the project doesn't have.

If you change which credits count, or the floor, change both. A mismatch
means the site and the poster disagree about whether a film has wrapped,
which is the most confusing possible bug.
