---
id: FEATURE-043-vite-plugin-ws-handler
type: feature
priority: high
effort: 4h
status: done
labels: [vite-plugin, phase-3]
depends_on: [FEATURE-042-mcp-tool-tests-watch, FEATURE-031-store-implementation]
blocks: [FEATURE-044-vite-plugin-entry]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Implement packages/vite-plugin/src/ws-handler.ts

## Summary

Implement the WebSocket handler that manages browser connections, creates sessions, processes incoming messages, and pushes annotation status updates back to the browser.

## Acceptance Criteria

File: `packages/vite-plugin/src/ws-handler.ts`

- Imports `WebSocketServer`, `WebSocket` from `ws` and `ViteDevServer` from `vite`
- `createWsHandler(server: ViteDevServer)` function exported
- Attaches a WebSocket server (`{ noServer: true }`) to `server.httpServer`
- Upgrades only connections to `/__annotate` path; ignores others (passes them through)
- `sessionSockets: Map<string, WebSocket>` tracks active sessions
- On connection:
  1. Reads `referer` header as the `url`
  2. Creates a session via `store.createSession({ active: true, url })`
  3. Sends `{ type: 'session:created', session }` back to browser
  4. Stores socket in `sessionSockets`
- On message (parsed as JSON):
  - `annotation:create`: calls `store.createAnnotation({ ...payload, sessionId })` and sends `{ type: 'annotation:created', annotation }` back
  - `annotation:reply`: calls `store.addReply(id, { author: 'user', message })` and sends updated annotation back
  - `annotation:delete`: calls `store.updateAnnotation(id, { status: 'dismissed' })` (soft delete)
- On close: calls `store.updateSession(sessionId, { active: false })`, removes from `sessionSockets`
- `setInterval` every 2000ms: for each active socket, reads all annotations for its session and sends `{ type: 'annotations:sync', annotations }` — this pushes agent status updates (acknowledged, resolved) back to the browser
- TypeScript compiles without errors, ESLint passes

## Technical Notes

- Install `ws` and `@types/ws` in vite-plugin package: `npm install ws --workspace=packages/vite-plugin && npm install -D @types/ws --workspace=packages/vite-plugin`
- The 2s sync interval is the mechanism by which the browser overlay learns about agent status changes
- All incoming messages from the browser must be validated before processing — reject unexpected message types gracefully
