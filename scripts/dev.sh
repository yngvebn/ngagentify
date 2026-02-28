#!/usr/bin/env bash
set -euo pipefail

PIDFILE=".ng-annotate/dev-server.pid"

echo "▶ Starting ng-annotate dev server..."

# Kill existing server from pidfile
if [ -f "$PIDFILE" ]; then
  OLD_PID=$(cat "$PIDFILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "  Stopping existing server (PID $OLD_PID)..."
    kill -TERM "$OLD_PID" 2>/dev/null || true
    sleep 1
    if kill -0 "$OLD_PID" 2>/dev/null; then
      kill -KILL "$OLD_PID" 2>/dev/null || true
    fi
  fi
  rm -f "$PIDFILE"
fi

# Kill anything else on port 4200 or 4201
for PORT in 4200 4201; do
  if lsof -ti tcp:$PORT >/dev/null 2>&1; then
    echo "  Killing process on port $PORT..."
    kill $(lsof -ti tcp:$PORT) 2>/dev/null || true
    sleep 0.5
  fi
done

# Ensure packages are built
bash scripts/build.sh

# Ensure .ng-annotate directory exists
mkdir -p .ng-annotate

# Start ng-annotate standalone server (manifest + WebSocket on port 4201)
npx tsx scripts/ng-annotate-server.ts &
ANNOTATE_PID=$!

# Start Angular dev server
(cd demo && ng serve --port 4200) &
SERVER_PID=$!

# Write pidfile (tracks Angular server)
echo "$SERVER_PID" > "$PIDFILE"

echo "✓ ng-annotate server started (PID $ANNOTATE_PID) on port 4201"
echo "✓ Dev server started (PID $SERVER_PID) at http://localhost:4200"

# Wait for Angular server; kill annotate server when it exits
wait "$SERVER_PID" || true
kill "$ANNOTATE_PID" 2>/dev/null || true
