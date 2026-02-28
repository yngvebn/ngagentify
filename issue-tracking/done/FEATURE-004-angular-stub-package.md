---
id: FEATURE-004-angular-stub-package
type: feature
priority: high
effort: 2h
status: done
labels: [monorepo, scaffold, phase-0, angular]
depends_on: [FEATURE-001-monorepo-root-package-json]
blocks: [FEATURE-049-angular-types-file]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Create angular package stub

## Summary

Create the `packages/angular/` package with a working `package.json` and `tsconfig.json`. No source code yet — just the package skeleton so that the npm workspace resolves it correctly.

## Acceptance Criteria

- `packages/angular/package.json` exists with:
  - `"name": "@ng-annotate/angular"`
  - `"version": "0.1.0"`
  - `"main": "dist/index.js"`, `"types": "dist/index.d.ts"`
  - `"scripts"`: `"build": "tsc"`, `"build:watch": "tsc --watch"` (or ng-packagr if preferred)
  - `"peerDependencies"`: `"@angular/core": ">=21.0.0"`, `"rxjs": ">=7.0.0"`
  - `"devDependencies"`: `"typescript": "~5.6.0"`, `"@angular/core": "^21.0.0"`, `"rxjs": "^7.0.0"`
- `packages/angular/tsconfig.json` configured for Angular Ivy library compilation:
  - `"experimentalDecorators": true`, `"emitDecoratorMetadata": true`
  - `"outDir": "dist"`, `"rootDir": "src"`
  - `"declaration": true`
- `packages/angular/src/index.ts` exists as a minimal stub exporting a placeholder
- `npm run build --workspace=packages/angular` exits 0

## Technical Notes

- Angular libraries typically use `ng-packagr` for proper APF (Angular Package Format) output. Using plain `tsc` is acceptable for a dev-only tool that won't be published to npm
- The demo app will point at the TypeScript source via tsconfig paths (FEATURE-006), so the build output is only needed for the compiled dist artifacts
