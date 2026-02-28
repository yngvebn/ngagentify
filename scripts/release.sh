#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"

if [[ -z "$VERSION" ]]; then
  echo "Usage: npm run release <version>"
  echo "  e.g. npm run release 0.2.7"
  exit 1
fi

# Validate semver-ish format
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: version must be in X.Y.Z format (got: $VERSION)"
  exit 1
fi

TAG="v$VERSION"

echo "Releasing $TAG..."

# Bump all three package versions
for pkg in packages/vite-plugin packages/mcp-server packages/angular; do
  tmp=$(mktemp)
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$pkg/package.json', 'utf8'));
    pkg.version = '$VERSION';
    fs.writeFileSync('$pkg/package.json', JSON.stringify(pkg, null, 2) + '\n');
  "
  echo "  bumped $pkg to $VERSION"
done

# Commit
git add packages/vite-plugin/package.json packages/mcp-server/package.json packages/angular/package.json
git commit -m "chore: release $TAG"

# Tag
git tag "$TAG"

# Push
git push origin main --tags

echo "Done — $TAG pushed."
