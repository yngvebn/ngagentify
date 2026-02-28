---
id: FEATURE-001-monorepo-root-package-json
type: feature
priority: high
effort: 2h
status: done
labels: [monorepo, scaffold, phase-0]
depends_on: []
blocks: [FEATURE-002-vite-plugin-stub-package, FEATURE-003-mcp-server-stub-package, FEATURE-004-angular-stub-package, FEATURE-005-demo-app-scaffold]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Create monorepo root package.json

## Summary

Create the root `package.json` that declares the npm workspace containing all packages and the demo app.

## Acceptance Criteria

- Root `package.json` has `"private": true`
- `"workspaces"` lists `"packages/vite-plugin"`, `"packages/mcp-server"`, `"packages/angular"`, and `"demo"`
- `"devDependencies"` includes `"concurrently": "^9.0.0"` and `"tsx"` (for running MCP server source directly)
- `"scripts"` includes entries delegating to `scripts/*.sh`:
  - `"dev": "bash scripts/dev.sh"`
  - `"build": "bash scripts/build.sh"`
  - `"build:watch": "bash scripts/build-watch.sh"`
  - `"clean": "bash scripts/clean.sh"`
  - `"lint": "npm run lint --workspaces --if-present && ng lint --project=ng-annotate-demo"`
  - `"lint:fix": "npm run lint:fix --workspaces --if-present && ng lint --project=ng-annotate-demo --fix"`
  - `"test": "bash scripts/test.sh"`
  - `"test:e2e": "bash scripts/test-e2e.sh"`
- `"simple-git-hooks"` and `"lint-staged"` keys are present as empty stubs (to be filled in FEATURE-029)
- Running `npm install` from root succeeds

## Technical Notes

- The `name` field should be `"ng-annotate-mcp"` to match the spec
- Do not add `"type": "module"` at root level — individual packages manage their own module type
- Create empty `packages/vite-plugin/`, `packages/mcp-server/`, `packages/angular/` directories if they don't exist yet (even just a `.gitkeep`) so npm install doesn't fail on missing workspace members
