---
id: FEATURE-024-eslint-install-root-deps
type: feature
priority: high
effort: 1h
status: backlog
labels: [eslint, phase-1]
depends_on: [FEATURE-023-verify-phase0-checkpoints]
blocks: [FEATURE-025-eslint-root-config]
created: 2026-02-27
updated: 2026-02-27
started: null
completed: null
---

# Install ESLint root dependencies

## Summary

Install all ESLint-related packages at the repo root that will be shared across all packages and the demo app.

## Acceptance Criteria

- Run from repo root:
  ```bash
  npm install -D eslint @eslint/js typescript-eslint eslint-plugin-import eslint-plugin-unicorn
  ```
- All packages resolve without peer dependency conflicts
- `npx eslint --version` outputs ESLint 9.x
- Root `package.json` devDependencies now includes all five packages

## Technical Notes

- Use ESLint 9+ (flat config format) — do not use `.eslintrc.json` or `.eslintrc.js` (legacy)
- `typescript-eslint` v8+ is required for ESLint 9 flat config compatibility
- These are root-level dev dependencies; individual packages do not need to duplicate them
