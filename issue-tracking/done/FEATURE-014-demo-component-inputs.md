---
id: FEATURE-014-demo-component-inputs
type: feature
priority: high
effort: 1h
status: done
labels: [demo, phase-0, angular]
depends_on: [FEATURE-005-demo-app-scaffold]
blocks: [FEATURE-020-demo-app-module-integration]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Generate demo components with @Input() properties

## Summary

Use the Angular CLI to generate components that accept `@Input()` properties of different types to verify that input extraction and display works correctly.

## Acceptance Criteria

- Run: `ng generate component components/profile-card --project=ng-annotate-demo` from repo root
- `ProfileCardComponent` has these `@Input()` properties:
  - `name: string = 'Default Name'`
  - `age: number = 0`
  - `tags: string[] = []`
  - `metadata: Record<string, unknown> = {}`
- Template renders all four inputs visibly
- Component is rendered in `AppComponent` with sample values bound to each input:
  - `<app-profile-card [name]="'Alice'" [age]="30" [tags]="['admin', 'user']" [metadata]="{ role: 'admin' }"></app-profile-card>`
- App compiles without errors

## Technical Notes

- Multiple components with inputs are acceptable; one well-structured component covering all four value types (string, number, array, object) satisfies the spec requirement
- The inputs must be real `@Input()` decorators — not signals — so `InspectorService` can extract them via `ɵcmp.inputs`
