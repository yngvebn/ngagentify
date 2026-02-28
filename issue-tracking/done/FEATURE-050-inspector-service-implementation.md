---
id: FEATURE-050-inspector-service-implementation
type: feature
priority: high
effort: 4h
status: done
labels: [angular, phase-5]
depends_on: [FEATURE-049-angular-types-file]
blocks: [FEATURE-051-inspector-service-tests]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Implement packages/angular/src/inspector.service.ts

## Summary

Implement the `InspectorService` that resolves a DOM element to rich component context using Angular's `ng.*` dev-mode APIs and the build-time manifest.

## Acceptance Criteria

File: `packages/angular/src/inspector.service.ts`

- `@Injectable()` class `InspectorService`
- `getComponentContext(element: Element): ComponentContext | null` method:
  1. Walk up the DOM from `element` using `ng.getComponent()` to find the nearest component boundary
  2. If no component found at element or any ancestor, return `null`
  3. Get `componentName` from `component.constructor.name`
  4. Call `resolveFilePaths(componentName)` to get `componentFilePath` and `templateFilePath`
  5. Call `getSelector(component)` to get the `selector`
  6. Call `getInputs(component)` to get the `inputs` object
  7. Call `snapshot(element)` for `domSnapshot`
  8. Call `buildTreePath(element)` for `componentTreePath` (ancestors, root → immediate parent)
  9. Return the full `ComponentContext` object
- `private getSelector(component)`: reads `component.constructor.ɵcmp?.selectors` and converts to string form. Falls back to `unknownSelector` on error (try/catch)
- `private getInputs(component)`: reads `component.constructor.ɵcmp?.inputs` to find input property names, then reads values from the component instance. Skips Symbol keys and internal Angular properties
- `private buildTreePath(element)`: walks up DOM ancestors, calls `ng.getComponent()` on each, collects component names from root to immediate parent (not including the current component)
- `private snapshot(element)`: returns `element.outerHTML`, capped at 5000 chars with `<!-- truncated -->` suffix
- `private resolveFilePaths(componentName)`: reads `(window as any).__NG_ANNOTATE_MANIFEST__?.[componentName]` and returns `{ component, template? }`. Falls back to `{ component: '(unresolved: ClassName)' }` if manifest entry not found
- TypeScript compiles without errors, ESLint passes

## Technical Notes

- `ng.*` APIs are Angular's dev mode globals — they are NOT available in production mode
- `ɵcmp` is an internal property — wrap all access in try/catch and degrade gracefully
- The `ng.getComponent()` API returns null if the element is not at a component boundary
