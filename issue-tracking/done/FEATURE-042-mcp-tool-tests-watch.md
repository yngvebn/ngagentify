---
id: FEATURE-042-mcp-tool-tests-watch
type: feature
priority: high
effort: 2h
status: backlog
labels: [testing, phase-2, mcp-server]
depends_on: [FEATURE-041-mcp-tool-tests-actions]
blocks: [FEATURE-043-vite-plugin-ws-handler]
created: 2026-02-27
updated: 2026-02-27
started: null
completed: null
---

# Write tools.spec.ts — watch_annotations tests

## Summary

Write Vitest tests for the `watch_annotations` tool, covering all three timing scenarios and the sessionId filter. These are the most complex tests in the MCP server suite.

## Acceptance Criteria

Added to `packages/mcp-server/src/tools.spec.ts`:

**`watch_annotations` — immediate return**:
- Seed the store with a pending annotation before calling `watch_annotations`
- Call `watch_annotations` (with any timeout)
- Assert: returns `{ status: 'annotations', annotations: [...] }` without waiting for timeout period
- Response time should be under 100ms

**`watch_annotations` — timeout**:
- Call `watch_annotations` with `timeoutMs: 300` (short timeout for test speed) and no pre-existing annotations
- Assert: returns `{ status: 'timeout' }` after approximately 300ms
- Response time should be between 250ms and 600ms (allow some tolerance)

**`watch_annotations` — early return on new annotation**:
- Call `watch_annotations` with `timeoutMs: 5000` (long timeout)
- After 100ms delay, create a new annotation in the store
- Assert: returns `{ status: 'annotations' }` well before the 5000ms timeout
- The returned annotations array includes the newly created annotation

**`watch_annotations` — sessionId filter**:
- Create annotations for two different sessions
- Call `watch_annotations` with `sessionId` set to session1's id
- Assert: only returns annotations for session1

All tests pass: `npm run test --workspace=packages/mcp-server`

## Technical Notes

- Use Vitest's fake timers (`vi.useFakeTimers()`) for the timeout test to avoid slow test runs — OR use `timeoutMs: 300` with real timers (simpler, acceptable for a 300ms test)
- The "early return" test requires real timers since it tests actual polling behavior
