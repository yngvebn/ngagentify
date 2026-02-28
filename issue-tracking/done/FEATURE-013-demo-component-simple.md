---
id: FEATURE-013-demo-component-simple
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

# Generate simple stateless demo component

## Summary

Use the Angular CLI to generate a simple, stateless presentational component with no inputs. This verifies baseline component inspection works.

## Acceptance Criteria

- Run: `ng generate component components/simple-card --project=ng-annotate-demo` from repo root
- Component is generated at `demo/src/app/components/simple-card/`
- Component template displays static content: a heading and a paragraph of lorem ipsum text
- Component has no `@Input()` properties
- Component selector is `app-simple-card` (element selector form)
- Component is rendered in the demo's root `AppComponent` template so it is visible in the browser
- App compiles without errors after generation

## Technical Notes

- Do not create the component files manually — always use `ng generate`
- The component serves as the baseline test case to confirm `InspectorService.getComponentContext()` works on the simplest possible target
