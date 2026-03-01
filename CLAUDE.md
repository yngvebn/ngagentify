# ng-annotate-mcp — Agent Instructions

## Project Overview

This is a development-only Angular toolchain addon that exposes a running Angular application as a rich context provider to an AI agent via MCP. You are the AI agent.

## Dev Setup

```bash
npm install          # install all workspace dependencies
npm run build        # build all packages once
npm run dev          # start Angular dev server at localhost:4200
```

The MCP server is automatically started by Claude Code via `.mcp.json` using `tsx` (no compile step needed).

## Releasing

**Never run `npm publish` directly.** Publishing is handled by GitHub Actions on tag push.

To cut a release, only ever use the release script:

```bash
npm run release patch   # or minor / major
```

This bumps all package versions, commits, tags, and pushes. GitHub Actions picks up the tag and publishes to npm automatically.

## Store File

The annotation store lives at `.ng-annotate/store.json` in the repo root. It is shared between the Vite plugin (via WebSocket) and the MCP server. It is gitignored.

## ng-annotate-mcp Work Loop

### On startup

1. Call `get_all_pending` — drain any annotations that arrived before you connected.
2. Process each pending annotation (see below).
3. Enter the `watch_annotations` loop (call `watch_annotations` with default timeout).
4. When annotations arrive, process them and loop again.

### Processing an annotation

1. **Acknowledge first**: call `acknowledge` with the annotation ID. Do this immediately, before reading any files.
2. **Read the files**: use `componentFilePath` and (if present) `templateFilePath` from the annotation.
3. **Understand the intent**: read `annotationText` and `selectionText` (prefer `selectionText` as the primary focus when present).
4. **Make the change**: edit the component template, TypeScript, or SCSS as needed.
   - If the template change also requires a TypeScript change (e.g. adding a property), make both.
   - Make minimal, targeted edits — do not refactor surrounding code.
5. **Resolve or reply**:
   - If the change is written to disk: call `resolve` with a one-sentence summary.
   - If you need clarification: call `reply` with a question. Do NOT resolve yet.
   - If the request is outside scope or not actionable: call `dismiss` with a reason.

### Rules

- **Always `acknowledge` before touching any files.** Never start editing without acknowledging first.
- **Never modify files without a corresponding annotation.** Only make changes the developer has explicitly requested via the overlay.
- **Do not `resolve` until the change is actually written to disk.** If the edit fails, reply with the error instead.
- **Use `selectionText` as the primary focus** when the developer highlighted specific text inside the component. The `annotationText` is the instruction; `selectionText` is the target.
- **Template vs TypeScript**: changing a template binding (e.g. `{{ title }}`) may require adding a `title` property to the TypeScript class. Always check both.

### Reset broken-card for re-testing

```bash
npm run demo:reset
```

This resets `demo/src/app/components/broken-card/` to its original broken state so the annotation loop can be re-run.

## MCP Tools Reference

| Tool | Description |
|------|-------------|
| `list_sessions` | List all browser sessions |
| `get_session` | Get session + its annotations |
| `get_all_pending` | All pending annotations (sorted oldest first) |
| `get_pending` | Pending annotations for one session |
| `acknowledge` | Mark pending → acknowledged |
| `resolve` | Mark as resolved (with optional summary) |
| `dismiss` | Dismiss with a required reason |
| `reply` | Add agent reply (for clarification) |
| `watch_annotations` | Long-poll (25s) for new pending annotations |
