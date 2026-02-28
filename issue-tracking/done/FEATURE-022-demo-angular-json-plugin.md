---
id: FEATURE-022-demo-angular-json-plugin
type: feature
priority: high
effort: 1h
status: done
labels: [demo, phase-0, vite-plugin]
depends_on: [FEATURE-005-demo-app-scaffold, FEATURE-002-vite-plugin-stub-package]
blocks: [FEATURE-023-verify-phase0-checkpoints]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Configure demo angular.json to use the Vite plugin

## Summary

Update `demo/angular.json` to include the `ngAnnotateMcp()` Vite plugin in the build configuration so it runs during the dev server.

## Acceptance Criteria

- `demo/angular.json` build configuration for `ng-annotate-demo` includes a `plugins` array under the `build` target options:
  ```json
  {
    "projects": {
      "ng-annotate-demo": {
        "architect": {
          "build": {
            "builder": "@angular-devkit/build-angular:application",
            "options": {
              "plugins": ["ng-annotate-mcp"]
            }
          }
        }
      }
    }
  }
  ```
- The Vite plugin is loaded from the local workspace package (resolved via tsconfig paths from FEATURE-006)
- `ng serve` starts without errors related to the plugin export
- At this stage the plugin is a stub, so no actual functionality is expected yet

## Technical Notes

- Angular 17+ uses the `@angular-devkit/build-angular:application` builder which supports Vite plugins via the `plugins` array in `angular.json`
- The `"ng-annotate-mcp"` string refers to the package name in the workspace — Angular CLI resolves this to the local symlink
- If Angular's `angular.json` schema does not support `plugins` at the top level (it was a relatively recent addition), verify the correct location with the installed `@angular-devkit/build-angular` version
