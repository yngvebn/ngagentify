---
id: FEATURE-037-mcp-server-seed-and-verify
type: feature
priority: high
effort: 1h
status: done
labels: [mcp-server, phase-2, validation]
depends_on: [FEATURE-036-mcp-server-entry-point, FEATURE-021-demo-mcp-json]
blocks: [FEATURE-038-vitest-setup-mcp-server]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Seed store with dummy annotation and verify Claude connects

## Summary

Manually create a `.ng-annotate/store.json` with a hardcoded dummy annotation, then connect Claude Code to the MCP server and verify all tools behave correctly.

## Acceptance Criteria

- Create `.ng-annotate/store.json` at repo root with valid store shape:
  ```json
  {
    "sessions": {
      "test-session-1": {
        "id": "test-session-1",
        "createdAt": "2026-02-27T00:00:00.000Z",
        "lastSeenAt": "2026-02-27T00:00:00.000Z",
        "active": true,
        "url": "http://localhost:4200"
      }
    },
    "annotations": {
      "test-annotation-1": {
        "id": "test-annotation-1",
        "sessionId": "test-session-1",
        "createdAt": "2026-02-27T00:00:00.000Z",
        "status": "pending",
        "replies": [],
        "componentName": "BrokenCardComponent",
        "componentFilePath": "src/app/components/broken-card/broken-card.component.ts",
        "selector": "app-broken-card",
        "inputs": {},
        "domSnapshot": "<app-broken-card></app-broken-card>",
        "componentTreePath": ["AppComponent"],
        "annotationText": "Fix the typo in the title and change the button color to green"
      }
    }
  }
  ```
- Claude Code connects to the MCP server via `.mcp.json`
- `get_all_pending` returns the dummy annotation
- `get_session` with `id: "test-session-1"` returns the session
- `acknowledge` with `id: "test-annotation-1"` transitions the annotation to `acknowledged`
- `resolve` with `id: "test-annotation-1"` and `summary: "Fixed"` transitions to `resolved`
- After verification, remove the hardcoded seed data (`.ng-annotate/` is gitignored, so just delete the directory)

## Technical Notes

- This is a manual verification step — no automated test
- If `get_all_pending` crashes or returns an error, investigate the MCP server logs
