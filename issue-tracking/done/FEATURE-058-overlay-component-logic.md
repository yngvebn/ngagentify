---
id: FEATURE-058-overlay-component-logic
type: feature
priority: high
effort: 4h
status: done
labels: [angular, phase-7]
depends_on: [FEATURE-057-overlay-component-template]
blocks: [FEATURE-059-overlay-component-styles]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Implement OverlayComponent logic

## Summary

Implement the TypeScript class logic for `OverlayComponent`: the mode state machine, all event handlers, and badge management. After this issue, all state machine tests from FEATURE-056 must pass.

## Acceptance Criteria

File: `packages/angular/src/overlay/overlay.component.ts` (class body)

- `@Component` decorator: `selector: 'nga-overlay'`, `changeDetection: ChangeDetectionStrategy.OnPush`, `styleUrls: ['./overlay.component.scss']`
- Constructor injects: `InspectorService`, `BridgeService`, `ChangeDetectorRef`
- `ngOnInit()`: subscribes to `bridge.annotations$`; on each emission, calls `updateBadges()` and `cdr.markForCheck()`
- `@HostListener('document:keydown.alt.shift.a')` → `toggleInspect()`
  - `hidden` → `inspect`; `inspect` → `hidden`; `annotate` → `inspect`
- `@HostListener('document:keydown.escape')` → `onEscape()`
  - `annotate` → `inspect`; `inspect` → `hidden`; `thread` → `hidden`
- `@HostListener('document:mousemove')` → `onMouseMove(e: MouseEvent)` (only when `mode === 'inspect'`)
  - Calls `inspector.getComponentContext(e.target as Element)`
  - Updates `hoveredContext` and `highlightRect` from `(e.target as Element).getBoundingClientRect()`
  - Calls `cdr.markForCheck()`
- `@HostListener('document:click')` → `onClick(e: MouseEvent)` (only when `mode === 'inspect'`)
  - Calls `inspector.getComponentContext(e.target as Element)`
  - If found: sets `selectedContext`, clears `annotationText`, transitions to `annotate`, focuses textarea after tick via `setTimeout`
  - If not found: does nothing
- `submit()`: validates `selectedContext` and `annotationText.trim()` non-empty; calls `bridge.createAnnotation({...selectedContext fields, annotationText})`; resets `selectedContext` and `annotationText`; transitions to `inspect`
- `cancel()`: from `annotate` → `inspect`
- `openThread(annotation)`: sets `threadAnnotation`, transitions to `thread`
- `closeThread()`: clears `threadAnnotation`, transitions to `hidden`
- `sendReply()`: validates `threadAnnotation` and `replyText.trim()`; calls `bridge.replyToAnnotation(id, message)`; clears `replyText`
- `private updateBadges()`: for each annotation in `annotations`, finds the component's DOM element using `findComponentElement()`; computes `getBoundingClientRect()` + `scrollY` offset; builds `AnnotationBadge` with appropriate `icon` and `label` by status
- `private findComponentElement(componentName, selector)`: tries `document.querySelector(selector)` first; falls back to walking the DOM for elements where `ng.getComponent()?.constructor.name === componentName`

All state machine tests from FEATURE-056 now pass: `ng test --project=ng-annotate-demo --watch=false`

## Technical Notes

- `ChangeDetectionStrategy.OnPush` means `cdr.markForCheck()` must be called after any external event (WebSocket, mousemove, etc.)
- The `setTimeout` for textarea focus is needed because the template renders one tick after mode change
