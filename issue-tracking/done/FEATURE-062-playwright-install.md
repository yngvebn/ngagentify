---
id: FEATURE-062-playwright-install
type: feature
priority: medium
effort: 1h
status: done
labels: [testing, phase-9, playwright]
depends_on: [FEATURE-061-first-e2e-annotation-loop]
blocks: [FEATURE-063-playwright-config]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Install Playwright in demo package

## Summary

Install `@playwright/test` in the demo package and download the Chromium browser binary.

## Acceptance Criteria

- Run: `npm install -D @playwright/test --workspace=demo`
- Run: `npx playwright install chromium` (installs Chromium headless browser)
- `demo/package.json` devDependencies includes `@playwright/test`
- `npx playwright --version` outputs a version string
- Chromium browser binary is available at the Playwright-managed path

## Technical Notes

- Playwright downloads its own browser binaries — these are NOT committed to git (add to `.gitignore` if needed: `demo/test-results/`, `demo/playwright-report/`)
- Only Chromium is needed for these tests — skip Firefox and WebKit to keep install time fast
