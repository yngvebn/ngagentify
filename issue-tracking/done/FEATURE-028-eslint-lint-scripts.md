---
id: FEATURE-028-eslint-lint-scripts
type: feature
priority: high
effort: 1h
status: backlog
labels: [eslint, phase-1]
depends_on: [FEATURE-026-eslint-package-configs, FEATURE-027-eslint-angular-schematics]
blocks: [FEATURE-029-eslint-precommit-hooks]
created: 2026-02-27
updated: 2026-02-27
started: null
completed: null
---

# Add lint scripts to all package.json files

## Summary

Add `lint` and `lint:fix` scripts to each package's `package.json`, and create `scripts/lint.sh` as a thin wrapper for running lint everywhere with one command.

## Acceptance Criteria

- `packages/vite-plugin/package.json` scripts:
  - `"lint": "eslint src/"`, `"lint:fix": "eslint src/ --fix"`
- `packages/mcp-server/package.json` scripts: same pattern
- `packages/angular/package.json` scripts: same pattern
- Root `package.json` scripts:
  - `"lint": "npm run lint --workspaces --if-present && ng lint --project=ng-annotate-demo"`
  - `"lint:fix": "npm run lint:fix --workspaces --if-present && ng lint --project=ng-annotate-demo --fix"`
- `scripts/lint.sh` exists and is executable:
  ```bash
  #!/usr/bin/env bash
  set -euo pipefail
  echo "▶ Linting all packages..."
  npm run lint --workspaces --if-present
  echo "▶ Linting demo app..."
  cd demo && ng lint
  echo "✓ Lint passed"
  ```
- `npm run lint` from repo root exits 0 on the current stub source files

## Technical Notes

- The demo app's lint is via `ng lint` (Angular CLI builder), not direct `eslint`
- `--max-warnings=0` is NOT needed in the scripts because all lint rules are errors (no warnings)
