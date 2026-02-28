---
id: FEATURE-063-playwright-config
type: feature
priority: medium
effort: 1h
status: done
labels: [testing, phase-9, playwright]
depends_on: [FEATURE-062-playwright-install]
blocks: [FEATURE-064-playwright-annotation-loop-tests]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Create Playwright configuration

## Summary

Create `demo/playwright.config.ts` to configure the Playwright test runner for the demo app.

## Acceptance Criteria

File: `demo/playwright.config.ts`

```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:4200',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  reporter: 'line',
  timeout: 30_000
});
```

- `demo/e2e/` directory exists (create with a `.gitkeep` if empty)
- `npx playwright test --config=demo/playwright.config.ts --list` exits 0 (even with no tests)
- Test results output goes to `demo/test-results/` and reports to `demo/playwright-report/`
- Add both directories to `.gitignore`

## Technical Notes

- The `baseURL` assumes the dev server is already running — integration tests require the server to be up (noted in `scripts/test-e2e.sh`)
- `timeout: 30_000` is generous to account for HMR and WebSocket connection timing
