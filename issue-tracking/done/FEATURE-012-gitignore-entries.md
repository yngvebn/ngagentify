---
id: FEATURE-012-gitignore-entries
type: feature
priority: high
effort: 0.5h
status: done
labels: [monorepo, scaffold, phase-0]
depends_on: [FEATURE-001-monorepo-root-package-json]
blocks: []
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Add .gitignore entries

## Summary

Ensure the repo-root `.gitignore` covers all build artifacts and runtime files that should never be committed.

## Acceptance Criteria

- `.gitignore` at repo root includes:
  ```
  # Build artifacts
  packages/*/dist/
  demo/dist/

  # ng-annotate runtime files
  .ng-annotate/
  demo/.ng-annotate/

  # Node modules
  node_modules/
  ```
- `packages/*/dist/` pattern covers all three packages
- `.ng-annotate/` covers the store, pidfile, and any lock files
- After running `npm run build`, `git status` does not show any dist files as untracked

## Technical Notes

- If a `.gitignore` already exists (created by `ng new` for the demo), add these entries rather than replacing the file
- The `demo/.ng-annotate/` entry is technically redundant with `.ng-annotate/` but explicit clarity is better
