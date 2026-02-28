---
id: FEATURE-039-mcp-tool-tests-sessions
type: feature
priority: high
effort: 2h
status: backlog
labels: [testing, phase-2, mcp-server]
depends_on: [FEATURE-038-vitest-setup-mcp-server]
blocks: [FEATURE-040-mcp-tool-tests-query]
created: 2026-02-27
updated: 2026-02-27
started: null
completed: null
---

# Write tools.spec.ts — session tools tests

## Summary

Write Vitest tests for the `list_sessions` and `get_session` MCP tools. Tests call tool handlers directly (not via the MCP protocol), using a real store backed by a temp directory.

## Acceptance Criteria

File: `packages/mcp-server/src/tools.spec.ts`

Same temp-directory isolation pattern as store tests (FEATURE-033).

**`list_sessions` tool**:
- Returns empty array when no sessions exist
- Returns all sessions after creating two sessions
- Session objects include all required fields (`id`, `createdAt`, `lastSeenAt`, `active`, `url`)

**`get_session` tool**:
- Returns the session with its annotations when called with a valid id
- Returns an error response when called with an unknown id
- Annotations array is filtered to only that session's annotations

All tests in this file pass: `npm run test --workspace=packages/mcp-server`

## Technical Notes

- To call tools directly in tests, either: (a) export the handler functions from `tools.ts` separately, or (b) create a test helper that registers a mock `McpServer` and invokes tool handlers via the registered callback
- Approach (b) is more realistic — test the actual registered handler, not a separate function
