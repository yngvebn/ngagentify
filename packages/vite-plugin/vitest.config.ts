import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      // index.ts and ws-handler.ts require a running Vite dev server (integration tests)
      // and are excluded here; thresholds apply to unit-testable files only
      include: ['src/store.ts', 'src/manifest.ts'],
      exclude: ['src/**/*.spec.ts'],
      thresholds: {
        lines: 75,
        functions: 65,
        branches: 80,
        statements: 75,
      },
    },
  },
});
