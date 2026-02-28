---
id: FEATURE-032-vitest-setup-vite-plugin
type: feature
priority: high
effort: 1h
status: backlog
labels: [testing, phase-2, vite-plugin]
depends_on: [FEATURE-031-store-implementation]
blocks: [FEATURE-033-store-tests]
created: 2026-02-27
updated: 2026-02-27
started: null
completed: null
---

# Set up Vitest for vite-plugin package

## Summary

Install Vitest and create the test configuration for the `vite-plugin` package.

## Acceptance Criteria

- Run: `npm install -D vitest @vitest/coverage-v8 --workspace=packages/vite-plugin`
- `packages/vite-plugin/vitest.config.ts` exists:
  ```ts
  import { defineConfig } from 'vitest/config';
  export default defineConfig({
    test: {
      globals: false,
      environment: 'node',
      include: ['src/**/*.spec.ts'],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.spec.ts']
      }
    }
  });
  ```
- `packages/vite-plugin/package.json` scripts:
  - `"test": "vitest run"`
  - `"test:watch": "vitest"`
  - `"test:coverage": "vitest run --coverage"`
- `npm run test --workspace=packages/vite-plugin` exits 0 (even with no test files yet)

## Technical Notes

- `globals: false` means `describe`, `it`, `expect` must be explicitly imported from `vitest`
- The `environment: 'node'` is critical — store tests change `process.cwd()` and need a real Node environment
