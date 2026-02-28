#!/usr/bin/env bash
set -euo pipefail

echo "▶ Resetting broken demo component..."

git checkout HEAD -- demo/src/app/components/broken-card

echo "✓ Reset — restored to original state"
echo "  HMR will pick up the change automatically if the dev server is running."
