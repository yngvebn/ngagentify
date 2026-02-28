---
id: FEATURE-010-scripts-demo-reset-sh
type: feature
priority: medium
effort: 1h
status: done
labels: [scripts, phase-0]
depends_on: [FEATURE-019-demo-component-broken-card]
blocks: []
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Create scripts/demo-reset.sh

## Summary

Create `scripts/demo-reset.sh` that resets the deliberately broken demo component to its original broken state using `git checkout`, so the end-to-end annotation loop can be re-run repeatably.

## Acceptance Criteria

- File exists at `scripts/demo-reset.sh` and is executable
- Uses `git checkout HEAD -- demo/src/app/components/broken-card` to restore the component
- Prints clear output: `▶ Resetting broken demo component...` and `✓ Reset — restored to original state`
- Mentions that HMR will pick up the change automatically if dev server is running
- `npm run demo:reset` from repo root executes this script (add `"demo:reset": "bash scripts/demo-reset.sh"` to root package.json)

## Technical Notes

- The broken-card component is generated in FEATURE-019 and intentionally contains a visible bug (wrong text, wrong color, or layout issue)
- After the agent fixes it in FEATURE-061, running this script restores it to the broken state for the next test run
- The exact path `demo/src/app/components/broken-card` must match where `ng generate component` places the files
