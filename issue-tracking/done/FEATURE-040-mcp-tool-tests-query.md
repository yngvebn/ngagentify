---
id: FEATURE-040-mcp-tool-tests-query
type: feature
priority: high
effort: 2h
status: backlog
labels: [testing, phase-2, mcp-server]
depends_on: [FEATURE-039-mcp-tool-tests-sessions]
blocks: [FEATURE-041-mcp-tool-tests-actions]
created: 2026-02-27
updated: 2026-02-27
started: null
completed: null
---

# Write tools.spec.ts — query tools tests

## Summary

Write Vitest tests for the `get_pending` and `get_all_pending` MCP tools.

## Acceptance Criteria

Added to `packages/mcp-server/src/tools.spec.ts`:

**`get_pending` tool**:
- Returns only pending annotations for the specified session
- Excludes acknowledged, resolved, and dismissed annotations for that session
- Returns empty array when no pending annotations exist for the session

**`get_all_pending` tool**:
- Returns annotations across all sessions sorted oldest first (by `createdAt`)
- Excludes acknowledged, resolved, and dismissed annotations
- Returns empty array when no pending annotations exist in any session
- Returns annotations from multiple sessions interleaved by creation time

All tests pass: `npm run test --workspace=packages/mcp-server`
