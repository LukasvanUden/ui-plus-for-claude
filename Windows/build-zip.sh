#!/bin/bash
# Builds build/UI-Plus-for-Claude-Windows.zip: install.cmd, uninstall.cmd,
# ui-plus.ps1 and Extension/. Runs on macOS, Linux or Git Bash.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/build/windows/UI+ for Claude"
rm -rf "$ROOT/build/windows" && mkdir -p "$OUT"
cp "$ROOT/Windows/install.cmd" "$ROOT/Windows/uninstall.cmd" "$ROOT/Windows/ui-plus.ps1" "$OUT/"
cp -R "$ROOT/Extension" "$OUT/Extension"
(cd "$ROOT/build/windows" && rm -f ../UI-Plus-for-Claude-Windows.zip && zip -qr ../UI-Plus-for-Claude-Windows.zip "UI+ for Claude")
echo "Built: $ROOT/build/UI-Plus-for-Claude-Windows.zip"
