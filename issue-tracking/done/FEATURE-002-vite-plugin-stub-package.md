---
id: FEATURE-002-vite-plugin-stub-package
type: feature
priority: high
effort: 2h
status: done
labels: [monorepo, scaffold, phase-0, vite-plugin]
depends_on: [FEATURE-001-monorepo-root-package-json]
blocks: [FEATURE-030-store-dependencies]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Create vite-plugin package stub

## Summary

Create the `packages/vite-plugin/` package with a working `package.json` and `tsconfig.json`. No source code yet — just the package skeleton so that the npm workspace resolves it correctly.

## Acceptance Criteria

- `packages/vite-plugin/package.json` exists with:
  - `"name": "ng-annotate-mcp"` (the package name users install)
  - `"version": "0.1.0"`
  - `"main": "dist/index.js"` and `"types": "dist/index.d.ts"`
  - `"scripts"`: `"build": "tsc"`, `"build:watch": "tsc --watch"`
  - `"peerDependencies"`: `"vite": ">=5.0.0"`
  - `"devDependencies"`: `"typescript": "~5.6.0"`, `"vite": "^5.0.0"`
- `packages/vite-plugin/tsconfig.json` exists targeting Node ESM output:
  - `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`
  - `"outDir": "dist"`, `"rootDir": "src"`
  - `"declaration": true`
- `packages/vite-plugin/src/index.ts` exists as a stub: `export function ngAnnotateMcp() { return []; }`
- `npm run build --workspace=packages/vite-plugin` exits 0

## Technical Notes

- Use `NodeNext` module format to support both CJS and ESM consumers via package.json `"exports"` field if needed later
- The `dist/` directory is gitignored (added in FEATURE-012)
