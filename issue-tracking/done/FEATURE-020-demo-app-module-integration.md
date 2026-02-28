---
id: FEATURE-020-demo-app-module-integration
type: feature
priority: high
effort: 1h
status: done
labels: [demo, phase-0, angular]
depends_on: [FEATURE-005-demo-app-scaffold, FEATURE-013-demo-component-simple, FEATURE-014-demo-component-inputs, FEATURE-015-demo-component-nested-tree, FEATURE-016-demo-component-external-template, FEATURE-017-demo-component-attribute-selector, FEATURE-018-demo-component-list-rendering, FEATURE-019-demo-component-broken-card]
blocks: [FEATURE-023-verify-phase0-checkpoints]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Wire NgAnnotateModule into demo app.module.ts

## Summary

Update the demo app's `app.module.ts` to import `NgAnnotateModule` using `isDevMode()` guard, and ensure all demo components are declared. This is the integration pattern that real consumers will follow.

## Acceptance Criteria

- `demo/src/app/app.module.ts` imports `NgAnnotateModule` from `@ng-annotate/angular`:
  ```ts
  imports: [
    BrowserModule,
    isDevMode() ? NgAnnotateModule : []
  ]
  ```
- All demo components (simple-card, profile-card, page-layout, stats-panel, highlight-box, task-list, task-item, broken-card, and the nested tree components) are declared in `AppModule`
- `AppComponent` template renders all top-level demo components visibly on the page
- App compiles and runs at `localhost:4200` without errors
- In dev mode, `NgAnnotateModule` is loaded; in production build, it is not (verified by checking the import guard)

## Technical Notes

- At this stage, `NgAnnotateModule` is a stub (from FEATURE-004) — the import itself just needs to be present and not throw
- The actual `NgAnnotateModule` implementation comes in FEATURE-054
- Using `isDevMode() ? NgAnnotateModule : []` is the official pattern from the spec
