---
id: FEATURE-015-demo-component-nested-tree
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

# Generate nested component tree (3–4 levels deep)

## Summary

Use the Angular CLI to generate a set of nested components so that `componentTreePath` can be tested with real ancestor chains.

## Acceptance Criteria

- Generate four components:
  1. `ng generate component components/page-layout --project=ng-annotate-demo`
  2. `ng generate component components/page-layout/section-panel --project=ng-annotate-demo`
  3. `ng generate component components/page-layout/section-panel/content-block --project=ng-annotate-demo`
  4. `ng generate component components/page-layout/section-panel/content-block/leaf-widget --project=ng-annotate-demo`
- Each parent renders the next level in its template, forming a chain: `PageLayout → SectionPanel → ContentBlock → LeafWidget`
- `AppComponent` renders `<app-page-layout>`
- App compiles without errors
- When inspecting `<app-leaf-widget>`, `componentTreePath` should contain `['AppComponent', 'PageLayoutComponent', 'SectionPanelComponent', 'ContentBlockComponent']`

## Technical Notes

- The nesting must be real Angular component nesting in the DOM, not just TypeScript class inheritance
- Each level can contain just a heading and a `<ng-content>` slot (or explicit child selector) to keep the templates minimal
