---
id: 3-FEATURE-console-errors-as-annotations
type: feature
priority: medium
effort: 2d
status: backlog
labels: [angular-lib, vite-plugin, mcp-server, dx, context]
depends_on: []
blocks: []
created: 2026-03-01
updated: 2026-03-01
started: null
completed: null
---

# Feature: Console Errors as Annotations

**Status**: Backlog
**Created**: 2026-03-01
**Priority**: Medium
**Labels**: angular-lib, vite-plugin, mcp-server, dx, context
**Reporter**: User (brainstorm session)

## Problem Statement

When a component throws a runtime error or logs an error to the console, the developer must manually open DevTools, read the error, and then create an annotation describing what they saw. This creates friction and loses context — the annotation text is a human paraphrase of the original error rather than the error itself.

Two related capabilities would close this gap:
1. **Passive capture**: errors that occur during normal use are queued; when the developer opens the overlay to annotate a component, recent errors are automatically included in the annotation payload.
2. **Active surfacing**: uncaught errors automatically create a pending annotation on the component that threw (if it can be identified), so the developer doesn't even need to initiate the flow.

## User Report

Brainstorm request: "Capture uncaught JS errors from the browser and automatically surface them as actionable annotations."

## Acceptance Criteria

- [ ] `ErrorInterceptorService` intercepts `window.onerror`, `window.onunhandledrejection`, and `console.error` / `console.warn`
- [ ] Errors are buffered (rolling window, last 20 entries, max 5 minutes old)
- [ ] When a developer manually creates an annotation, recent buffered errors are included in `errorContext` on the annotation payload
- [ ] Optionally (behind a config flag `autoAnnotateErrors: boolean`), uncaught errors auto-create a pending annotation on the component nearest the throw site (identified from the stack trace + manifest)
- [ ] Auto-created annotations are visually distinct in the overlay (e.g., a red badge icon) so the developer knows they were agent-initiated
- [ ] `ErrorInterceptorService` restores original handlers on `ngOnDestroy` (no permanent monkey-patching)
- [ ] Config option exposed in `NgAnnotateModule.forRoot({ autoAnnotateErrors: false })` (default off)
- [ ] Unit tests for error buffering, handler restoration, and stack-trace component matching
- [ ] E2E: throw an error in a component → auto-annotation badge appears on that component

## Root Cause Analysis

**Hypothesis**: Not a bug — feature is absent from the MVP scope. The browser APIs needed (`window.onerror`, `window.onunhandledrejection`) are well-supported and the annotation creation path is already proven.

**Evidence**:
- `packages/angular/src/bridge.service.ts` — `createAnnotation()` method already exists; auto-annotations would call it programmatically rather than from user input
- `packages/angular/src/inspector.service.ts` — `findNearestComponent(element)` resolves components by DOM element; stack traces identify file paths which can be cross-referenced with `window.__NG_ANNOTATE_MANIFEST__` to find the component
- `packages/angular/src/overlay/overlay.component.ts` — badge rendering iterates annotations from `bridge.annotations$`; auto-created annotations appear in the same feed
- `packages/vite-plugin/src/store.ts` — `Annotation` has no `errorContext` or `autoCreated` fields; both need adding
- `packages/angular/src/ng-annotate.module.ts` — `NgAnnotateModule` has no `forRoot()` config surface today; needs adding for the feature flag

**Confidence Level**: High for passive capture (straightforward); Medium for auto-annotation (stack trace → component mapping is heuristic and may be imprecise)

## Affected Components

### Frontend
- **New service**: `packages/angular/src/error-interceptor.service.ts` — intercepts errors, maintains rolling buffer, resolves component from stack trace
- **Overlay**: `packages/angular/src/overlay/overlay.component.ts:submit()` — attach `errorContext` from `ErrorInterceptorService.getRecentErrors()` when creating an annotation
- **NgAnnotateModule**: `packages/angular/src/ng-annotate.module.ts` — add `forRoot(config)` to expose `autoAnnotateErrors` flag; provide `ErrorInterceptorService`
- **Types**: extend `Annotation` with `errorContext?: ErrorEntry[]` and `autoCreated?: boolean`

### Vite Plugin
- **Store**: `packages/vite-plugin/src/store.ts` — add `errorContext?: ErrorEntry[]` and `autoCreated?: boolean` to `Annotation` interface
- **ws-handler**: no change needed — `annotation:create` handler passes payload through

### MCP Server
- No code changes needed — error context flows through annotation serialization automatically

## Code References

### Primary Location — new service skeleton
```typescript
// File: packages/angular/src/error-interceptor.service.ts (new file)
export interface ErrorEntry {
  type: 'error' | 'unhandledrejection' | 'console.error' | 'console.warn';
  message: string;
  stack?: string;
  timestamp: string;
}

@Injectable()
export class ErrorInterceptorService implements OnDestroy {
  private buffer: ErrorEntry[] = [];
  private originalConsoleError = console.error;
  private originalConsoleWarn = console.warn;
  private originalOnError = window.onerror;
  private originalOnUnhandledRejection = window.onunhandledrejection;

  init(): void { /* install interceptors */ }
  getRecentErrors(windowMs = 300_000): ErrorEntry[] { /* last 5 min */ }
  ngOnDestroy(): void { /* restore originals */ }
}
```

### Primary Location — overlay submit attachment point
```typescript
// File: packages/angular/src/overlay/overlay.component.ts (submit method)
this.bridge.createAnnotation({
  ...this.selectedContext,
  annotationText: this.annotationText,
  selectionText: this.selectionText ?? undefined,
  // Add:
  errorContext: this.errorInterceptor.getRecentErrors(),
});
```

### Primary Location — module config surface
```typescript
// File: packages/angular/src/ng-annotate.module.ts
// Needs: NgAnnotateModule.forRoot({ autoAnnotateErrors?: boolean })
```

### Related Location — stack-trace to component mapping (new logic)
```typescript
// File: packages/angular/src/error-interceptor.service.ts
private resolveComponentFromStack(stack: string): string | null {
  // Parse stack frames for file paths
  // Cross-reference with window.__NG_ANNOTATE_MANIFEST__
  // Return component name if match found, null otherwise
}
```

## Test Coverage

### Existing Tests
- **Unit**: `packages/angular/src/bridge.service.spec.ts` — covers WebSocket communication
- **Angular**: `demo/src/app/**/*.spec.ts` — component-level tests

### Test Gaps
- [ ] `error-interceptor.service.spec.ts` — `window.onerror` intercepted and buffered
- [ ] `error-interceptor.service.spec.ts` — `window.onunhandledrejection` intercepted
- [ ] `error-interceptor.service.spec.ts` — `console.error` intercepted; original still called
- [ ] `error-interceptor.service.spec.ts` — rolling buffer respects 5-minute window
- [ ] `error-interceptor.service.spec.ts` — `ngOnDestroy` restores all original handlers
- [ ] `error-interceptor.service.spec.ts` — `resolveComponentFromStack` matches manifest entry from stack frame
- [ ] `overlay.component.spec.ts` — `submit()` includes `errorContext` in annotation payload
- [ ] E2E — throw runtime error in demo component → annotation badge appears (when `autoAnnotateErrors: true`)

## Architecture Context

**Design Patterns Involved**:
- Angular service lifecycle — `OnDestroy` ensures handler cleanup on module teardown
- Monkey-patching — standard pattern; must preserve and restore originals
- BridgeService pub/sub — auto-created annotations use the same `createAnnotation()` path as user-created ones; they flow through the same WebSocket → store → MCP pipeline

**Dependencies**:
- No new npm dependencies needed
- Angular `DestroyRef` (Angular 16+) or `OnDestroy` lifecycle hook for cleanup

**Side Effects**:
- `console.error` interception may suppress third-party library errors if not careful — the original must always be called
- Auto-annotation spam risk: a single bug that fires `onerror` on every change detection cycle could create hundreds of annotations per second. The service must deduplicate (same message + stack = skip if already in buffer within last N seconds)
- Stack trace parsing is fragile across minified bundles — dev mode source maps help but this is best-effort for the auto-annotation path

## Proposed Solution Direction

**Strategy**:
1. Create `ErrorInterceptorService` with interceptors, rolling buffer, and deduplication
2. Add `NgAnnotateModule.forRoot(config)` to wire up the service conditionally
3. Extend `Annotation` schema with `errorContext` and `autoCreated` fields
4. Attach `errorContext` in `OverlayComponent.submit()` (always, when buffer is non-empty)
5. Auto-annotation path (when flag enabled): on `window.onerror`, attempt stack → component mapping; if matched, call `bridge.createAnnotation()` with `autoCreated: true`

**Considerations**:
- Ship passive capture (attach to manual annotations) first — it is safe and high-value
- Ship auto-annotation as a separate, opt-in phase behind the flag — it is riskier and needs dedup/rate-limiting work
- Alternative for auto-annotation: instead of creating an annotation automatically, show a non-intrusive toast in the overlay ("Error detected in CardComponent — click to annotate") and let the user decide

**Estimated Complexity**: Moderate

## Related Issues

- FEATURE-network-request-context (same passive-capture pattern, network layer)
- FEATURE-diff-preview-before-apply (both improve agent decision quality)

## Additional Context

Angular dev mode already catches most component errors through `ErrorHandler`. Hooking into Angular's `ErrorHandler` (`@Injectable() class NgAnnotateErrorHandler extends ErrorHandler`) is a cleaner alternative to `window.onerror` for Angular-specific errors — it receives the component error and the component instance, making component identification trivial without stack-trace parsing.

---

**Next Steps**: Ready for implementation. See `issue-tracking/AGENTS.md` for workflow.
