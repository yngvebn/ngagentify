#!/usr/bin/env bash
set -euo pipefail

echo "▶ Initial build before starting watch mode..."
bash scripts/build.sh

echo "▶ Killing any process on port 4200..."
if lsof -ti tcp:4200 >/dev/null 2>&1; then
  kill $(lsof -ti tcp:4200) 2>/dev/null || true
  sleep 0.5
fi

echo "▶ Starting watch mode..."
npx concurrently \
  --names "vite-plugin,mcp-server,angular,demo" \
  --prefix-colors "cyan,yellow,magenta,green" \
  "npm run build:watch --workspace=packages/vite-plugin" \
  "npm run build:watch --workspace=packages/mcp-server" \
  "npm run build:watch --workspace=packages/angular" \
  "cd demo && ng serve --port 4200"
