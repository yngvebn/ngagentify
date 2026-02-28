---
id: FEATURE-018-demo-component-list-rendering
type: feature
priority: medium
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

# Generate list-rendering demo component

## Summary

Use the Angular CLI to generate a component that renders a list of items using `*ngFor`, verifying that clicking on a list item correctly resolves to the right component rather than a parent.

## Acceptance Criteria

- Run: `ng generate component components/task-list --project=ng-annotate-demo`
- Run: `ng generate component components/task-list/task-item --project=ng-annotate-demo`
- `TaskListComponent` has an `items: string[]` input and renders `<app-task-item>` via `*ngFor`
- `TaskItemComponent` has a `label: string` input and renders the label
- `AppComponent` renders `<app-task-list [items]="['Task A', 'Task B', 'Task C']">`
- When the inspector clicks on a rendered task item element, `getComponentContext()` resolves to `TaskItemComponent`, not `TaskListComponent`
- App compiles without errors

## Technical Notes

- The `*ngFor` case tests that `ng.getComponent()` correctly resolves the innermost component boundary when list items are rendered as separate component instances
- Each `<app-task-item>` is its own component instance, not just a DOM element inside `TaskListComponent`
