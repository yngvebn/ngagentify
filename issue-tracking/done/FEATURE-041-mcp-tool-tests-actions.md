---
id: FEATURE-041-mcp-tool-tests-actions
type: feature
priority: high
effort: 3h
status: backlog
labels: [testing, phase-2, mcp-server]
depends_on: [FEATURE-040-mcp-tool-tests-query]
blocks: [FEATURE-042-mcp-tool-tests-watch]
created: 2026-02-27
updated: 2026-02-27
started: null
completed: null
---

# Write tools.spec.ts — action tools tests

## Summary

Write Vitest tests for the `acknowledge`, `resolve`, `dismiss`, and `reply` MCP tools.

## Acceptance Criteria

Added to `packages/mcp-server/src/tools.spec.ts`:

**`acknowledge` tool**:
- Transitions annotation status from `pending` to `acknowledged`
- Returns an error if the annotation does not exist
- Returns an error if the annotation is already `acknowledged`
- Adds an agent reply with the provided message when message is given
- Does not add a reply when no message is provided

**`resolve` tool**:
- Transitions annotation from `acknowledged` to `resolved`
- Transitions annotation from `pending` to `resolved` (direct resolve is allowed)
- Adds a reply with the summary text when summary is provided
- Returns an error if the annotation does not exist

**`dismiss` tool**:
- Transitions annotation to `dismissed` and records reason in replies
- Returns an error if reason is an empty string
- Returns an error if the annotation does not exist

**`reply` tool**:
- Appends agent reply with correct message and `author: 'agent'`
- Returns an error if the annotation does not exist

All tests pass: `npm run test --workspace=packages/mcp-server`
