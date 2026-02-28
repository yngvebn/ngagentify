---
id: FEATURE-067-badge-overlay-implementation
type: feature
priority: medium
effort: 3h
status: done
labels: [angular, phase-10, ui]
depends_on: [FEATURE-066-vitest-coverage-thresholds]
blocks: []
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Implement annotation status badge overlay

## Summary

Implement the full badge overlay feature in `OverlayComponent`: persistent floating badges that show annotation status on their associated component, survive scrolling, and open the thread panel on click.

## Acceptance Criteria

- Badge icons per status:
  - `pending` → clock icon (⏳) or equivalent — blue
  - `acknowledged` → wrench icon (🔧) or equivalent — yellow/amber
  - `resolved` → checkmark icon (✅) or equivalent — green
  - `dismissed` → X icon (✗) or equivalent — grey
- Badge positioning:
  - Badge appears at the top-right corner of the component's bounding rect
  - Position is `fixed` (not `absolute`) — badge moves with the page on scroll, staying pinned to the component
  - `@HostListener('window:scroll')` → recalculates badge positions via `updateBadges()`
- Clicking a badge opens the thread panel (`mode = 'thread'`, `threadAnnotation = badge.annotation`)
- Badges are visible in all modes (hidden, inspect, annotate) — they are always rendered
- Badges render correctly for these demo app test cases:
  - A badge on `SimpleCardComponent` (top-level component)
  - A badge on `LeafWidgetComponent` (deeply nested)
  - A badge on a list item (`TaskItemComponent`) — all list items with annotations show distinct badges
  - After scrolling down, badges stay visually attached to their components
- Demo app runs without errors after creating multiple annotations for different components

## Technical Notes

- `updateBadges()` is called in `ngOnInit` subscription (when annotations change), `onScroll`, and after any mode change that adds an annotation
- The `findComponentElement(componentName, selector)` helper is used to locate each component's DOM element for position calculation
- `getBoundingClientRect()` gives viewport-relative coordinates — add `window.scrollY` for absolute position if using `position: fixed` (which doesn't need it — fixed is already viewport-relative)
- If `findComponentElement` returns null for a component, skip that badge silently
