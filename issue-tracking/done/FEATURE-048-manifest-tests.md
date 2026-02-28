---
id: FEATURE-048-manifest-tests
type: feature
priority: high
effort: 2h
status: backlog
labels: [testing, phase-4, vite-plugin]
depends_on: [FEATURE-047-manifest-implementation]
blocks: [FEATURE-049-angular-types-file]
created: 2026-02-27
updated: 2026-02-27
started: null
completed: null
---

# Write manifest.spec.ts tests

## Summary

Write Vitest unit tests for the `createManifestPlugin` Vite transform, testing the source parsing and path resolution logic.

## Acceptance Criteria

File: `packages/vite-plugin/src/manifest.spec.ts`

Tests call the `transform()` hook of the plugin returned by `createManifestPlugin()` with synthetic TypeScript source strings.

**Extracts class name and relative file path from a component file**:
- Input: a TypeScript source with `@Component({ template: '<p>hello</p>' })` and `export class HeaderComponent`
- Assert: `manifest['HeaderComponent'].component` equals the project-root-relative path of the source file

**Extracts templateUrl and resolves it relative to the component file**:
- Input: TypeScript source with `@Component({ templateUrl: './header.component.html' })` and `export class HeaderComponent`
- Assert: `manifest['HeaderComponent'].template` equals the resolved project-root-relative path to the `.html` file

**Ignores non-component TypeScript files**:
- Input: a `.ts` file containing neither `@Component` nor `export class`
- Assert: manifest has no entry added

**Handles multiple export class statements in one file gracefully**:
- Input: file with two `export class` statements but only one `@Component` decorator
- Assert: only the decorated class is added to the manifest (or both with appropriate handling — specify the chosen behavior)

All tests pass: `npm run test --workspace=packages/vite-plugin`

## Technical Notes

- Tests must set up the plugin with a fake `projectRoot` so path computations are deterministic
- Test the `transform()` method directly — no need to create a full Vite server instance
