---
id: FEATURE-026-eslint-package-configs
type: feature
priority: high
effort: 1h
status: backlog
labels: [eslint, phase-1]
depends_on: [FEATURE-025-eslint-root-config]
blocks: [FEATURE-028-eslint-lint-scripts]
created: 2026-02-27
updated: 2026-02-27
started: null
completed: null
---

# Create per-package ESLint configs

## Summary

Create a minimal `eslint.config.mjs` in each Node package that extends the root config and sets the correct `tsconfig` path for type-aware linting.

## Acceptance Criteria

- `packages/vite-plugin/eslint.config.mjs` exists:
  ```js
  import rootConfig from '../../eslint.config.mjs';
  import tseslint from 'typescript-eslint';
  export default tseslint.config(
    ...rootConfig,
    { languageOptions: { parserOptions: { project: './tsconfig.json', tsconfigRootDir: import.meta.dirname } } }
  );
  ```
- Same structure for `packages/mcp-server/eslint.config.mjs`
- Same structure for `packages/angular/eslint.config.mjs`
- `npx eslint src/ --config eslint.config.mjs` exits 0 in each package directory (on the stubs files)

## Technical Notes

- `import.meta.dirname` is available in ESM modules (Node 20.11+) — use it to anchor the tsconfig path
- Do not set `languageOptions.project` at the root config level — this is why each package has its own config
- The demo app's ESLint config is handled separately by `ng add @angular-eslint/schematics` (FEATURE-027)
