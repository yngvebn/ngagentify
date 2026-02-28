---
id: FEATURE-023-verify-phase0-checkpoints
type: feature
priority: high
effort: 1h
status: done
labels: [demo, phase-0, validation]
depends_on: [FEATURE-006-demo-tsconfig-paths, FEATURE-009-scripts-dev-sh, FEATURE-020-demo-app-module-integration, FEATURE-021-demo-mcp-json, FEATURE-022-demo-angular-json-plugin]
blocks: [FEATURE-024-eslint-install-root-deps]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Verify all Phase 0 checkpoints

## Summary

Manually verify every checkpoint listed in spec section 0.10 before moving on to Phase 1. This issue is a gate — do not proceed to ESLint until all items below are confirmed.

## Acceptance Criteria

All of the following must be true simultaneously:

1. **App loads**: `npm run dev` starts cleanly; `localhost:4200` shows the demo app with all demo components visible
2. **Running `npm run dev` twice in a row**: results in exactly one `ng serve` process (verify with `lsof -i :4200 | wc -l`)
3. **Manifest global**: `window.__NG_ANNOTATE_MANIFEST__` is defined in the browser console (will be empty until manifest plugin is implemented in FEATURE-047, but the global should exist as a stub)
4. **Angular dev APIs**: `ng.getComponent(document.querySelector('app-root'))` in the browser console returns the root component instance (not undefined)
5. **Store file created**: `.ng-annotate/store.json` is created in the repo root when the browser connects to the WebSocket (will be empty until FEATURE-043 — verify the file is at least found or its absence is expected at this stage)
6. **MCP server connects**: Claude Code can connect to the `ng-annotate` MCP server defined in `.mcp.json`; `get_all_pending` (stub) returns without crashing

## Notes

- Items 3 and 5 may only be fully verifiable after their respective implementation issues (FEATURE-047, FEATURE-043). Note which items are confirmed and which are deferred
- The checkpoint for `get_all_pending` requires the MCP server stub to at least start without crashing (FEATURE-036)
- Document any failures as blockers in the relevant issues
