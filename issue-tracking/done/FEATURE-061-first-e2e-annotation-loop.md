---
id: FEATURE-061-first-e2e-annotation-loop
type: feature
priority: high
effort: 2h
status: done
labels: [validation, phase-8]
depends_on: [FEATURE-060-agent-prompt-claude-md, FEATURE-019-demo-component-broken-card]
blocks: [FEATURE-062-playwright-install]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Run first real end-to-end annotation loop

## Summary

Perform the first complete annotation loop: use the overlay to annotate the deliberately broken `broken-card` component, watch Claude Code pick it up, apply the fix, and confirm HMR reflects the change.

## Acceptance Criteria

1. Demo dev server is running (`npm run dev`)
2. Claude Code is connected to the MCP server; `get_all_pending` returns empty
3. Open `localhost:4200` in browser
4. Press `Alt+Shift+A` to activate inspect mode
5. Hover over the `<app-broken-card>` component — highlight rect appears and shows component name
6. Click the component — annotate panel opens showing `BrokenCardComponent` and its inputs
7. Type an annotation: `"The title has a typo — should say 'Welcome to the App'. Also the button should be green not red."`
8. Submit — panel closes, badge appears on the component
9. Claude Code receives the annotation via `watch_annotations`, calls `acknowledge`
10. Badge updates to show `acknowledged` state in browser
11. Claude Code reads the component files, applies the fix, calls `resolve`
12. Badge updates to show `resolved` state in browser
13. Vite HMR applies the change — browser updates without a full reload
14. The broken card now shows correct title and green button
15. Run `npm run demo:reset` — broken card returns to broken state
16. Repeat steps 4–14 successfully a second time

## Notes

- If any step fails, document the failure as a bug or as a clarification needed in CLAUDE.md
- Iterate on `CLAUDE.md` based on what the agent does wrong
- This is the acceptance test for Phases 0–8
