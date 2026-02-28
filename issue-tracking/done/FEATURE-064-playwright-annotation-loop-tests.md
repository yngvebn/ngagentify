---
id: FEATURE-064-playwright-annotation-loop-tests
type: feature
priority: medium
effort: 4h
status: done
labels: [testing, phase-9, playwright]
depends_on: [FEATURE-063-playwright-config]
blocks: [FEATURE-065-test-scripts]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Write Playwright annotation loop integration tests

## Summary

Write the full Playwright integration test suite that exercises the annotation loop against the real demo app. Tests read the store file directly to verify state changes.

## Acceptance Criteria

File: `demo/e2e/annotation-loop.spec.ts`

**Helper**: `readStore()` reads `.ng-annotate/store.json` and parses it.

**Test: manifest is injected into page**:
- Navigate to `http://localhost:4200`
- Check: `window.__NG_ANNOTATE_MANIFEST__` is defined
- Check: it contains an entry for `SimpleCardComponent`
- Check: it contains an entry for `StatsPanelComponent` with a `template` field

**Test: overlay activates on Alt+Shift+A**:
- Navigate to demo app
- Press `Alt+Shift+A`
- Assert: `.nga-keyboard-hint` text changes to indicate inspect mode is active

**Test: hovering a component shows the highlight rect**:
- Activate inspect mode
- Mouse hover over `<app-simple-card>` element
- Assert: `.nga-highlight-rect` is visible in the DOM

**Test: clicking a component opens annotate panel**:
- Activate inspect mode
- Click `<app-simple-card>`
- Assert: `.nga-annotate-panel` is visible
- Assert: panel shows `SimpleCardComponent` name

**Test: submitting an annotation creates a store entry**:
- Click a component, fill in annotation text `'Playwright test annotation'`, click submit
- Read store file: assert it now contains one annotation with `status: 'pending'`
- Assert: `annotationText === 'Playwright test annotation'`

**Test: badge appears after annotation is created**:
- After submitting an annotation
- Assert: `.nga-badge` element is visible in the page

All tests pass: `cd demo && npx playwright test` (with dev server running)

## Technical Notes

- Tests depend on the dev server running — the `scripts/test-e2e.sh` script documents this requirement
- Store file path: `path.join(__dirname, '../../.ng-annotate/store.json')` (relative to `demo/e2e/`)
- Clean up store between tests: delete `.ng-annotate/store.json` in `test.beforeEach` or `test.afterEach`
