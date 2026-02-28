---
id: FEATURE-021-demo-mcp-json
type: feature
priority: high
effort: 0.5h
status: done
labels: [demo, phase-0, mcp-server]
depends_on: [FEATURE-003-mcp-server-stub-package, FEATURE-005-demo-app-scaffold]
blocks: [FEATURE-037-mcp-server-seed-and-verify]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Create demo/.mcp.json for MCP server

## Summary

Create `demo/.mcp.json` (or root `.mcp.json`) that points Claude Code at the local MCP server TypeScript source. This is the config that makes the agent automatically connect to the MCP server.

## Acceptance Criteria

- `.mcp.json` exists at the repo root (not inside `demo/`) so it's picked up by Claude Code when working in the repo
- Content:
  ```json
  {
    "mcpServers": {
      "ng-annotate": {
        "command": "npx",
        "args": ["tsx", "packages/mcp-server/src/index.ts"],
        "cwd": "${workspaceFolder}"
      }
    }
  }
  ```
- `tsx` is in root devDependencies (added in FEATURE-001)
- Claude Code can find and use this config file (verify in FEATURE-037)

## Technical Notes

- Using `tsx` to run the TypeScript source directly means the agent picks up MCP server changes without a compile step
- `${workspaceFolder}` should resolve to the repo root where `.ng-annotate/store.json` will live
- The store path in `store.ts` is relative to `process.cwd()` — so the MCP server must be started from the repo root
