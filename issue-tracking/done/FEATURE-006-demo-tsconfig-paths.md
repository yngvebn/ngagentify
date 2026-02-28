---
id: FEATURE-006-demo-tsconfig-paths
type: feature
priority: high
effort: 1h
status: done
labels: [monorepo, scaffold, phase-0, demo, typescript]
depends_on: [FEATURE-005-demo-app-scaffold, FEATURE-002-vite-plugin-stub-package, FEATURE-003-mcp-server-stub-package, FEATURE-004-angular-stub-package]
blocks: [FEATURE-023-verify-phase0-checkpoints]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Add TypeScript path aliases to demo tsconfig.json

## Summary

Configure `demo/tsconfig.json` to resolve local package imports directly to their TypeScript source, enabling Vite HMR to pick up package changes without a compile step.

## Acceptance Criteria

- `demo/tsconfig.json` (or `demo/tsconfig.app.json`) has `"paths"` entries:
  ```json
  {
    "compilerOptions": {
      "paths": {
        "ng-annotate-mcp": ["../packages/vite-plugin/src/index.ts"],
        "@ng-annotate/angular": ["../packages/angular/src/index.ts"],
        "@ng-annotate/angular/*": ["../packages/angular/src/*"]
      }
    }
  }
  ```
- After adding paths, the demo app still compiles without errors (`ng build --configuration=development`)
- Vite resolves `import { ngAnnotateMcp } from 'ng-annotate-mcp'` to the TypeScript source file, not `node_modules`

## Technical Notes

- These paths apply at dev time only. The paths map directly to `.ts` source files — Angular CLI / Vite handles the TypeScript compilation as part of the build pipeline
- If both `tsconfig.json` and `tsconfig.app.json` exist in demo/, the paths need to be in whichever tsconfig the Angular build process uses (typically `tsconfig.app.json` extends from `tsconfig.json`)
