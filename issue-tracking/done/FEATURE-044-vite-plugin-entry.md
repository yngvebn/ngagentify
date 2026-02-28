---
id: FEATURE-044-vite-plugin-entry
type: feature
priority: high
effort: 1h
status: done
labels: [vite-plugin, phase-3]
depends_on: [FEATURE-043-vite-plugin-ws-handler]
blocks: [FEATURE-045-vite-plugin-ws-smoke-test]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Implement packages/vite-plugin/src/index.ts

## Summary

Implement the Vite plugin entry point that exports `ngAnnotateMcp()` returning an array of plugins: the main WS plugin and the manifest plugin (stub for now).

## Acceptance Criteria

File: `packages/vite-plugin/src/index.ts`

- Imports `createWsHandler` from `./ws-handler`
- Imports `createManifestPlugin` from `./manifest` (stub until FEATURE-047)
- Exports `ngAnnotateMcp(): Plugin[]` function
- The main plugin object:
  - `name: 'ng-annotate-mcp'`
  - `configureServer(server)`: calls `createWsHandler(server)` — only in development mode (`server.mode !== 'production'`)
  - `apply: 'serve'` — only active during `vite dev` / `ng serve`, not during `ng build`
- Returns `[mainPlugin, createManifestPlugin()]`
- `npm run build --workspace=packages/vite-plugin` exits 0
- When the demo app runs `ng serve`, the plugin loads without errors (no WS connections yet)

## Technical Notes

- The `apply: 'serve'` property ensures the plugin is inactive in production builds
- The `configureServer` hook is only called in dev server mode — it's safe to gate on `apply`
