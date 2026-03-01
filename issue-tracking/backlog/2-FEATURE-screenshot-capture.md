---
id: 2-FEATURE-screenshot-capture
type: feature
priority: medium
effort: 1d
status: backlog
labels: [angular-lib, vite-plugin, mcp-server, overlay, context]
depends_on: []
blocks: []
created: 2026-03-01
updated: 2026-03-01
started: null
completed: null
---

# Feature: Screenshot Capture of Annotated Element

**Status**: Backlog
**Created**: 2026-03-01
**Priority**: Medium
**Labels**: angular-lib, vite-plugin, mcp-server, overlay, context
**Reporter**: User (brainstorm session)

## Problem Statement

The agent currently receives only text context about annotated components: `domSnapshot` (truncated outerHTML), `inputs`, `selector`, and `annotationText`. For visually-oriented requests ("the card looks broken", "this layout is off", "the button overlaps the text") the agent has no visual reference and must infer layout from HTML structure alone. Including a screenshot of the annotated element as visual context would let the agent reason about visual bugs and layout issues far more accurately.

## User Report

Brainstorm request: "Capture a screenshot of the selected/annotated element and include it as visual context in the annotation payload sent to the agent."

## Acceptance Criteria

- [ ] When a developer submits an annotation, a screenshot of the annotated element is captured in the browser
- [ ] Screenshot is attached to the annotation payload sent to the vite-plugin WebSocket handler
- [ ] Screenshot is stored in the annotation (base64 PNG or object URL) and persisted in store.json
- [ ] MCP `get_session` and `get_all_pending` tools include a `screenshotUrl` or `screenshotBase64` field on annotations when present
- [ ] Agent can use the screenshot as visual context when deciding what to change
- [ ] Screenshot capture is best-effort: if it fails (e.g., cross-origin iframe), annotation still submits without it
- [ ] Unit tests for the new `ScreenshotService`
- [ ] Integration test: annotation payload includes screenshot field

## Root Cause Analysis

**Hypothesis**: Feature is absent because `domSnapshot` was considered sufficient for MVP. The browser Canvas API / `html2canvas` approach is well-understood and low-risk.

**Evidence**:
- `packages/angular/src/inspector.service.ts` — `snapshot(element)` returns `element.outerHTML.slice(0, 5000)`; no visual capture
- `packages/angular/src/overlay/overlay.component.ts` — `submit()` calls `bridge.createAnnotation({ ...selectedContext, annotationText, selectionText })`; no screenshot step
- `packages/vite-plugin/src/store.ts` — `Annotation` interface has no `screenshot` field
- `packages/mcp-server/src/tools.ts` — tool responses serialize the full annotation; screenshot would flow through automatically once stored

**Confidence Level**: High — the capture mechanism is standard browser API; the plumbing already exists

## Affected Components

### Frontend
- **New service**: `packages/angular/src/screenshot.service.ts` — captures element as base64 PNG using `html2canvas` or native Canvas API
- **Overlay**: `packages/angular/src/overlay/overlay.component.ts:submit()` — call screenshot service before `bridge.createAnnotation()`; attach result
- **Types**: extend `ComponentContext` / `Annotation` with `screenshot?: string`

### Vite Plugin
- **Store**: `packages/vite-plugin/src/store.ts` — add `screenshot?: string` to `Annotation` interface
- **ws-handler**: `packages/vite-plugin/src/ws-handler.ts` — `annotation:create` handler already passes payload through to `store.createAnnotation()`; no logic change needed if schema is extended

### MCP Server
- No code changes needed — tools serialize full annotation objects; screenshot field flows through automatically

## Code References

### Primary Location — inspector snapshot (text-only today)
```typescript
// File: packages/angular/src/inspector.service.ts
private snapshot(element: Element): string {
  return element.outerHTML.slice(0, 5000);
}
// Screenshot capture lives in a new ScreenshotService, not here
```

### Primary Location — overlay submit (attachment point)
```typescript
// File: packages/angular/src/overlay/overlay.component.ts (submit method)
this.bridge.createAnnotation({
  ...this.selectedContext,
  annotationText: this.annotationText,
  selectionText: this.selectionText ?? undefined,
});
// Needs: screenshot?: string added after awaiting ScreenshotService.captureElement()
```

### Primary Location — Annotation schema extension
```typescript
// File: packages/vite-plugin/src/store.ts
interface Annotation {
  // ... existing fields ...
  domSnapshot: string;
  // Add:
  screenshot?: string;  // base64 PNG data URL; omitted if capture failed
}
```

### Related Location — store createAnnotation (passes payload through)
```typescript
// File: packages/vite-plugin/src/store.ts
async createAnnotation(payload: CreateAnnotationPayload): Promise<Annotation>
// payload already passes through from ws-handler; no change if Annotation schema is extended
```

## Test Coverage

### Existing Tests
- **Unit**: `packages/angular/src/inspector.service.spec.ts` — covers component context extraction
- **Unit**: `packages/vite-plugin/src/store.test.ts` — covers annotation creation

### Test Gaps
- [ ] `screenshot.service.spec.ts` — mock Canvas API; assert base64 PNG output for a given element
- [ ] `screenshot.service.spec.ts` — graceful degradation when `html2canvas` throws (cross-origin, permissions)
- [ ] `overlay.component.spec.ts` — `submit()` awaits screenshot and includes it in `createAnnotation` payload
- [ ] `store.test.ts` — `createAnnotation` persists `screenshot` field when present

## Architecture Context

**Design Patterns Involved**:
- Angular `@Injectable` service pattern — `ScreenshotService` follows same pattern as `InspectorService`
- Best-effort async: screenshot capture wraps in try/catch so annotation submission is never blocked

**Dependencies**:
- `html2canvas` npm package (popular, ~60 KB gzipped) — OR use native `element.getClientRects()` + `OffscreenCanvas` (no extra dep but more complex)
- Recommend `html2canvas` for reliability; add to `packages/angular/package.json` as a peer/optional dependency

**Side Effects**:
- Base64 PNGs of a typical component element are 10–100 KB; store.json could grow significantly with many annotations. Consider storing only a thumbnail (e.g., max 400px wide) or a reference rather than inline base64.
- Screenshots may capture sensitive data (PII in tables, auth tokens in debug views). Should be documented as a dev-only tool risk.

## Proposed Solution Direction

**Strategy**:
1. Add `ScreenshotService` to `packages/angular/src/` using `html2canvas`; export from `NgAnnotateModule`
2. In `OverlayComponent.submit()`, `await screenshotService.captureElement(this.selectedElement)` (best-effort, no blocking)
3. Extend `Annotation` schema with `screenshot?: string`; update `CreateAnnotationPayload`
4. Store persists as-is (no change to ws-handler logic)
5. MCP tools automatically expose the field since they serialize full annotation objects

**Considerations**:
- Size concern: thumbnail or max-dimension cap recommended (e.g., resize to 800px max before encoding)
- Alternative: store screenshot as a separate file in `.ng-annotate/screenshots/<annotationId>.png` and store only the path — avoids bloating store.json but adds file I/O complexity
- `html2canvas` has known limitations with CSS `transform`, `overflow: hidden` on parents, and SVG — document these

**Estimated Complexity**: Simple

## Related Issues

- FEATURE-diff-preview-before-apply (both extend Annotation schema)
- FEATURE-network-request-context (both extend annotation payload captured at creation time)

## Additional Context

Visual context is especially valuable for layout and styling annotations. Even a rough screenshot lets the agent confirm it is looking at the right element and gives it signal about visual state (hidden elements, overflow, computed styles) that `outerHTML` alone cannot convey.

---

**Next Steps**: Ready for implementation. See `issue-tracking/AGENTS.md` for workflow.
