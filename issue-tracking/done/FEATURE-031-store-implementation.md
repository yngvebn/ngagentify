---
id: FEATURE-031-store-implementation
type: feature
priority: high
effort: 4h
status: done
labels: [store, phase-1, vite-plugin]
depends_on: [FEATURE-030-store-dependencies]
blocks: [FEATURE-032-vitest-setup-vite-plugin, FEATURE-035-mcp-server-tools-implementation]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Implement packages/vite-plugin/src/store.ts

## Summary

Implement the file-based store that is the single shared source of truth between the Vite plugin and the MCP server. This is the most critical module in the project.

## Acceptance Criteria

- File: `packages/vite-plugin/src/store.ts`
- Exports all types: `Session`, `AnnotationReply`, `Annotation`, `AnnotationStatus`
- `STORE_DIR = '.ng-annotate'` and `STORE_PATH = path.join(process.cwd(), STORE_DIR, 'store.json')`
- `ensureStore()` creates the directory and file if they don't exist
- `withLock(fn)` acquires a file lock using `proper-lockfile`, reads the store, calls `fn(data)`, writes the result back, releases the lock
- In-process pub/sub: `watchers` Set, `addWatcher(fn)` returns an unsubscribe function, `notifyWatchers(annotation)` fires all watchers
- `store` object exported with full public API:
  - `createSession(payload)` — assigns UUID id, sets `createdAt` and `lastSeenAt` to ISO string, persists, returns the session
  - `updateSession(id, patch)` — merges patch into existing session
  - `listSessions()` — reads store, returns all sessions as array
  - `getSession(id)` — reads store, returns session or undefined
  - `createAnnotation(payload)` — assigns UUID id, sets `createdAt` to ISO string, sets `status: 'pending'`, sets `replies: []`, persists, calls `notifyWatchers`, returns the annotation
  - `getAnnotation(id)` — reads store, returns annotation or undefined
  - `listAnnotations(sessionId?, status?)` — returns filtered, sorted oldest-first array
  - `updateAnnotation(id, patch)` — merges patch, persists, returns updated annotation or undefined
  - `addReply(annotationId, reply)` — appends reply with UUID id and ISO `createdAt`, persists, returns annotation or undefined
- TypeScript compiles without errors
- ESLint passes on this file

## Technical Notes

- The `notifyWatchers` call is in-process only. The MCP server uses polling (500ms interval) for `watch_annotations` instead
- The lock retry config from the spec: `{ retries: { retries: 5, minTimeout: 50 } }`
- All `async` methods that don't need to be async (like `listSessions`, `getAnnotation`) should still be `async` for API consistency
