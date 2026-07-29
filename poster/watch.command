#!/bin/zsh
# ==========================================================================
# PICTURE WRAP — the watcher, started by hand
#
# Deliberately a button and not a background service. A launchd agent was
# tried and reverted: it needed Full Disk Access for /bin/zsh, which is a
# wide door to open for one listener, and it would have run unattended a
# process that has never yet fired on a real death. Its own docs say the
# first real catch is worth being at the keyboard for.
#
# So: you decide when it listens. While it listens, it looks after itself.
#
# The Desktop launcher points at this file, so the logic lives here, under
# version control, rather than in a copy on the Desktop that drifts.
# ==========================================================================

set -a
source "$HOME/.picture-wrap.env"
set +a

# watch.js talks to Bluesky's public firehose, which needs no credentials,
# and it cannot post — review.js is the only thing that can. So it has no
# business holding the posting password for however many hours this runs.
unset BSKY_HANDLE BSKY_APP_PASSWORD

cd "$(dirname "$0")"
LOG="watch.log"

clear
echo "PICTURE WRAP — watching the newsrooms"
echo ""
echo "  Leave this window open. It listens for death reports and pushes"
echo "  your phone when one closes a picture. It never posts."
echo ""
echo "  Logging to poster/$LOG · Ctrl-C to stop."
echo ""

# watch.js reconnects when the socket drops, which is routine. This is for
# what it cannot handle from the inside — node itself dying. Ten seconds is
# enough to avoid a spin if the failure is immediate and permanent.
while true; do
  node watch.js 2>&1 | tee -a "$LOG"
  echo "$(date '+%H:%M:%S') watcher exited — restarting in 10s" | tee -a "$LOG"
  sleep 10
done
