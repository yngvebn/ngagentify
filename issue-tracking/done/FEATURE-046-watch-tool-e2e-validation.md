---
id: FEATURE-046-watch-tool-e2e-validation
type: feature
priority: high
effort: 1h
status: done
labels: [mcp-server, phase-3, validation]
depends_on: [FEATURE-045-vite-plugin-ws-smoke-test]
blocks: [FEATURE-047-manifest-implementation]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Validate watch_annotations tool returns immediately on browser-triggered annotation

## Summary

With the demo app running, call `watch_annotations` from Claude Code, then trigger a WebSocket annotation from the browser console and verify the watch tool returns immediately rather than timing out.

## Acceptance Criteria

- Demo dev server is running (`npm run dev`)
- Claude Code is connected to the MCP server via `.mcp.json`
- Call `watch_annotations` with no arguments — tool is now in 25-second long-poll
- While it's waiting, open browser console and send an `annotation:create` message via WebSocket (same as FEATURE-045)
- Verify: `watch_annotations` returns `{ status: 'annotations', annotations: [...] }` immediately (within 1-2 poll intervals = ~500ms–1000ms), NOT after 25 seconds
- If instead it returns `{ status: 'timeout' }`, investigate: the MCP server's polling loop may not see the new store entry

## Technical Notes

- This test validates the full loop: browser → WebSocket → store file → MCP server poll → watch_annotations return
- The MCP server polls the store file every 500ms; the watch tool should return within one poll interval after the annotation appears
- If the MCP server and Vite plugin write to different store paths (different `process.cwd()`), this will fail — verify both processes resolve `STORE_PATH` to the same file
