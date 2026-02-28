---
id: FEATURE-005-demo-app-scaffold
type: feature
priority: high
effort: 2h
status: done
labels: [monorepo, scaffold, phase-0, demo]
depends_on: [FEATURE-001-monorepo-root-package-json]
blocks: [FEATURE-006-demo-tsconfig-paths, FEATURE-013-demo-component-simple]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Scaffold demo Angular app

## Summary

Run `ng new` to create the demo Angular application inside the `demo/` directory. This must use the Angular CLI — do not create files manually.

## Acceptance Criteria

- Run from repo root: `ng new ng-annotate-demo --directory=demo --routing=false --style=scss`
  - If `demo/` already contains an `angular.json`, skip this step
- `demo/package.json` has `"name": "ng-annotate-demo"` and `"private": true`
- `demo/package.json` dependencies updated to include local workspace packages:
  - `"ng-annotate-mcp": "*"` in `"devDependencies"`
  - `"@ng-annotate/angular": "*"` in `"dependencies"`
- Angular version is `^21.0.0` (aligned with spec)
- `npm install` from repo root resolves the demo's workspace dependencies as symlinks
- `npm run dev --workspace=demo` (or `cd demo && ng serve`) starts the dev server and app loads at `localhost:4200`

## Technical Notes

- The `--routing=false` flag skips router boilerplate since the demo doesn't need routing
- The `--style=scss` flag is required — component stylesheets use SCSS
- After scaffolding, the `demo/` directory is added to the root `package.json` workspaces array (this should already be present from FEATURE-001)
- The Angular CLI version should match `@angular/core` version (^21.0.0) to avoid mismatches
