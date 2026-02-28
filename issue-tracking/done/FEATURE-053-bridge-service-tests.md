---
id: FEATURE-053-bridge-service-tests
type: feature
priority: high
effort: 3h
status: done
labels: [testing, phase-6, angular]
depends_on: [FEATURE-052-bridge-service-implementation]
blocks: [FEATURE-054-annotate-module-implementation]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Write BridgeService Jasmine tests

## Summary

Write Jasmine unit tests for `BridgeService` in the demo app's test suite. Tests mock the `WebSocket` constructor to intercept connections and messages.

## Acceptance Criteria

File: `demo/src/app/bridge.service.spec.ts`

**Setup**:
- Spy on `window.WebSocket` constructor to return a `mockWs` jasmine spy object
- Mock `mockWs`: `{ send: jasmine.createSpy(), close: jasmine.createSpy(), readyState: WebSocket.OPEN }`
- `beforeEach`: configure `TestBed`, inject service, call `service.init()`

**Test: emits session on `session:created` message**:
- Simulate `ws.onmessage` firing with `{ data: JSON.stringify({ type: 'session:created', session: { id: 'abc' } }) }`
- Assert: `service.session$.value` equals the session object

**Test: sends `annotation:create` message with correct payload**:
- Call `service.createAnnotation({ componentName: 'TestComponent', annotationText: 'Fix this' })`
- Assert: `mockWs.send` was called with a JSON string containing `{ type: 'annotation:create', payload: { componentName: 'TestComponent', ... } }`

**Test: updates `annotations$` when `annotations:sync` received**:
- Simulate `ws.onmessage` with `{ type: 'annotations:sync', annotations: [{ id: '1', status: 'pending' }] }`
- Assert: `service.annotations$.value` equals the annotations array

**Test: attempts reconnection after socket close**:
- Simulate `ws.onclose` firing
- Wait 3100ms (reconnect timer)
- Assert: `window.WebSocket` constructor was called a second time

All tests pass: `ng test --project=ng-annotate-demo --watch=false`
