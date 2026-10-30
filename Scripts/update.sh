#!/bin/bash
# Updates UI+ for Claude installed from a git clone: pulls the latest
# version, builds the app, replaces the one in Applications, and opens it once
# so it refreshes the extension.
set -euo pipefail

APP="UI+ for Claude.app"
cd "$(dirname "$0")/.."
/usr/bin/git pull --ff-only
/bin/bash Scripts/build-app.sh
/bin/rm -rf "/Applications/$APP"
/usr/bin/ditto "build/$APP" "/Applications/$APP"
/usr/bin/open "/Applications/$APP"
echo "UI+ for Claude is updated. Quit Claude (Cmd+Q) and open it again."
