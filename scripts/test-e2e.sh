#!/usr/bin/env bash
set -euo pipefail
echo "Running integration tests..."
echo "  (Dev server must be running — use 'npm run dev' first)"
cd demo && npx playwright test
