---
id: FEATURE-008-scripts-build-watch-sh
type: feature
priority: medium
effort: 1h
status: done
labels: [scripts, phase-0]
depends_on: [FEATURE-007-scripts-build-sh]
blocks: []
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Create scripts/build-watch.sh

## Summary

Create `scripts/build-watch.sh` that builds all packages once for a clean initial state, then runs all watch processes and the demo dev server concurrently using `concurrently`.

## Acceptance Criteria

- File exists at `scripts/build-watch.sh` and is executable
- Does a full `bash scripts/build.sh` first before starting watch mode
- Kills any process on port 4200 before handing off to concurrently
- Uses `npx concurrently` with `--names "vite-plugin,mcp-server,angular,demo"` and `--prefix-colors "cyan,yellow,magenta,green"`
- Runs four concurrent processes:
  1. `npm run build:watch --workspace=packages/vite-plugin`
  2. `npm run build:watch --workspace=packages/mcp-server`
  3. `npm run build:watch --workspace=packages/angular`
  4. `cd demo && ng serve --port 4200`
- `npm run build:watch` from repo root executes this script

## Technical Notes

- `concurrently` is in root devDependencies (added in FEATURE-001)
- This is the developer DX command for active package development — it recompiles packages on change and Vite HMR propagates the change
- Changes to `configureServer` in the Vite plugin require a dev server restart (Ctrl+C → rerun)
