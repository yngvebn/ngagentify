#!/usr/bin/env bash
set -euo pipefail

BUMP="${1:-}"

if [[ -z "$BUMP" ]]; then
  echo "Usage: npm run release <major|minor|patch>"
  exit 1
fi

if [[ "$BUMP" != "major" && "$BUMP" != "minor" && "$BUMP" != "patch" ]]; then
  echo "Error: argument must be major, minor, or patch (got: $BUMP)"
  exit 1
fi

# Ensure working directory is clean
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: working directory is not clean. Commit or stash changes before releasing."
  exit 1
fi

# Ensure local branch is up to date with remote
git fetch origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [[ "$LOCAL" != "$REMOTE" ]]; then
  echo "Error: local branch is not in sync with origin/main. Push or pull before releasing."
  exit 1
fi

# Resolve latest tag, strip leading 'v'
LATEST=$(git tag --list 'v*' --sort=-version:refname | head -1)
if [[ -z "$LATEST" ]]; then
  echo "Error: no existing vX.Y.Z tag found"
  exit 1
fi

CURRENT="${LATEST#v}"
MAJOR=$(echo "$CURRENT" | cut -d. -f1)
MINOR=$(echo "$CURRENT" | cut -d. -f2)
PATCH=$(echo "$CURRENT" | cut -d. -f3)

case "$BUMP" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac

VERSION="$MAJOR.$MINOR.$PATCH"
TAG="v$VERSION"

echo "Bumping $LATEST → $TAG..."

# Bump all three package versions
for pkg in packages/vite-plugin packages/mcp-server packages/angular; do
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
