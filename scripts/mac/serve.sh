#!/bin/bash
# Runs the dashboard. Started by the LaunchAgent at login, and safe to run by
# hand. Two things it is careful about:
#
#   * It only rebuilds when the checkout has actually changed, so logging in
#     puts the dashboard up in a second rather than waiting on a build.
#   * It builds into a staging directory and swaps that in only once the build
#     succeeds. `next build` empties its output directory before it starts, so
#     building straight into .next would leave you with no dashboard at all
#     whenever a build failed.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO" || exit 1

PORT="${PORT:-3000}"
STAGING=".next-build"
STAMP_FILE=".next-build-stamp"

if [ ! -d node_modules ]; then
  echo "[project239] installing dependencies"
  npm install --no-audit --no-fund || exit 1
fi

# What the current checkout is, so we can tell whether the build is stale.
stamp() {
  printf '%s %s' \
    "$(git rev-parse HEAD 2>/dev/null || echo no-git)" \
    "$(shasum package-lock.json 2>/dev/null | cut -d' ' -f1)"
}
CURRENT="$(stamp)"

have_build() { [ -f .next/BUILD_ID ]; }
build_is_current() { [ -f "$STAMP_FILE" ] && [ "$(cat "$STAMP_FILE")" = "$CURRENT" ]; }

if have_build && build_is_current; then
  echo "[project239] build is up to date"
else
  echo "[project239] building"
  rm -rf "$STAGING"
  if NEXT_DIST_DIR="$STAGING" npm run build; then
    rm -rf .next
    mv "$STAGING" .next
    printf '%s' "$CURRENT" > "$STAMP_FILE"
    echo "[project239] build ready"
  else
    rm -rf "$STAGING"
    if ! have_build; then
      echo "[project239] build failed and there is no previous build to fall back on" >&2
      exit 1
    fi
    echo "[project239] build failed — serving the previous build" >&2
  fi
fi

echo "[project239] serving on http://localhost:$PORT"
exec npx next start --port "$PORT"
