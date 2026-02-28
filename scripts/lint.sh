#!/usr/bin/env bash
set -euo pipefail
echo "Linting all packages..."
npm run lint --workspaces --if-present
echo "Lint passed"
