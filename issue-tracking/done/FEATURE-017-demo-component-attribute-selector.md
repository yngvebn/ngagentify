---
id: FEATURE-017-demo-component-attribute-selector
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

# Generate demo component with attribute selector

## Summary

Use the Angular CLI to generate a component (or directive) with an attribute-form selector like `[appHighlight]`, verifying that `InspectorService` handles non-element selectors correctly.

## Acceptance Criteria

- Run: `ng generate component components/highlight-box --project=ng-annotate-demo`
- Manually change the generated component's selector from `'app-highlight-box'` to `'[appHighlightBox]'` (attribute selector form)
- Component renders a coloured highlight box around its content when applied as an attribute
- Used in `AppComponent` template as: `<div appHighlightBox>Highlighted content</div>`
- App compiles without errors
- `InspectorService.getSelector()` returns `'[appHighlightBox]'` when inspecting this component (tested in FEATURE-051)

## Technical Notes

- Attribute selectors are a common Angular pattern — verify the manifest and inspector handle them without assuming all selectors are element selectors
- The `ɵcmp.selectors` array format differs for attribute selectors vs element selectors and needs to be handled in `inspector.service.ts`
