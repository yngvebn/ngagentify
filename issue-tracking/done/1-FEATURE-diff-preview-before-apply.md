---
id: 1-FEATURE-diff-preview-before-apply
type: feature
priority: high
effort: 3d
status: done
labels: [ux, angular-lib, vite-plugin, mcp-server, overlay]
depends_on: []
blocks: []
created: 2026-03-01
updated: 2026-03-01
started: 2026-03-01
completed: null
---

# Feature: Diff Preview Before Apply

**Status**: Backlog
**Created**: 2026-03-01
**Priority**: High
**Labels**: ux, angular-lib, vite-plugin, mcp-server, overlay
**Reporter**: User (brainstorm session)

## Problem Statement

Currently the agent writes file changes directly to disk and then calls `resolve()`. The developer has no opportunity to review what changed before it is applied — they only see the badge flip from ◐ to ✓ and then hot-reload fires. For larger or more complex changes this is dangerous: a misunderstood annotation could silently introduce bugs or unwanted restructuring.

A diff preview step would surface the proposed changes in the overlay UI before they hit disk, giving the developer a chance to approve, reject, or refine the request.

## User Report

Brainstorm request: "Show a unified diff in the overlay before the agent writes to disk, letting the developer approve/reject the change."

## Acceptance Criteria

- [ ] Agent can call a new MCP tool `propose_diff(id, diff)` to attach a unified diff string to an annotation
- [ ] Annotation status transitions: `pending` → `acknowledged` → `diff_proposed` → `resolved` / `dismissed`
- [ ] Overlay renders the diff in a new `preview` mode (syntax-highlighted, side-by-side or unified)
- [ ] Developer can click **Apply** (agent proceeds, calls `resolve`) or **Reject** (agent receives rejection signal, can revise)
- [ ] Rejection sends a `diff:rejected` message back to the agent via WebSocket → MCP watch loop surfaces it
- [ ] Approval sends a `diff:approved` message; agent then writes the file and calls `resolve`
- [ ] The 2-second `annotations:sync` broadcast propagates `diff` field so overlay always reflects latest proposal
- [ ] Unit tests for new MCP tool and new store status
- [ ] E2E test: annotate → agent proposes diff → developer approves → file written → resolved

## Root Cause Analysis

**Hypothesis**: The feature is absent by design (MVP shipped without it). No architectural blocker exists — the sync channel and overlay UI modes are already extensible.

**Evidence**:
- `packages/vite-plugin/src/store.ts` — `Annotation` interface has no `diff` or approval fields; adding them is backwards-compatible (optional fields)
- `packages/vite-plugin/src/ws-handler.ts:setInterval` — existing 2-second sync already broadcasts full annotation objects to browser; diff field rides this for free
- `packages/angular/src/overlay/overlay.component.ts` — `OverlayMode` is `'hidden' | 'inspect' | 'annotate' | 'thread'`; a `'preview'` mode needs to be added
- `packages/mcp-server/src/tools.ts` — 8 registered tools; new `propose_diff` and `watch_diff_response` tools needed
- Agent workflow in `CLAUDE.md` has no approval step between editing and `resolve()`

**Confidence Level**: High — clear gap, well-defined extension points

## Affected Components

### Frontend
- **Overlay**: `packages/angular/src/overlay/overlay.component.ts` — add `preview` mode, diff rendering, Approve/Reject buttons
- **BridgeService**: `packages/angular/src/bridge.service.ts` — handle `diff:approved` / `diff:rejected` outbound messages; handle `annotation:diff_proposed` inbound
- **Types**: `packages/angular/src/types.ts` (or shared types) — extend `Annotation` with `diff?: string`, add `'diff_proposed'` status

### Vite Plugin
- **Store**: `packages/vite-plugin/src/store.ts` — add `diff?: string` to `Annotation`; add `'diff_proposed'` to status union
- **ws-handler**: `packages/vite-plugin/src/ws-handler.ts` — handle `diff:approved` / `diff:rejected` browser messages; notify watchers so MCP poll picks up the response

### MCP Server
- **Tools**: `packages/mcp-server/src/tools.ts` — add `propose_diff(id, diff)` tool; extend `watch_annotations` or add `watch_diff_response(id)` for agent to await developer decision

## Code References

### Primary Location — Annotation status union
```typescript
// File: packages/vite-plugin/src/store.ts (status field of Annotation interface)
status: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
// Needs: 'diff_proposed' added
```

### Primary Location — OverlayMode
```typescript
// File: packages/angular/src/overlay/overlay.component.ts
type OverlayMode = 'hidden' | 'inspect' | 'annotate' | 'thread';
// Needs: 'preview' added with diff render + Approve/Reject controls
```

### Related Location — WebSocket sync (diff rides existing channel)
```typescript
// File: packages/vite-plugin/src/ws-handler.ts (setInterval sync)
setInterval(() => {
  for (const [sessionId, ws] of sessionSockets) {
    safeSend(ws, { type: 'annotations:sync', annotations: ... })
  }
}, 2000);
// No change needed — diff field on annotation flows through automatically
```

### Related Location — MCP tools registration
```typescript
// File: packages/mcp-server/src/tools.ts
// Needs: propose_diff(id: string, diff: string) tool
// Needs: watch_diff_response(id: string, timeoutMs?: number) tool (long-poll)
```

## Test Coverage

### Existing Tests
- **Unit**: `packages/vite-plugin/src/store.test.ts` — covers `createAnnotation`, `updateAnnotation`, `addReply`
- **Unit**: `packages/mcp-server/src/tools.test.ts` — covers existing 8 tools
- **E2E**: `tests/` — Playwright suite covering annotation create → resolve flow

### Test Gaps
- [ ] `store.test.ts` — `propose_diff` updates `diff` field and sets status `diff_proposed`
- [ ] `tools.test.ts` — `propose_diff` tool validation and store interaction
- [ ] `tools.test.ts` — `watch_diff_response` long-poll returns when browser approves/rejects
- [ ] `overlay.component.spec.ts` — `preview` mode renders diff, Approve fires `diff:approved`, Reject fires `diff:rejected`
- [ ] E2E — full approve flow and full reject flow

## Architecture Context

**Design Patterns Involved**:
- Existing pub/sub: `store.notifyWatchers()` already fans out to MCP `watch_annotations` subscribers — same mechanism can notify `watch_diff_response`
- Existing badge sync: 2-second `annotations:sync` broadcasts full annotation objects; diff string is just another optional field

**Dependencies**:
- A diff-rendering library for the overlay (e.g., `diff2html`, or a simple `<pre>` with color classes — keep dependency lightweight)
- No new backend dependencies needed

**Side Effects**:
- Agent workflow changes: agent must `propose_diff` and await approval before writing files. CLAUDE.md work loop instructions need updating.
- Status union expansion is backwards-compatible (existing `pending/acknowledged/resolved/dismissed` values unchanged)

## Proposed Solution Direction

**Strategy**: Three-phase addition

1. **Store + types** — add `diff?: string` field and `'diff_proposed'` status to `Annotation`; update both `packages/vite-plugin/src/store.ts` and shared types
2. **MCP layer** — register `propose_diff(id, diff)` tool (sets status + stores diff); register `watch_diff_response(id)` tool (long-polls for `diff:approved`/`diff:rejected` browser messages)
3. **Overlay** — add `preview` OverlayMode that renders the diff and exposes Approve/Reject; wire buttons to `bridge.sendMessage({ type: 'diff:approved'|'diff:rejected', id })`; update agent work-loop docs

**Considerations**:
- Diff string size: unified diffs for typical Angular component edits are small (< 5 KB); no storage concern
- Timeout: `watch_diff_response` should have a configurable timeout (default 5 minutes) after which it returns a timeout status so agent can decide to auto-apply or ask again
- Alternative: skip a dedicated `watch_diff_response` tool and instead surface the approval/rejection as a standard annotation reply that `watch_annotations` already returns — simpler but less semantically clear

**Estimated Complexity**: Moderate

## Related Issues

- FEATURE-screenshot-capture (both extend the Annotation schema)
- FEATURE-console-errors-as-annotations (both extend browser-side capture)

## Additional Context

The diff preview is the highest-value UX safety net in the backlog. It decouples the agent's decision-making from the irreversible act of writing files, which is especially important as annotations grow more complex.

---

**Next Steps**: Ready for implementation. See `issue-tracking/AGENTS.md` for workflow.
