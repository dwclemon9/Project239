#!/bin/bash
# Stops the dashboard and removes it from login. Your training log is left
# completely untouched — this only removes the background job.
set -uo pipefail

LABEL="com.project239.dashboard"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "gui/$UID/$LABEL" 2>/dev/null \
  || launchctl unload "$PLIST" 2>/dev/null \
  || true
rm -f "$PLIST"

echo "Dashboard stopped and removed from login."
echo "Your training log in data/training.db was not touched."
echo "Run 'npm run mac:install' to set it up again, or 'npm run dev' to start it by hand."
