# Operations

Everything below assumes credentials are loaded:

```sh
. ~/.picture-wrap.env
```

That file lives in your home folder, outside the repo, holding the Bluesky
handle and app password, the TMDB key, the site URL, the archive path, the
ntfy topic and the watched newsrooms. It is `chmod 600` and must never move
into the project.

There are three launchers in `~/Desktop/picture-wrap-assets/` that do the
sourcing for you: `picture-wrap-preview`, `picture-wrap-review`,
`picture-wrap-watch`. Each is a two-line pointer at a script in `poster/`,
so the logic stays under version control instead of drifting in a copy on
the Desktop.

**The watcher is started by hand, on purpose.** Running it as a launchd
agent was tried and reverted: the repository lives under `~/Desktop`,
which macOS gates behind TCC, so a background agent cannot even read its
own launcher — it fails silently at exit 127 and no permission prompt
ever appears. Enabling it would mean granting Full Disk Access to
`/bin/zsh`, which is every script anything runs through zsh, forever.

That is a wide door for one listener, and the listener has never fired on
a real death. `poster/watch.command` restarts node if it dies and drops
the Bluesky password from its environment — it talks to a public firehose
and cannot post — but you decide when it is listening.

The same TCC gate blocks the cron lines below. Nothing is scheduled
today; every run this project has ever done was typed by hand.

---

## Three speeds

| | Latency | Setup |
|---|---|---|
| **Watcher** | minutes | `watch.js`, left running |
| **Hourly sweep** | ~1 hour | cron |
| **Monthly wide sweep** | catches late entries | cron |

```cron
0 * * * *   . ~/.picture-wrap.env && cd ~/Desktop/dev.nosync/picture-wrap/poster && node run.js --days 1 >> sweep.log 2>&1
0 4 1 * *   . ~/.picture-wrap.env && cd ~/Desktop/dev.nosync/picture-wrap/poster && node run.js --days 730 >> sweep.log 2>&1
```

The monthly one is not optional. The sweep asks for deaths whose **date**
falls in a window, so a death recorded weeks later never appears in any
daily run and the closing is missed permanently. Late entries are commonest
for minor figures — exactly the people who close old pictures.

---

## Breaking news

`watch.js` listens to a set of newsrooms on Bluesky's firehose. When one
reports a death it resolves the name, asks whether that person closes
anything, drafts the posts and pushes your phone.

It runs **ahead of Wikidata**, because the wrap test doesn't need the new
death date — everyone else on the picture is already recorded.

```sh
node watch.js                     # or the Desktop launcher
node watch.js --test "Some Name"  # pretend that name was just reported
```

Drafts land flagged `provisional`, and `review.js` shows them with a loud
**UNCONFIRMED** banner. A newsroom said so; Wikidata hasn't caught up.

Alerts go to [ntfy.sh](https://ntfy.sh) — install the app, subscribe to the
topic in `PW_NOTIFY`. Anyone who guesses the topic name can read them, so
pick an obscure one.

---

## Reviewing

```cron
0 9 * * *   cd /path/to/poster && /usr/local/bin/node run.js >> sweep.log 2>&1
```

```sh
node preview.js            # render the queue as a web page, images and all
node review.js --list      # what's waiting
node review.js             # work through it
node review.js --dry-run   # rehearse; posts nothing, writes nothing
```

**Preview first.** The terminal shows text; the images are half the post.
`preview.js` writes a page showing every queued post as it will read, with
the real portrait and posters, threaded the way Bluesky threads them.
Hovering an image shows its alt text.

At each item: `[p]ost it` `[s]kip for now` `[n]ever` `[e]dit` `[q]uit` —
whole words work too. Skip leaves it queued, never removes it permanently,
quit is safe.

`--yes` is refused on a real posting run. It works only with `--dry-run` or
`--archive-only`, neither of which can publish. A flag that skips the human
is a flag that eventually gets used at 2am on something that shouldn't have
gone out.

**Posting order matters.** The queue is sorted oldest death first, so the
profile reads newest-to-oldest top to bottom. Four seconds between threads.

### Afterwards

```sh
cd ~/Desktop/dev.nosync/picture-wrap
git add archive.json && git commit -m "vault: …" && git push
```

**This is manual.** Nothing pushes for you, and until you do, the Vault
won't show what was posted.

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

## Filing without posting

Backfill produces history, not news: of 918 backfilled closings, 13 had
happened since 2020. Announcing the rest would be a bulk import with a
megaphone.

```sh
node review.js --archive-only    # files the queue into the Vault, posts nothing
node review.js --archive-only --yes
```

Entries land with `postedAt: null` and `filedOnly: true`, so the archive
records which were imported rather than announced. Checkpoints every 200
and runs four lookups at a time.

---

## Backfill

Pictures that closed before the poster existed will never fire an event —
there is no future death to react to. Run once:

```sh
node run.js --backfill 1946-1965
node run.js --backfill 1946-1965 --resume    # after an interruption
```

**The range in that command is the coverage.** This example used to read
`1930-1965`, which had never been run — 1930–1945 is what `state.json`
records as done, and anyone reading the old line came away believing the
Vault reached 1965. Write the range you are actually about to run.

**Two passes per year**, because the direct question is too expensive: a
cast-only rollup to find candidates, then the exact crew-inclusive test on
each. The crew-inclusive per-year query times out at 65 seconds.

Expect roughly 30s per year plus ~0.5s per candidate. For scale, 1930
produced 727 films with cast data and 206 candidates worth testing.

Progress is saved after every year. `--resume` skips completed years, and
`state.json` makes any re-run cheap regardless.

**Expect a large queue afterwards.** Run `--list` before `review.js`, and
file it with `--archive-only` rather than posting.

The backfill runs the same TMDB verification as the sweep, so it will not
refill the Vault with false closings.

**Coverage of the archive so far: 1930–1945 releases only** — 98.5% of
the Vault, with a cliff at the boundary: 230 entries from 1945, two from
1946. See
[BACKLOG.md](BACKLOG.md) for what extending it would take.

---

## The corpus pass

A different kind of run from everything below: not "what closed this
week" but "judge every picture ever released, and write down why".

    export TMDB_KEY=...
    export PW_PASS=/path/for/working/files          # local, fast, disposable
    export PW_PASS_ARCHIVE=~/Desktop/picture-wrap-evidence   # synced, durable

    node pass.js --year 1924                 one year
    node audit.js --year 1924                re-decide it from its own files
    node rebuild.js --years 1890-2026        re-derive offline after a rule change
    node enrich.js --year 1924               genre and country
    node enrich.js --countries               the country label dictionary
    node build-corpus.js                     pass output → dist/

**A whole corpus is a shell loop over years**, and should be, because the
unit of resumption is the year. Skip anything already archived and a
relaunch costs nothing:

    for y in $(seq 1890 2026); do
      [[ -f "$PW_PASS_ARCHIVE/$y.jsonl.gz" ]] && continue
      node pass.js --year $y --concurrency 5
      node audit.js --year $y
    done

Run it detached, not as a foreground job: `nohup ... & disown`, logging to
a file. The 1 August run was killed three times — twice by a harness
reaping background tasks — and lost one partially-written year each time,
because a finished year is a sealed `.gz` and the runner's only state is
which of those exist. On a laptop add `caffeinate -ims -w <pid>`, which
releases when the run does.

**Timing.** Roughly 10 minutes a year averaged over the century, but the
shape is counter-intuitive: the expensive years are the old small ones,
not the huge modern ones. One living person on Wikidata short-circuits
the TMDB test, so a 1975 year with 3,452 pictures needed 745 survivor
tests and a 1988 year of the same size needed 413. Whole corpus: about
twenty hours.

**Order after a run.** Rebuild before building: years judged early were
decided under earlier rules, and `rebuild.js` re-decides them from stored
evidence with no network. Then `enrich.js --countries`, then
`build-corpus.js`.

### Deploying the corpus

`dist/` is never committed. Everything under `v/<version>/` is immutable
and `manifest.json` is the only mutable object, so **copy the tree first
and the manifest last** — until the manifest names a version, that version
is invisible, which makes a half-finished upload harmless.

    rclone copy dist/v r2:picture-wrap/v
    rclone copy dist/manifest.json r2:picture-wrap/

Old versions can be deleted whenever nothing references them. Rollback is
a one-file write.

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

**A picture can un-wrap.** If someone adds a living cast member to
Wikidata, that title's page shows it correctly — pages are live — while
the Vault still lists it as closed from when it was filed.

```sh
node recheck.js --dry-run    # report only
node recheck.js              # remove any that reopened
```

It backs up `archive.json` first, and clears reopened ids from
`state.seen` so they can close again later — without that they would be
permanently invisible to the sweep.

Its first run removed **278 of 2,752** entries.

### Measure coverage — occasionally

```sh
node coverage.js --limit 50   # try it on fifty first
node coverage.js              # all of them
```

Records how complete Wikidata's cast list is for each Vault entry, against
TMDB. Shows median coverage and the thinnest records. Nothing gates on it;
it is context for a human reading the queue.

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
| Sweep queues hundreds of films | `MIN_CAST` bypassed | A 45-day window with no floor queued 540, 397 with zero cast on record. |
| A picture is announced that has living cast | A path skipped the TMDB check | See the six paths in DECISIONS.md. |
| Vault stale after posting | `archive.json` not committed | `git add archive.json && git commit && git push`. |
| Site shows an old version | Browser cache | Bump `?v=` on both tags in `index.html`. |

One bad person in a sweep never ends the run — the error is logged and the
sweep continues. Films are recorded as seen, people never are, so anyone who
errored is re-checked on the next run.

---

## Deploying the site

**GitHub Pages, from `main`**, at
[picture-wrap.com](https://picture-wrap.com), HTTPS enforced.

```
repo     github.com/jacobeugenehenderson/picture-wrap
serves   index.html  style.css  app.js  shared.js  archive.json
CNAME    picture-wrap.com
```

Push to `main` and it rebuilds. There is no build step — Pages serves the
files as they are, which is what `.nojekyll` guarantees.

**Bump `?v=` on both tags in `index.html`** whenever `app.js` or
`style.css` changes. Browsers cache them hard; without a new URL, returning
visitors keep the old version. `archive.json` is fetched with
`cache: 'no-cache'` and needs no bump.

Locally:

```sh
python3 -m http.server 8000
```

It must be **served**, not opened from disk, or the browser blocks the
cross-origin calls and the ES module import.

### If the certificate stalls

GitHub sometimes leaves a new domain at `certificate state: none`
indefinitely. Clearing and re-setting the custom domain restarts issuance —
it went from stuck to issued in one minute.

---

## Verification status

**Exercised end to end.** Thirteen threads posted on 2026-07-28 — 26 posts,
facets rendering as live links, portraits and posters attached, `archive.json`
written, the Vault at 2,819. The sweep, the backfill, filing, the re-check,
the recovery pass, coverage measurement and the watcher's connection have
all run against live data.

**Not yet exercised:** the watcher firing on a real newsroom report. It has
been tested with `--test` and its connection verified, but no actual death
has come through it. The first one is worth watching rather than trusting.

**Alt text is a placeholder.** "Ann Blyth" is a caption, not a description.
See [BACKLOG.md](BACKLOG.md).

---

## Keeping the halves in step

**`shared.js` is the single source of truth** for the credit properties,
search filters, label languages and pure helpers. Both halves import it as
a native ES module — the browser and Node read the same file, with no
build step.

Change it once and both follow. Before it existed the definitions had
already drifted: eight crew properties on the site, ten including cast in
the poster, in different shapes.

**What stays separate:** anything that fetches. The poster sends a
User-Agent and retries on 429; the browser can do neither.

**The rule that must not be broken:** every path that concludes a picture
has closed verifies against TMDB first. There are six, listed in
[DECISIONS.md](DECISIONS.md). This has been missed three times — for the
sweep, the person page, and the watcher — and each time it produced false
claims about whether real people are alive.


## Keeping the machine awake

Long runs die if the Mac sleeps. `caffeinate` holds it open. The useful
form ties the assertion to the process, so it releases by itself:

```sh
caffeinate -i -m -w $(pgrep -f "run.js --backfill" | head -1)
```

Or wrap the command, which is tidier and needs no PID:

```sh
caffeinate -i node run.js --backfill 1930-1945
```

| | |
|---|---|
| `-i` | no idle sleep |
| `-d` | no display sleep — usually not wanted; the screen can lock |
| `-m` | no disk sleep |
| `-w PID` | hold until that process exits |
| `-t N` | hold for N seconds |

Confirm it is actually holding:

```sh
pmset -g assertions | grep PreventUserIdleSystemSleep
```

Laptops on battery still sleep when the lid closes, regardless. The iMac
this runs on has no lid, so `-i -m -w` is sufficient.

## Recovering an interrupted backfill

`run.js --backfill` saves `state.json` and `queue.json` at the end of each
year, so an interruption costs at most one year.

- **`--resume`** skips years already in `state.yearsDone`.
- **Without `--resume`** it redoes every year in the range — but
  `state.seen` still holds everything already considered, so previously
  handled films are skipped instantly and only newly-found ones cost time.
  This is the right mode after a *finder* fix.
- **After a *verification* fix**, neither is enough: films already judged
  are in `state.seen` and will not be re-offered. Restore `state.json` from
  a backup taken before the bad run, discard the queue it produced, and
  start over. This is what was done on 28 July 2026.

Back up before any run that writes:

```sh
cp poster/state.json poster/state.json.before-<name>
cp archive.json archive.json.before-<name>
```

`queue.json.old-check` holds 265 entries produced by the broken
verification on 28 July 2026. Kept only as evidence — do not review it.

## What can and cannot happen unattended

Worth being explicit, because it is what makes it safe to leave running.

| | |
|---|---|
| `run.js` | writes `queue.json` and `state.json`. **Cannot post.** |
| `watch.js` | writes `queue.json`. **Cannot post.** |
| `recheck.js` | rewrites `archive.json`, backing it up first. Deletes entries. |
| `review.js` | the only script holding Bluesky credentials. Needs a human. |

Nothing reaches `archive.json` except through `review.js` or `recheck.js`.
Nothing reaches Bluesky except through `review.js`, one keypress at a time.
