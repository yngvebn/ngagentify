---
id: FEATURE-033-store-tests
type: feature
priority: high
effort: 4h
status: backlog
labels: [testing, phase-2, vite-plugin]
depends_on: [FEATURE-032-vitest-setup-vite-plugin]
blocks: [FEATURE-034-mcp-server-dependencies]
created: 2026-02-27
updated: 2026-02-27
started: null
completed: null
---

# Write store.spec.ts with full test coverage

## Summary

Write comprehensive Vitest tests for `store.ts`. The store is the shared foundation — bugs here surface unpredictably later. All store tests must pass before moving on.

## Acceptance Criteria

File: `packages/vite-plugin/src/store.spec.ts`

Tests use a temp directory for isolation:
- `beforeEach`: `fs.mkdtempSync` + `process.chdir(tempDir)`
- `afterEach`: `fs.rmSync(tempDir, { recursive: true, force: true })`
- Dynamic import of store after `cwd` is set: `const { store } = await import('./store')`

**`store.createSession`**:
- Assigns a UUID `id`
- Sets `createdAt` and `lastSeenAt` as ISO strings
- Persists to the store file
- Returns the full session object

**`store.createAnnotation`**:
- Assigns a UUID `id`
- Sets `status: 'pending'`
- Sets `replies: []`
- Sets `createdAt` as ISO string
- Persists to the store file
- Returns the full annotation object

**`store.listAnnotations`**:
- Returns all annotations with no filters
- Filters correctly by `status`
- Filters correctly by `sessionId`
- Returns results sorted oldest-first (by `createdAt`)

**`store.addReply`**:
- Appends a reply with generated UUID `id` and ISO `createdAt`
- Correct `author` field from input
- Returns `undefined` for unknown annotation id

**`store.updateAnnotation`**:
- Merges the patch into the existing annotation
- Returns `undefined` for unknown annotation id

**Concurrent access**:
- Fire 10 `createAnnotation` calls in parallel
- After all settle, `listAnnotations()` returns exactly 10 items (no data loss from lock contention)

All tests pass: `npm run test --workspace=packages/vite-plugin`

## Technical Notes

- The dynamic import approach is required because the store reads `process.cwd()` at module evaluation time; changing `cwd` before importing makes each test use a fresh temp directory
- The concurrency test is the most important — it validates that `proper-lockfile` prevents data loss under parallel writes
