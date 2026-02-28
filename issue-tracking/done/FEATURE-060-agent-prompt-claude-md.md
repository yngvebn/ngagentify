---
id: FEATURE-060-agent-prompt-claude-md
type: feature
priority: high
effort: 1h
status: done
labels: [documentation, phase-8]
depends_on: [FEATURE-059-overlay-component-styles]
blocks: [FEATURE-061-first-e2e-annotation-loop]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Create CLAUDE.md with agent prompt

## Summary

Create `CLAUDE.md` at the repo root with instructions for the AI agent on how to use the `ng-annotate` MCP server. This is what Claude Code reads to understand the work loop.

## Acceptance Criteria

- File: `CLAUDE.md` at repo root
- Includes the `## ng-annotate-mcp` section from spec Phase 5, including:
  - **Work loop**: drain `get_all_pending` first, then process, then enter `watch_annotations` loop
  - **Processing an annotation**: acknowledge → read files → make change → resolve (or reply for clarification, or dismiss)
  - **Rules**:
    - Always `acknowledge` before touching any files
    - Never modify files without a corresponding annotation
    - Check if template change requires TypeScript update
    - Prefer `selectionText` as primary focus when present
    - Do not `resolve` until change is actually written to disk
- Also includes any other project-wide setup notes Claude needs (how to run the dev server, where the store file is, etc.)
- Reviewed for clarity: a developer reading this for the first time should understand the system

## Technical Notes

- This file is read by Claude Code automatically when working in the repo
- Keep the instructions concise and action-oriented — avoid padding or explanations that don't affect behavior
