---
id: FEATURE-025-eslint-root-config
type: feature
priority: high
effort: 2h
status: backlog
labels: [eslint, phase-1]
depends_on: [FEATURE-024-eslint-install-root-deps]
blocks: [FEATURE-026-eslint-package-configs]
created: 2026-02-27
updated: 2026-02-27
started: null
completed: null
---

# Create root eslint.config.mjs

## Summary

Create the shared root ESLint configuration file that all packages extend. Uses the flat config format (ESLint 9+) with strict TypeScript checking.

## Acceptance Criteria

- `eslint.config.mjs` exists at repo root
- Extends: `eslint.configs.recommended`, `tseslint.configs.strictTypeChecked`, `tseslint.configs.stylisticTypeChecked`
- Plugins configured: `eslint-plugin-import` (as `import`) and `eslint-plugin-unicorn` (as `unicorn`)
- Rules enforce the spec's philosophy: **errors only, no warnings**. Key rules at `'error'` level:
  - `@typescript-eslint/no-explicit-any`
  - `@typescript-eslint/no-floating-promises`
  - `@typescript-eslint/no-unused-vars`
  - `import/no-cycle`
  - `unicorn/prefer-node-protocol` (import 'node:fs' not 'fs')
- Test file overrides (relax `no-explicit-any`, allow `@ts-expect-error`) for files matching `**/*.spec.ts` or `**/*.test.ts`
- Ignore patterns: `**/dist/**`, `**/node_modules/**`, `demo/src/environments/**`
- Running `npx eslint packages/vite-plugin/src/index.ts` (on the stub file) exits 0

## Technical Notes

- The `languageOptions.parserOptions.project` is NOT set at root level — each package config sets its own tsconfig path (FEATURE-026)
- This file is exported as a default export so package configs can spread it: `...rootConfig`
