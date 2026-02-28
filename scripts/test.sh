#!/usr/bin/env bash
set -euo pipefail
echo "Running vite-plugin tests..."
npm run test --workspace=packages/vite-plugin
echo "Running mcp-server tests..."
npm run test --workspace=packages/mcp-server
echo "All unit tests passed"
