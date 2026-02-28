---
id: FEATURE-054-annotate-module-implementation
type: feature
priority: high
effort: 2h
status: done
labels: [angular, phase-6]
depends_on: [FEATURE-053-bridge-service-tests]
blocks: [FEATURE-055-bridge-annotation-submission-test]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Implement packages/angular/src/annotate.module.ts

## Summary

Implement the `NgAnnotateModule` that wires together `InspectorService`, `BridgeService`, and `OverlayComponent` using `APP_INITIALIZER` to bootstrap the bridge connection on app startup.

## Acceptance Criteria

File: `packages/angular/src/annotate.module.ts`

- Imports: `NgModule`, `isDevMode`, `APP_INITIALIZER` from `@angular/core`; `CommonModule` from `@angular/common`; `FormsModule` from `@angular/forms`
- `@NgModule`:
  - `imports: [CommonModule, FormsModule]`
  - `declarations: [OverlayComponent]`
  - `providers: isDevMode() ? [InspectorService, BridgeService, { provide: APP_INITIALIZER, useFactory: (bridge: BridgeService) => () => bridge.init(), deps: [BridgeService], multi: true }] : []`
  - `exports: [OverlayComponent]` (so consuming apps can include the overlay)
- `packages/angular/src/index.ts` exports `NgAnnotateModule`, `InspectorService`, `BridgeService` and all types
- When the demo app loads in dev mode, the bridge service's `init()` is called automatically via `APP_INITIALIZER`
- TypeScript compiles without errors, ESLint passes

## Technical Notes

- `APP_INITIALIZER` runs before the app is rendered — `bridge.init()` must return a function (factory) not be called directly
- `OverlayComponent` is a stub at this point (FEATURE-056 implements the template); the module just needs to declare it
- The `isDevMode()` guard in providers means the services and overlay are completely absent in production builds
