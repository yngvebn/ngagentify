#!/usr/bin/env bash
set -euo pipefail

echo "▶ Building packages..."

echo "  [1/3] vite-plugin"
npm run build --workspace=packages/vite-plugin

echo "  [2/3] mcp-server"
npm run build --workspace=packages/mcp-server

echo "  [3/3] angular"
npm run build --workspace=packages/angular

echo "✓ All packages built"
