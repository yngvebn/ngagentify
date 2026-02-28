---
id: FEATURE-045-vite-plugin-ws-smoke-test
type: feature
priority: high
effort: 1h
status: done
labels: [vite-plugin, phase-3, validation]
depends_on: [FEATURE-044-vite-plugin-entry, FEATURE-022-demo-angular-json-plugin]
blocks: [FEATURE-046-watch-tool-e2e-validation]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Smoke test WebSocket annotation creation via browser console

## Summary

Add a temporary script block to the demo app to verify that opening a WebSocket to `/__annotate` and sending an annotation payload results in a real entry in `.ng-annotate/store.json`. Remove the script block after verification.

## Acceptance Criteria

- Demo app runs with `npm run dev`
- In browser console, run:
  ```js
  const ws = new WebSocket('ws://localhost:4200/__annotate');
  ws.onmessage = e => console.log('MSG:', JSON.parse(e.data));
  ws.onopen = () => ws.send(JSON.stringify({
    type: 'annotation:create',
    payload: {
      componentName: 'TestComponent',
      componentFilePath: 'src/app/test.component.ts',
      selector: 'app-test',
      inputs: {},
      domSnapshot: '<app-test></app-test>',
      componentTreePath: ['AppComponent'],
      annotationText: 'Test annotation from smoke test'
    }
  }));
  ```
- `.ng-annotate/store.json` now contains the session and the annotation
- `get_all_pending` via the MCP server returns the annotation
- Console shows `MSG: { type: 'annotation:created', annotation: {...} }` response from server
- No script block is added to the demo's source files — this is all in-browser console verification

## Technical Notes

- A temporary `<script>` in the demo HTML is also acceptable but must be removed before commit
- The purpose is to confirm the Vite plugin → store → MCP server pipeline works end-to-end before building the Angular overlay
