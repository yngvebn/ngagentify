---
id: FEATURE-003-mcp-server-stub-package
type: feature
priority: high
effort: 2h
status: done
labels: [monorepo, scaffold, phase-0, mcp-server]
depends_on: [FEATURE-001-monorepo-root-package-json]
blocks: [FEATURE-034-mcp-server-dependencies]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Create mcp-server package stub

## Summary

Create the `packages/mcp-server/` package with a working `package.json` and `tsconfig.json`. No source code yet — just the package skeleton so that the npm workspace resolves it correctly.

## Acceptance Criteria

- `packages/mcp-server/package.json` exists with:
  - `"name": "@ng-annotate/mcp-server"`
  - `"version": "0.1.0"`
  - `"type": "module"` (MCP server uses ESM)
  - `"bin": { "ng-annotate-mcp": "dist/index.js" }` (so it can be executed)
  - `"main": "dist/index.js"`, `"types": "dist/index.d.ts"`
  - `"scripts"`: `"build": "tsc"`, `"build:watch": "tsc --watch"`
  - `"devDependencies"`: `"typescript": "~5.6.0"`
- `packages/mcp-server/tsconfig.json` targets Node ESM:
  - `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`
  - `"outDir": "dist"`, `"rootDir": "src"`
  - `"declaration": true`
- `packages/mcp-server/src/index.ts` exists as a stub: `console.log('ng-annotate MCP server stub');`
- `npm run build --workspace=packages/mcp-server` exits 0

## Technical Notes

- The MCP server is invoked via `tsx` in dev mode (see `.mcp.json`), so the TypeScript source runs directly without a compile step during development
- The `dist/` directory is gitignored
