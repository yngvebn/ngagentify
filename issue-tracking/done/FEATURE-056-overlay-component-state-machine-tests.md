---
id: FEATURE-056-overlay-component-state-machine-tests
type: feature
priority: high
effort: 3h
status: done
labels: [testing, phase-7, angular]
depends_on: [FEATURE-055-bridge-annotation-submission-test]
blocks: [FEATURE-057-overlay-component-template]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Write OverlayComponent state machine tests FIRST

## Summary

Write all Jasmine tests for `OverlayComponent` mode transitions BEFORE implementing the component. These tests define the expected behavior. Tests will initially fail — that's correct. Implementation follows in FEATURE-057 through FEATURE-059.

## Acceptance Criteria

File: `demo/src/app/overlay.component.spec.ts` (or appropriate path after ng generate)

**Setup**:
- `TestBed` with mock `InspectorService` and mock `BridgeService`
- `mockBridge.annotations$` as a `BehaviorSubject<Annotation[]>` initialized to `[]`

**Test: starts in hidden mode**: `expect(component.mode).toBe('hidden')`

**Test: Alt+Shift+A transitions to inspect mode**:
- Call `component.toggleInspect(new KeyboardEvent('keydown'))`
- Assert: `component.mode === 'inspect'`

**Test: Alt+Shift+A again returns to hidden from inspect mode**:
- Set `component.mode = 'inspect'`; call `toggleInspect` again
- Assert: `component.mode === 'hidden'`

**Test: click when inspect mode finds component → transitions to annotate**:
- Set `component.mode = 'inspect'`
- Mock `inspectorSpy.getComponentContext` to return a mock `ComponentContext`
- Create a DOM element, append to body, fire a click via `component.onClick(mockMouseEvent)`
- Assert: `component.mode === 'annotate'`

**Test: click when inspect mode finds no component → stays in inspect**:
- `inspectorSpy.getComponentContext` returns null
- Assert: mode remains `'inspect'`

**Test: Escape from annotate → returns to inspect**:
- Set `component.mode = 'annotate'`; call `component.onEscape()`
- Assert: `component.mode === 'inspect'`

**Test: Escape from inspect → returns to hidden**:
- Set `component.mode = 'inspect'`; call `component.onEscape()`
- Assert: `component.mode === 'hidden'`

**Test: Escape from thread → returns to hidden**:
- Set `component.mode = 'thread'`; call `component.onEscape()`
- Assert: `component.mode === 'hidden'`

**Test: submit with blank annotationText → does nothing**:
- Set `component.mode = 'annotate'`, `component.annotationText = '   '`
- Call `component.submit()`
- Assert: `bridgeSpy.createAnnotation` was NOT called; mode stays `'annotate'`

**Test: submit with valid text → calls createAnnotation and resets**:
- Set up `selectedContext`, `annotationText = 'Fix this'`
- Call `component.submit()`
- Assert: `bridgeSpy.createAnnotation` was called; `component.selectedContext` is null; `component.annotationText === ''`

All test files compile; tests can be run (some will fail until implementation): `ng test --project=ng-annotate-demo --watch=false`
