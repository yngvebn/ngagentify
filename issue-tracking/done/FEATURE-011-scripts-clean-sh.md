---
id: FEATURE-011-scripts-clean-sh
type: feature
priority: medium
effort: 1h
status: done
labels: [scripts, phase-0]
depends_on: [FEATURE-001-monorepo-root-package-json]
blocks: []
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Create scripts/clean.sh

## Summary

Create `scripts/clean.sh` that removes all build artifacts and runtime store files to return the repo to a clean state.

## Acceptance Criteria

- File exists at `scripts/clean.sh` and is executable
- Removes:
  - `packages/vite-plugin/dist/`
  - `packages/mcp-server/dist/`
  - `packages/angular/dist/`
  - `demo/dist/`
  - `.ng-annotate/` (store, pidfile)
  - `demo/.ng-annotate/` (if it exists)
- Prints `▶ Cleaning...` and `✓ Clean complete`
- Does NOT remove `node_modules/` (that's a separate `npm ci` concern)
- `npm run clean` from repo root executes this script
- Includes a comment that cleaning `node_modules/` requires re-running `npx simple-git-hooks` to reactivate git hooks

## Technical Notes

- Use `rm -rf` with explicit paths — never use wildcards that could accidentally delete source files
- Idempotent: running it on an already-clean repo exits 0 without errors
