---
id: FEATURE-034-mcp-server-dependencies
type: feature
priority: high
effort: 0.5h
status: done
labels: [mcp-server, phase-2]
depends_on: [FEATURE-033-store-tests, FEATURE-003-mcp-server-stub-package]
blocks: [FEATURE-035-mcp-server-tools-implementation]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Install MCP server dependencies

## Summary

Install the MCP SDK and Zod into the `mcp-server` package.

## Acceptance Criteria

- Run: `npm install @modelcontextprotocol/sdk zod --workspace=packages/mcp-server`
- `packages/mcp-server/package.json` `"dependencies"` includes both packages
- TypeScript can resolve `import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'`
- TypeScript can resolve `import { z } from 'zod'`
- `npm run build --workspace=packages/mcp-server` exits 0 (stub still compiles)

## Technical Notes

- Use the latest stable `@modelcontextprotocol/sdk` version (1.x)
- `zod` is used for tool input schema validation; use v3.x
- The MCP server imports from the vite-plugin's store source directly (TypeScript path): `import { store } from '../../vite-plugin/src/store'`
