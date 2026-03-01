# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
