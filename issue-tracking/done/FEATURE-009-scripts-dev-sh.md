---
id: FEATURE-009-scripts-dev-sh
type: feature
priority: high
effort: 2h
status: done
labels: [scripts, phase-0]
depends_on: [FEATURE-007-scripts-build-sh, FEATURE-005-demo-app-scaffold]
blocks: [FEATURE-023-verify-phase0-checkpoints]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Create scripts/dev.sh

## Summary

Create `scripts/dev.sh`, the primary development command. It guarantees exactly one dev server is running at all times — running it twice in a row always results in one server.

## Acceptance Criteria

- File exists at `scripts/dev.sh` and is executable
- Uses a pidfile at `.ng-annotate/dev-server.pid` to track running server
- On startup:
  1. Checks the pidfile; if PID is alive, sends SIGTERM, waits, then SIGKILL if still alive; removes pidfile
  2. Checks if anything else is bound to port 4200 using `lsof -ti tcp:4200`; if so, kills it and waits 0.5s
  3. Runs `bash scripts/build.sh` to ensure packages are built
  4. Creates `.ng-annotate/` directory if it doesn't exist
  5. Starts `cd demo && ng serve --port 4200 &` in background
  6. Writes the PID to `.ng-annotate/dev-server.pid`
  7. Waits on that PID (so Ctrl+C propagates cleanly)
- Running the script twice in a row results in exactly one `ng serve` process
- `npm run dev` from repo root executes this script

## Technical Notes

- `lsof` is available on macOS and Linux; this script targets those platforms (Windows users use WSL or run `ng serve` directly)
- The `.ng-annotate/` directory is gitignored (FEATURE-012)
- The pidfile is cleaned up on next start, not on Ctrl+C (to keep the script simple)
