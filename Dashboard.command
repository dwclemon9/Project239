#!/bin/bash
# Double-click this in Finder to open your training dashboard.
# If the dashboard is not running yet, this starts it first.
cd "$(dirname "$0")" || exit 1

PORT="${PORT:-3000}"
LABEL="com.project239.dashboard"
URL="http://localhost:$PORT/"

if curl -fsS -o /dev/null "$URL"; then
  open "$URL"
  exit 0
fi

echo "Starting the dashboard..."

# Prefer the login job if it is installed; otherwise run the server directly.
if launchctl print "gui/$UID/$LABEL" >/dev/null 2>&1; then
  launchctl kickstart -k "gui/$UID/$LABEL"
else
  nohup ./scripts/mac/serve.sh > "$HOME/Library/Logs/Project239.log" 2>&1 &
fi

for _ in $(seq 1 90); do
  if curl -fsS -o /dev/null "$URL"; then
    open "$URL"
    echo "Dashboard is up. You can close this window."
    exit 0
  fi
  printf '.'
  sleep 2
done

echo ""
echo "The dashboard did not start. See ~/Library/Logs/Project239.log"
echo "Press any key to close."
read -r -n 1
exit 1
