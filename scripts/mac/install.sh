#!/bin/bash
# Sets the dashboard up to run at login, so http://localhost:3000 is simply
# always there. Safe to run more than once — re-running updates the setup.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LABEL="com.project239.dashboard"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs"
PORT="${PORT:-3000}"

if [ "$(uname)" != "Darwin" ]; then
  echo "This installer is for macOS. On other systems run 'npm run dev'." >&2
  exit 1
fi

# --- Node ------------------------------------------------------------------
# launchd starts with a bare PATH, so the node in use has to be found now and
# written into the job. A node installed via nvm lives in your shell profile
# only, and would otherwise be invisible at login.
if ! command -v node >/dev/null 2>&1; then
  echo "Node is not installed. Install it from https://nodejs.org (LTS) and re-run." >&2
  exit 1
fi

NODE_BIN="$(cd "$(dirname "$(command -v node)")" && pwd)"
NODE_VERSION="$(node -p 'process.versions.node')"
NODE_MAJOR="${NODE_VERSION%%.*}"
NODE_MINOR="$(node -p "process.versions.node.split('.')[1]")"
if [ "$NODE_MAJOR" -lt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 6 ]; }; then
  echo "Node $NODE_VERSION is too old — this needs 22.6 or newer." >&2
  exit 1
fi

case "$NODE_BIN" in
  *"/.nvm/"*)
    echo "Note: node is from nvm ($NODE_BIN)."
    echo "      That exact path is baked into the login job, so if you later"
    echo "      switch node versions with nvm, re-run this installer."
    ;;
esac

echo "Using node $NODE_VERSION from $NODE_BIN"
mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

# --- The login job ---------------------------------------------------------
cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$REPO/scripts/mac/serve.sh</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$REPO</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$NODE_BIN:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>PORT</key>
    <string>$PORT</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/Project239.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/Project239.log</string>
</dict>
</plist>
PLIST_EOF

plutil -lint "$PLIST" >/dev/null

# Replace any previous copy of the job, then start this one.
launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$UID" "$PLIST"
launchctl kickstart -k "gui/$UID/$LABEL"

# --- Wait for it to answer -------------------------------------------------
echo -n "Starting the dashboard (the first build takes a moment)"
for _ in $(seq 1 90); do
  if curl -fsS -o /dev/null "http://localhost:$PORT/"; then
    echo ""
    echo ""
    echo "Dashboard is running at http://localhost:$PORT"
    echo "It will start again automatically every time you log in."
    echo ""
    echo "Tip: open it in Safari, then File > Add to Dock, and you get a real"
    echo "     app icon with no browser chrome and no Terminal window."
    echo ""
    echo "  Stop it:  npm run mac:uninstall"
    echo "  Logs:     $LOG_DIR/Project239.log"
    open "http://localhost:$PORT/" 2>/dev/null || true
    exit 0
  fi
  echo -n "."
  sleep 2
done

echo ""
echo "The server did not come up within about three minutes." >&2
echo "The log usually says why: $LOG_DIR/Project239.log" >&2
echo "Last 20 lines:" >&2
tail -20 "$LOG_DIR/Project239.log" >&2 2>/dev/null || true
exit 1
