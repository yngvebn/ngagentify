---
id: FEATURE-030-store-dependencies
type: feature
priority: high
effort: 0.5h
status: done
labels: [store, phase-1, vite-plugin]
depends_on: [FEATURE-029-eslint-precommit-hooks, FEATURE-002-vite-plugin-stub-package]
blocks: [FEATURE-031-store-implementation]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Install store dependencies for vite-plugin

## Summary

Install `proper-lockfile` and `uuid` into the vite-plugin package. These are the only runtime dependencies of the store.

## Acceptance Criteria

- Run: `npm install proper-lockfile uuid --workspace=packages/vite-plugin`
- Run: `npm install -D @types/uuid --workspace=packages/vite-plugin`
- `packages/vite-plugin/package.json` `"dependencies"` includes `proper-lockfile` and `uuid`
- TypeScript compilation of the package still exits 0
- `import { v4 as uuidv4 } from 'uuid'` resolves correctly in vite-plugin source files

## Technical Notes

- `proper-lockfile` provides file-based locking; it has known issues on Windows. This is noted in the spec's Key Risks section — acceptable tradeoff for macOS/Linux dev
- `uuid` v4+ uses ESM by default; ensure the tsconfig `moduleResolution` handles it (NodeNext should work)
