---
id: FEATURE-016-demo-component-external-template
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

# Generate demo component with external templateUrl

## Summary

Use the Angular CLI to generate a component that uses `templateUrl` (external `.html` file) rather than an inline template. This verifies the manifest correctly captures the `templateFilePath` and that the agent receives the right file path.

## Acceptance Criteria

- Run: `ng generate component components/stats-panel --project=ng-annotate-demo` (CLI generates `templateUrl` by default)
- `StatsPanelComponent` uses `templateUrl: './stats-panel.component.html'` (not `template:`)
- The generated `stats-panel.component.html` contains some non-trivial content (table or list of stats)
- Component is rendered in `AppComponent` template
- After implementing the manifest plugin (FEATURE-047), `window.__NG_ANNOTATE_MANIFEST__['StatsPanelComponent']` has both:
  - `component: 'src/app/components/stats-panel/stats-panel.component.ts'`
  - `template: 'src/app/components/stats-panel/stats-panel.component.html'`
- App compiles without errors

## Technical Notes

- Angular CLI generates `templateUrl` by default — no special flags needed
- This component is specifically for verifying that `manifest.ts` parses `templateUrl` and resolves it relative to the component file
