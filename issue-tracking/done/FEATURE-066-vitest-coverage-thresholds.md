---
id: FEATURE-066-vitest-coverage-thresholds
type: feature
priority: low
effort: 1h
status: backlog
labels: [testing, phase-9]
depends_on: [FEATURE-065-test-scripts]
blocks: [FEATURE-067-badge-overlay-implementation]
created: 2026-02-27
updated: 2026-02-27
started: null
completed: null
---

# Add coverage thresholds to vitest configs

## Summary

Set minimum coverage thresholds in both `vite-plugin` and `mcp-server` Vitest configs to catch accidental regression in test coverage.

## Acceptance Criteria

Both `packages/vite-plugin/vitest.config.ts` and `packages/mcp-server/vitest.config.ts` have coverage thresholds:

```ts
coverage: {
  provider: 'v8',
  include: ['src/**/*.ts'],
  exclude: ['src/**/*.spec.ts'],
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 70,
    statements: 80
  }
}
```

- `npm run test:coverage --workspace=packages/vite-plugin` exits 0 (thresholds met)
- `npm run test:coverage --workspace=packages/mcp-server` exits 0 (thresholds met)
- If coverage is below threshold, the command exits non-zero

## Technical Notes

- These thresholds are floors, not targets — do not add tests just to hit numbers
- If the current test suite does not meet the thresholds, either add targeted tests for uncovered critical paths or lower the threshold to match the current coverage (document why)
- Angular tests do not have numeric thresholds at this stage (per spec section 7.5)
