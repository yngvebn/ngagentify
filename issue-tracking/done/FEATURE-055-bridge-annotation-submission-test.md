---
id: FEATURE-055-bridge-annotation-submission-test
type: feature
priority: high
effort: 1h
status: done
labels: [angular, phase-6, validation]
depends_on: [FEATURE-054-annotate-module-implementation]
blocks: [FEATURE-056-overlay-component-state-machine-tests]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Verify annotation submission from browser via BridgeService

## Summary

Submit a real annotation from the browser console by calling the bridge service directly (not the overlay UI), then confirm it arrives in `get_all_pending` with all fields correctly populated.

## Acceptance Criteria

- Demo dev server is running (`npm run dev`)
- In browser console, get the bridge service instance from the Angular module:
  ```js
  const bridge = ng.getInjector(document.querySelector('app-root')).get(ng.getComponent(document.querySelector('app-root')).constructor.ɵmod.imports[1]?.providers?.[1]?.useClass);
  ```
  (Or use `ng.probe()` / Angular DevTools to locate the service instance)
- Call `bridge.createAnnotation({ componentName: 'SimpleCardComponent', componentFilePath: 'src/app/components/simple-card/simple-card.component.ts', selector: 'app-simple-card', inputs: {}, domSnapshot: '<app-simple-card></app-simple-card>', componentTreePath: ['AppComponent'], annotationText: 'Test from bridge' })`
- `.ng-annotate/store.json` contains a new annotation with all fields populated
- `get_all_pending` returns the annotation via MCP server
- The resolved `componentFilePath` matches the actual file on disk

## Technical Notes

- This is a manual smoke test, not an automated test
- Alternative: add a global debug helper in `AppComponent.ngOnInit()` temporarily: `(window as any).__bridge = this.bridge;` then call `window.__bridge.createAnnotation(...)` in console
- The goal is to confirm the full path: Angular module → BridgeService → WebSocket → Vite plugin → store
