---
id: FEATURE-047-manifest-implementation
type: feature
priority: high
effort: 3h
status: done
labels: [vite-plugin, phase-4]
depends_on: [FEATURE-046-watch-tool-e2e-validation]
blocks: [FEATURE-048-manifest-tests]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Implement packages/vite-plugin/src/manifest.ts

## Summary

Implement the Vite transform plugin that scans Angular component source files during the build, extracts component class name → file path mappings, and injects the result as `window.__NG_ANNOTATE_MANIFEST__` in the browser.

## Acceptance Criteria

File: `packages/vite-plugin/src/manifest.ts`

- `ManifestEntry` interface: `{ component: string; template?: string }` (project-root-relative paths)
- `createManifestPlugin(): Plugin` exported function
- Plugin `name: 'ng-annotate-mcp:manifest'`
- `configResolved(config)` hook: sets `projectRoot = config.root`
- `transform(code, id)` hook:
  - Returns early if file doesn't end in `.ts` or doesn't contain `@Component`
  - Parses the TypeScript source with regex or AST to find:
    - `export class ClassName extends ...` or `export class ClassName` — extracts `ClassName`
    - `@Component({ ... })` decorator — checks for `templateUrl: './foo.component.html'`
  - Computes project-root-relative path for both the `.ts` file and the `.html` file
  - Adds entry to `manifest[className] = { component: relPath, template?: relTemplatePath }`
  - Returns null (does not transform the code)
- `generateBundle()` or `transformIndexHtml()` hook: injects into the HTML:
  ```html
  <script>window.__NG_ANNOTATE_MANIFEST__ = { ...manifestJson };</script>
  ```
  before `</head>`
- After loading the demo app, `window.__NG_ANNOTATE_MANIFEST__` in browser console shows entries for all demo components
- `StatsPanelComponent` entry has both `component` and `template` fields
- TypeScript compiles without errors, ESLint passes

## Technical Notes

- Use `transformIndexHtml` hook (Vite built-in) to inject the script tag — it's the correct hook for HTML mutations
- Regex approach for component parsing is acceptable given the controlled source format; avoid full TypeScript AST parsing (overkill)
- The manifest is rebuild on each `transform` call — it accumulates entries across all processed files within a build
