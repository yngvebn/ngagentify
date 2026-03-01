---
id: 4-FEATURE-network-request-context
type: feature
priority: low
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

# Feature: Network Request Context in Annotations

**Status**: Backlog
**Created**: 2026-03-01
**Priority**: Low
**Labels**: angular-lib, vite-plugin, mcp-server, dx, context
**Reporter**: User (brainstorm session)

## Problem Statement

When a developer annotates a data-displaying component (a table, a card list, a dashboard widget) the agent has no visibility into what API calls the component was making. If a component is showing stale data, missing items, or an error state, the root cause is often a failed or malformed HTTP request — but the agent can only see the rendered HTML and component inputs. Including a snapshot of recent network activity with the annotation gives the agent direct evidence to act on rather than having to guess.

## User Report

Brainstorm request: "Include recent failed HTTP requests in the annotation payload when annotating a data-displaying component."

## Acceptance Criteria

- [ ] `NetworkInterceptorService` intercepts `window.fetch` and `XMLHttpRequest` and records request/response metadata (URL, method, status, duration, error)
- [ ] Interception is passive — does not modify request or response bodies
- [ ] A rolling buffer of the last N requests (configurable, default 50) over the last M minutes (default 5) is maintained
- [ ] When a developer submits an annotation, recent network activity is included in a `networkContext` field on the annotation payload
- [ ] By default, only failed requests (non-2xx status, or network errors) are included to keep payload size small; a config option enables full request log
- [ ] Request bodies and response bodies are NOT captured (privacy/size concern); only metadata
- [ ] `NetworkInterceptorService` restores original `fetch` and `XHR` handlers on `ngOnDestroy`
- [ ] Config option exposed via `NgAnnotateModule.forRoot({ captureNetwork?: boolean | { includeSuccessful?: boolean; windowMs?: number; maxEntries?: number } })`
- [ ] Unit tests for fetch interception, XHR interception, buffer management, and handler restoration
- [ ] Integration test: annotation payload includes `networkContext` with a simulated failed request

## Root Cause Analysis

**Hypothesis**: Not a bug — absent from MVP scope. Fetch/XHR monkey-patching is standard and well-understood.

**Evidence**:
- `packages/angular/src/bridge.service.ts:createAnnotation()` — annotation payload is a free-form `Record<string, unknown>`; `networkContext` array can be added without schema changes at the bridge level
- `packages/vite-plugin/src/store.ts` — `Annotation` interface needs `networkContext?: NetworkEntry[]` added
- `packages/angular/src/overlay/overlay.component.ts:submit()` — attachment point; same pattern as `errorContext` in FEATURE-console-errors-as-annotations
- `packages/angular/src/ng-annotate.module.ts` — same `forRoot()` config surface needed as the console errors feature (if that ships first, it can be extended)

**Confidence Level**: High — standard monkey-patch pattern; plumbing already proven

## Affected Components

### Frontend
- **New service**: `packages/angular/src/network-interceptor.service.ts` — intercepts fetch + XHR, maintains rolling buffer
- **Overlay**: `packages/angular/src/overlay/overlay.component.ts:submit()` — attach `networkContext` from `NetworkInterceptorService.getRecentRequests()` when creating annotation
- **NgAnnotateModule**: `packages/angular/src/ng-annotate.module.ts` — extend `forRoot()` config (add `captureNetwork` option); provide `NetworkInterceptorService`
- **Types**: extend `Annotation` with `networkContext?: NetworkEntry[]`

### Vite Plugin
- **Store**: `packages/vite-plugin/src/store.ts` — add `networkContext?: NetworkEntry[]` to `Annotation` interface
- **ws-handler**: no change needed

### MCP Server
- No code changes needed — flows through annotation serialization automatically

## Code References

### Primary Location — new service skeleton
```typescript
// File: packages/angular/src/network-interceptor.service.ts (new file)
export interface NetworkEntry {
  url: string;
  method: string;
  status?: number;       // undefined on network error (no response)
  duration?: number;     // ms
  error?: string;        // error message if fetch threw
  timestamp: string;     // ISO
  failed: boolean;       // true if status >= 400 or threw
}

@Injectable()
export class NetworkInterceptorService implements OnDestroy {
  private buffer: NetworkEntry[] = [];
  private originalFetch = window.fetch.bind(window);
  private originalXhrOpen = XMLHttpRequest.prototype.open;
  private originalXhrSend = XMLHttpRequest.prototype.send;

  init(config: NetworkConfig): void { /* install interceptors */ }
  getRecentRequests(failedOnly = true, windowMs = 300_000): NetworkEntry[] { /* filter buffer */ }
  ngOnDestroy(): void { /* restore originals */ }
}
```

### Primary Location — fetch interception pattern
```typescript
// File: packages/angular/src/network-interceptor.service.ts
private interceptFetch(): void {
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const entry: NetworkEntry = {
      url: input.toString(),
      method: (init?.method ?? 'GET').toUpperCase(),
      timestamp: new Date().toISOString(),
      failed: false,
    };
    const start = performance.now();
    try {
      const response = await this.originalFetch(input, init);
      entry.status = response.status;
      entry.duration = Math.round(performance.now() - start);
      entry.failed = response.status >= 400;
      return response;
    } catch (err) {
      entry.error = String(err);
      entry.duration = Math.round(performance.now() - start);
      entry.failed = true;
      throw err;
    } finally {
      this.buffer.push(entry);
      if (this.buffer.length > this.maxEntries) this.buffer.shift();
    }
  };
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
  networkContext: this.networkInterceptor.getRecentRequests(),
});
```

### Related Location — Annotation schema extension
```typescript
// File: packages/vite-plugin/src/store.ts
interface Annotation {
  // ... existing fields ...
  networkContext?: NetworkEntry[];  // Recent HTTP activity at annotation time
}
```

## Test Coverage

### Existing Tests
- **Unit**: `packages/vite-plugin/src/store.test.ts` — annotation CRUD
- **Unit**: `packages/angular/src/bridge.service.spec.ts` — WebSocket communication

### Test Gaps
- [ ] `network-interceptor.service.spec.ts` — `window.fetch` intercepted; entry recorded with URL, method, status, duration
- [ ] `network-interceptor.service.spec.ts` — network error (fetch throws) recorded as `failed: true` with `error` string
- [ ] `network-interceptor.service.spec.ts` — XHR interception records same metadata
- [ ] `network-interceptor.service.spec.ts` — `getRecentRequests(failedOnly=true)` filters to only failed entries
- [ ] `network-interceptor.service.spec.ts` — rolling buffer respects `maxEntries` limit
- [ ] `network-interceptor.service.spec.ts` — `ngOnDestroy` restores `window.fetch` and `XHR` originals
- [ ] `overlay.component.spec.ts` — `submit()` includes `networkContext` in annotation payload when service is provided
- [ ] `store.test.ts` — `networkContext` persisted on annotation

## Architecture Context

**Design Patterns Involved**:
- Monkey-patching — same pattern as `ErrorInterceptorService`; must restore originals on destroy
- Rolling buffer — shared pattern with console error capture
- Angular `HttpClient` vs native fetch: if the Angular app uses `HttpClient`, an `HttpInterceptor` would be a more idiomatic integration point than monkey-patching. However, monkey-patching catches all network activity (third-party scripts, direct fetch calls) whereas `HttpInterceptor` only covers Angular-routed requests

**Dependencies**:
- No new npm dependencies
- Angular `HttpInterceptorFn` (Angular 15+ functional interceptors) as an alternative/complementary approach for Angular HttpClient calls

**Side Effects**:
- Monkey-patching `window.fetch` globally affects all requests in the page, including those from Angular DevTools or browser extensions. The buffer should exclude requests to `/__annotate` (the vite-plugin WebSocket endpoint) to avoid noise.
- `XMLHttpRequest` interception is more complex than fetch due to its event-based API; consider deferring XHR support to a follow-up if needed
- Privacy: URLs may contain query parameters with sensitive data (auth tokens, user IDs). The service should optionally strip query strings from recorded URLs, controlled by config.

## Proposed Solution Direction

**Strategy**:
1. Create `NetworkInterceptorService` with fetch interception (XHR as stretch goal)
2. Extend `NgAnnotateModule.forRoot()` with `captureNetwork` config (default: enabled, failed-only)
3. Extend `Annotation` schema with `networkContext?: NetworkEntry[]`
4. Attach in `OverlayComponent.submit()` — same as error context pattern
5. Filter out internal `/__annotate` requests from buffer

**Considerations**:
- Ship after `FEATURE-console-errors-as-annotations` if possible — both need `NgAnnotateModule.forRoot()` config surface; better to add that once
- Angular `HttpInterceptor` alternative is cleaner for Angular-specific apps but misses non-Angular fetch calls; worth supporting both
- URL sanitization (strip query params option) should be in v1 to avoid privacy concerns in team environments

**Estimated Complexity**: Moderate

## Related Issues

- FEATURE-console-errors-as-annotations (same `forRoot()` config surface needed; ship first)
- FEATURE-screenshot-capture (both extend annotation payload at creation time)

## Additional Context

The highest-value use case is `failedOnly: true` (the default) — a developer annotating a broken data component and the agent immediately seeing the 404 or 500 response that caused the broken state. This transforms the agent from a code-reader into an observability-aware assistant.

---

**Next Steps**: Ready for implementation. See `issue-tracking/AGENTS.md` for workflow.
