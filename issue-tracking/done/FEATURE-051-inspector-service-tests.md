---
id: FEATURE-051-inspector-service-tests
type: feature
priority: high
effort: 3h
status: done
labels: [testing, phase-5, angular]
depends_on: [FEATURE-050-inspector-service-implementation]
blocks: [FEATURE-052-bridge-service-implementation]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Write InspectorService Jasmine tests

## Summary

Write Jasmine unit tests for `InspectorService` in the demo app's test suite (Karma environment). Tests must mock `ng.*` globals and `__NG_ANNOTATE_MANIFEST__` explicitly.

## Acceptance Criteria

File: `demo/src/app/inspector.service.spec.ts` (or appropriate test file path)

**Setup**:
- `beforeEach`: configure `TestBed` with `InspectorService` provider
- Mock `window.ng` with jasmine spy: `(window as any).ng = { getComponent: jasmine.createSpy('getComponent') }`
- Mock `window.__NG_ANNOTATE_MANIFEST__` with sample data

**Test: returns null when no component found**:
- `ng.getComponent` returns null for element and all ancestors
- Assert: `getComponentContext(el)` returns null

**Test: resolves component name, selector, and file paths from manifest**:
- `ng.getComponent` returns a mock component object with `constructor.name = 'HeaderComponent'` and `constructor.ɵcmp.selectors = [['app-header']]`
- Manifest has `HeaderComponent: { component: 'src/app/header/header.component.ts', template: 'src/app/header/header.component.html' }`
- Assert: `context.componentName === 'HeaderComponent'`
- Assert: `context.componentFilePath === 'src/app/header/header.component.ts'`
- Assert: `context.templateFilePath === 'src/app/header/header.component.html'`
- Assert: `context.selector === 'app-header'`

**Test: walks up DOM to find nearest component boundary**:
- `ng.getComponent` returns null for a child div but returns a component for the parent `<app-header>` element
- Assert: `getComponentContext(childDiv)` returns a non-null context for `HeaderComponent`

**Test: extracts @Input values from the component def**:
- Mock component has `ɵcmp.inputs = { title: 'title' }` and `component.title = 'Hello world'`
- Assert: `context.inputs` equals `{ title: 'Hello world' }`

**Test: caps domSnapshot at 5000 characters**:
- Create a component on an element whose `outerHTML` is 6000 characters long
- Assert: `context.domSnapshot.length <= 5020` (5000 + truncation suffix)

**Cleanup**:
- `afterEach`: delete `(window as any).ng` and `(window as any).__NG_ANNOTATE_MANIFEST__`

All tests pass: `ng test --project=ng-annotate-demo --watch=false`

## Technical Notes

- Tests live in the demo app's test suite (not a separate package) because they need Karma + browser environment
- The `TestBed` approach ensures Angular DI works correctly
