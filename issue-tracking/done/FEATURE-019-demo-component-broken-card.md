---
id: FEATURE-019-demo-component-broken-card
type: feature
priority: high
effort: 1h
status: done
labels: [demo, phase-0, angular]
depends_on: [FEATURE-005-demo-app-scaffold]
blocks: [FEATURE-010-scripts-demo-reset-sh, FEATURE-020-demo-app-module-integration, FEATURE-061-first-e2e-annotation-loop]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Generate deliberately broken demo component

## Summary

Use the Angular CLI to generate a component that intentionally contains a visible bug. This component is the primary target for the first real end-to-end annotation test in FEATURE-061.

## Acceptance Criteria

- Run: `ng generate component components/broken-card --project=ng-annotate-demo`
- Component renders a card UI with:
  - A title that displays the wrong text (e.g., "Welcme to the App" instead of "Welcome to the App")
  - A button with the wrong background color (e.g., `background: red` instead of `background: green`)
  - OR a layout issue (e.g., text overlapping, wrong font size)
- The bug is intentional and obvious — a developer would immediately want to annotate it
- The component is rendered visibly in `AppComponent`
- A comment in the component file documents what the correct behaviour should be, e.g.:
  ```ts
  // BUG: Title should say "Welcome to the App" — typo in template
  // BUG: Button color should be green (#22c55e), not red (#ef4444)
  ```
- After `npm run demo:reset`, the component is always in the broken state (verified by `git status` showing no changes)

## Technical Notes

- The bug must be in the component's source files (template or CSS) so that an agent fix involves editing those files
- Keep the component simple enough that the agent can fix it in a single targeted edit
- This component's path is hardcoded in `scripts/demo-reset.sh`: `demo/src/app/components/broken-card`
