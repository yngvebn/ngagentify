#!/usr/bin/env bash
set -euo pipefail

# Kill anything on port 4200 before starting
if lsof -ti tcp:4200 >/dev/null 2>&1; then
  echo "  Killing process on port 4200..."
  kill $(lsof -ti tcp:4200) 2>/dev/null || true
  sleep 0.5
fi

# Ensure packages are built
bash scripts/build.sh

# Start Angular dev server (custom builder handles WebSocket + manifest)
cd demo && ng serve --port 4200
