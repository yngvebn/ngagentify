---
id: FEATURE-057-overlay-component-template
type: feature
priority: high
effort: 3h
status: done
labels: [angular, phase-7]
depends_on: [FEATURE-056-overlay-component-state-machine-tests]
blocks: [FEATURE-058-overlay-component-logic]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Implement OverlayComponent template

## Summary

Implement the Angular template for `OverlayComponent`. This is the HTML structure only — the component TypeScript logic is in FEATURE-058.

## Acceptance Criteria

File: `packages/angular/src/overlay/overlay.component.ts` (template section)

The template includes all of the following sections, conditionally shown based on `mode`:

**Keyboard hint** (always visible, bottom-right corner):
- Shows `Alt+Shift+A` to activate when `mode === 'hidden'`
- Shows `Click a component` when `mode === 'inspect'`

**Inspect highlight rect** (when `mode === 'inspect'` and `hoveredContext !== null`):
- Absolutely positioned `<div>` at `[style]="{ top, left, width, height }"` using `highlightRect`
- Shows component name inside the rect

**Annotate panel** (when `mode === 'annotate'`):
- Shows `selectedContext.componentName` as heading
- Shows input key/value pairs (up to 5, controlled by `inputEntries()`)
- Shows `selectionText` if provided
- `<textarea #textArea [(ngModel)]="annotationText" placeholder="Describe the change..."></textarea>`
- Submit button (calls `submit()`) disabled when `annotationText.trim()` is empty
- Cancel button (calls `cancel()`)

**Thread panel** (when `mode === 'thread'`):
- Shows `threadAnnotation.componentName` as heading
- Shows all replies in order with author label
- Reply text input with `[(ngModel)]="replyText"`
- Send button (calls `sendReply()`)
- Close button (calls `closeThread()`)

**Annotation badges** (always rendered):
- `*ngFor` over `badges` — absolutely positioned icons per annotation
- Click on badge calls `openThread(badge.annotation)`

Template compiles without errors (even with stub TS logic)

## Technical Notes

- The template uses `ChangeDetectionStrategy.OnPush` — all binding values must be component properties (not computed inline)
- The entire overlay is a single component rendered as a floating layer on top of the page
- Add `nga-overlay` tag to the demo app's `AppComponent` template after implementing the module
