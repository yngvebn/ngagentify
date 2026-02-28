---
id: FEATURE-036-mcp-server-entry-point
type: feature
priority: high
effort: 1h
status: done
labels: [mcp-server, phase-2]
depends_on: [FEATURE-035-mcp-server-tools-implementation]
blocks: [FEATURE-037-mcp-server-seed-and-verify]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Implement packages/mcp-server/src/index.ts

## Summary

Implement the MCP server entry point that creates the server, registers all tools, and connects via stdio transport.

## Acceptance Criteria

File: `packages/mcp-server/src/index.ts`

- Imports `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
- Imports `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`
- Imports `registerTools` from `./tools`
- Creates server with:
  ```ts
  const server = new McpServer({
    name: 'ng-annotate',
    version: '0.1.0',
    description: 'Connects an AI agent to a live Angular dev session for annotation-driven code changes'
  });
  ```
- Calls `registerTools(server)`
- Creates `new StdioServerTransport()` and calls `server.connect(transport)`
- Wrapped in `async function main()` with `.catch(console.error)` error handling
- TypeScript compiles without errors
- Running `npx tsx packages/mcp-server/src/index.ts` starts the MCP server process without crashing (it waits for stdio input)

## Technical Notes

- The `stdio` transport means the server reads from `stdin` and writes to `stdout` — this is the standard MCP transport for Claude Code
- The server process is started by Claude Code's MCP client via the command in `.mcp.json`
