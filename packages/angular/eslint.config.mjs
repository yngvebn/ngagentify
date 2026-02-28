// @ts-check
import tseslint from 'typescript-eslint';
import rootConfig from '../../eslint.config.mjs';

export default tseslint.config(...rootConfig, {
  // Schematics use a separate CommonJS tsconfig — exclude from projectService linting
  ignores: ['schematics/**'],
});
