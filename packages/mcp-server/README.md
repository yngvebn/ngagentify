# @ng-annotate/mcp-server

MCP server for [ng-annotate-mcp](https://github.com/yngvebn/ngagentify) — a dev-only Angular toolchain addon that lets you annotate components in the browser and have an AI agent (Claude) act on those annotations in real time.

## What this server does

Exposes MCP tools that an AI agent uses to read and act on browser annotations:

| Tool | Description |
|---|---|
| `list_sessions` | List all browser sessions |
| `get_session` | Get a session and all its annotations |
| `get_all_pending` | All pending annotations (sorted oldest first) |
| `get_pending` | Pending annotations for one session |
| `acknowledge` | Mark annotation as acknowledged (before editing files) |
| `resolve` | Mark annotation as resolved with a summary |
| `dismiss` | Dismiss annotation with a reason |
| `reply` | Add a reply (for clarifications) |
| `watch_annotations` | Long-poll (25 s) for new pending annotations |

## Install

```bash
ng add @ng-annotate/angular
```

The schematic configures the MCP server automatically. For manual setup, add to `.mcp.json` (Claude Code):

```json
{
  "mcpServers": {
    "ng-annotate": {
      "command": "npx",
      "args": ["-y", "@ng-annotate/mcp-server"],
      "env": {
        "NG_ANNOTATE_PROJECT_ROOT": "/path/to/your/project"
      }
    }
  }
}
```

Or `.vscode/mcp.json` (VS Code Copilot):

```json
{
  "servers": {
    "ng-annotate": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@ng-annotate/mcp-server"],
      "env": {
        "NG_ANNOTATE_PROJECT_ROOT": "/path/to/your/project"
      }
    }
  }
}
```

## Usage

Once the MCP server is connected, invoke the `start-polling` prompt in your AI editor:

```
/mcp ng-annotate start-polling
```

The agent will drain pending annotations, then enter a `watch_annotations` loop — processing browser annotations as they arrive and editing files automatically.

## Environment variables

| Variable | Description |
|---|---|
| `NG_ANNOTATE_PROJECT_ROOT` | Absolute path to the Angular project root. Used to locate the annotation store (`.ng-annotate/store.json`). |

## Related packages

| Package | Purpose |
|---|---|
| [`@ng-annotate/angular`](https://www.npmjs.com/package/@ng-annotate/angular) | Angular library (overlay UI, `provideNgAnnotate()`, custom dev-server builder) |

## License

MIT
