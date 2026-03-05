# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.0] — 2026-03-05

### Added

- **Idle inspect hint** — when the overlay is visible but not in inspect mode, a hint reading `Alt+Shift+A to inspect` is now shown in the bottom-right corner, making the shortcut discoverable.

### Fixed

- **Agent heartbeat** — MCP server tools (`acknowledge`, `resolve`, `dismiss`, `reply`, `propose_diff`, `watch_diff_response`, `watch_annotations`) now call `store.touchHeartbeat()` on every invocation, writing a `lastAgentHeartbeat` timestamp to `store.json`. `watch_diff_response` additionally refreshes the heartbeat every 20 s while waiting for developer input. The Angular builder, Vite plugin, and `BridgeService` all forward this timestamp to the browser via `annotations:sync`, and the overlay's `?` button turns green while the agent is actively watching. The Angular builder's store was previously missing `lastAgentHeartbeat` support entirely; added `getHeartbeat()` and `snapshot()` so the periodic sync reads heartbeat and annotations from the same file read.
- **Alt+Shift+A ignored when overlay was hidden** — pressing the inspect shortcut while the overlay was hidden changed internal mode state but rendered nothing. Entering inspect mode now also makes the overlay visible.
- **Stale mode state when hiding overlay** — hiding the overlay via Alt+Shift+H now resets mode to `'hidden'`, preventing leftover `'inspect'` or `'annotate'` state from lingering invisibly.

## [0.8.0] — 2026-03-03

### Added

- **Yolo mode** — a session-level toggle that lets the developer trust the agent to apply changes without a manual diff review. When enabled, `watch_diff_response` auto-approves immediately so the agent writes files and resolves the annotation without any interaction. Toggle via the ⚡ button in the overlay hint bar; state is stored per-session in `store.json` and survives page refreshes.

## [0.7.0] — 2026-03-02

### Added

- **Annotation persistence across page refreshes** — session ID is stored in `localStorage` and sent as a `?sessionId=` query param on WebSocket reconnect. The Angular builder restores the existing session and immediately syncs all annotations back to the browser, so badges reappear after a refresh without needing the agent to re-run.
- **Clear all markers** — `Alt+Shift+X` keyboard shortcut in the overlay sends `annotations:clear`, which the server handles by deleting all annotations for the current session. The overlay clears all badges and dismisses any open panels.

### Fixed

- WebSocket upgrade handler in the Angular builder now uses `startsWith('/__annotate')` instead of an exact match, so session-restore URLs (`/__annotate?sessionId=…`) are correctly accepted.
- Race condition in the Angular builder's WebSocket close handler: the socket is now only removed from `sessionSockets` if it is still the currently registered socket for that session, preventing a fast page refresh from unregistering the new connection.

## [0.6.3] — 2026-03-02

### Fixed

- `ng-add` schematic no longer adds `@ng-annotate/mcp-server` to consumer projects' `devDependencies`. The generated MCP config already uses `npx -y @ng-annotate/mcp-server`, so a local install was redundant.
- Fixed executable bit on `packages/mcp-server/bin/ng-annotate-mcp.js`.

## [0.6.2] — 2026-03-01

### Fixed

- CI test failure: `dist/builders/dev-server/index.spec.js` (stale CJS artifact) was picked up by Vitest and failed with `Cannot require() vitest`. Excluded `*.spec.ts` from builders tsconfig and excluded `dist/` from vitest config.

## [0.6.1] — 2026-03-01

### Fixed

- WebSocket connection now uses `wss://` when the app is served over HTTPS, preventing a `SecurityError` in HTTPS dev server setups (e.g. Angular CLI `--ssl`)

## [0.6.0] — 2026-03-01

### Added

- **Diff preview before apply** — agent proposes a unified diff in the overlay before writing to disk; developer can Approve or Reject from the browser.
  - New MCP tools: `propose_diff` and `watch_diff_response`
  - New overlay mode: purple `◈` badge → preview panel with syntax-highlighted diff, Approve/Reject buttons
  - New WebSocket messages: `diff:approved` / `diff:rejected` (handled in both vite-plugin and Angular builder)
  - New `AnnotationStatus`: `diff_proposed`
  - Updated agent work loop prompt: agent must call `propose_diff` → `watch_diff_response` before writing files

## [0.5.16] — 2026-02-27

### Added

- Unit tests for builder internals: `makeLogger`, `findStoreRoot`, `findTsConfig`, `buildManifest`

## [0.5.15] — 2026-02-27

### Added

- tsconfig-based component manifest scanning
- `/__annotate/manifest` HTTP endpoint
- `manifest:update` WebSocket message sent on connect
- `ngAnnotateDebug` builder option for verbose logging

## [0.5.14] and earlier

Initial implementation of the full ng-annotate-mcp toolchain:
- Monorepo scaffold (npm workspaces)
- File-based annotation store + MCP server
- Vite plugin with WebSocket handler
- Angular inspector service, bridge service, overlay component, badge overlay
- Angular builder (`@ng-annotate/angular:dev-server`)
- Demo app with 7 demo components
- Full Playwright E2E + Vitest unit test suites
