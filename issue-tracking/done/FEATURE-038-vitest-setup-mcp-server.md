---
id: FEATURE-038-vitest-setup-mcp-server
type: feature
priority: high
effort: 1h
status: backlog
labels: [testing, phase-2, mcp-server]
depends_on: [FEATURE-037-mcp-server-seed-and-verify]
blocks: [FEATURE-039-mcp-tool-tests-sessions]
created: 2026-02-27
updated: 2026-02-27
started: null
completed: null
---

# Set up Vitest for mcp-server package

## Summary

Install Vitest and create the test configuration for the `mcp-server` package.

## Acceptance Criteria

- Run: `npm install -D vitest @vitest/coverage-v8 --workspace=packages/mcp-server`
- `packages/mcp-server/vitest.config.ts` exists with the same structure as the vite-plugin config (FEATURE-032):
  - `globals: false`, `environment: 'node'`, `include: ['src/**/*.spec.ts']`
  - Coverage via `@vitest/coverage-v8`
- `packages/mcp-server/package.json` scripts:
  - `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`
- `npm run test --workspace=packages/mcp-server` exits 0

## Technical Notes

- Same configuration as vite-plugin — tools tests also need a real Node environment for temp directory store isolation
