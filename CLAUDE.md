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
4. **Compute changes but do NOT write to disk yet.** Determine what edits are needed.
5. **Propose the diff**: call `propose_diff` with the annotation ID and a unified diff string of all intended changes.
6. **Wait for approval**: call `watch_diff_response` with the annotation ID.
   - `"approved"` → write the changes to disk, then call `resolve` with a one-sentence summary.
   - `"rejected"` → call `reply` asking what to revise, or propose an updated diff.
   - `"timeout"` → call `reply` to let the developer know you are still waiting.
7. **Clarification**: if you need more information before proposing, call `reply` with a question. Do NOT write files yet.
8. **Out of scope**: call `dismiss` with a reason.

### Rules

- **Always `acknowledge` before touching any files.** Never start editing without acknowledging first.
- **Never write files without `diff:approved` from the developer.** Always go through `propose_diff` → `watch_diff_response` first.
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
| `propose_diff` | Attach a unified diff for developer review (→ diff_proposed) |
| `watch_diff_response` | Long-poll (5 min) for developer approval or rejection |
| `resolve` | Mark as resolved (with optional summary) |
| `dismiss` | Dismiss with a required reason |
| `reply` | Add agent reply (for clarification) |
| `watch_annotations` | Long-poll (25s) for new pending annotations |
