#!/usr/bin/env bash
set -euo pipefail

# Note: Cleaning node_modules/ requires re-running `npx simple-git-hooks`
# to reactivate git hooks after running `npm install` again.

echo "▶ Cleaning..."

rm -rf packages/vite-plugin/dist/
rm -rf packages/mcp-server/dist/
rm -rf packages/angular/dist/
rm -rf demo/dist/
rm -rf .ng-annotate/
rm -rf demo/.ng-annotate/

echo "✓ Clean complete"
