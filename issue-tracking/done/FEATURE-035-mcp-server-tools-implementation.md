---
id: FEATURE-035-mcp-server-tools-implementation
type: feature
priority: high
effort: 4h
status: done
labels: [mcp-server, phase-2]
depends_on: [FEATURE-034-mcp-server-dependencies, FEATURE-031-store-implementation]
blocks: [FEATURE-036-mcp-server-entry-point]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Implement packages/mcp-server/src/tools.ts

## Summary

Implement all 9 MCP tools that the AI agent uses to interact with the annotation store.

## Acceptance Criteria

File: `packages/mcp-server/src/tools.ts`

Imports `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`, `z` from `zod`, and `store` + `addWatcher` from `../../vite-plugin/src/store`.

**Session tools:**
- `list_sessions`: No parameters. Returns `json(await store.listSessions())`
- `get_session`: Parameter `id: z.string()`. Returns session + its annotations. Returns error if not found

**Query tools:**
- `get_pending`: Parameter `sessionId: z.string()`. Returns pending annotations for that session
- `get_all_pending`: No parameters. Returns all pending annotations across all sessions, sorted oldest first

**Action tools:**
- `acknowledge`: Parameters `id: z.string()`, `message: z.string().optional()`. Transitions `pending → acknowledged`. If annotation not found or already acknowledged, returns error. If message provided, calls `store.addReply` with `author: 'agent'`
- `resolve`: Parameters `id: z.string()`, `summary: z.string().optional()`. Transitions any status → `resolved`. Adds reply with summary if provided
- `dismiss`: Parameters `id: z.string()`, `reason: z.string()`. Transitions any status → `dismissed`. Adds reply with reason. Returns error if reason is empty string
- `reply`: Parameters `id: z.string()`, `message: z.string()`. Appends agent reply. Returns error if annotation not found

**Watch tool:**
- `watch_annotations`: Parameters `sessionId: z.string().optional()`, `timeoutMs: z.number().optional()` (default 25000)
- Polls the store every 500ms for the duration of `timeoutMs`
- Returns `{ status: 'annotations', annotations: [...] }` as soon as pending annotations are found
- Returns `{ status: 'timeout' }` if none found within the timeout
- If pending annotations exist at call time, returns immediately without polling

Helper functions: `json(data)` and `error(message)` per spec

TypeScript compiles without errors, ESLint passes

## Technical Notes

- `DEFAULT_WATCH_TIMEOUT_MS = 25_000`, `WATCH_POLL_INTERVAL_MS = 500`
- The watch tool uses `setInterval` within a `Promise` that resolves when annotations are found or timeout elapses
- The `acknowledge` tool must check current status — returning an error if already acknowledged prevents double-processing
