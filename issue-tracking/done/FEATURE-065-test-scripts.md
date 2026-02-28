---
id: FEATURE-065-test-scripts
type: feature
priority: medium
effort: 1h
status: backlog
labels: [scripts, testing, phase-9]
depends_on: [FEATURE-064-playwright-annotation-loop-tests]
blocks: [FEATURE-066-vitest-coverage-thresholds]
created: 2026-02-27
updated: 2026-02-27
started: null
completed: null
---

# Create test scripts and add to root package.json

## Summary

Create `scripts/test.sh` (unit tests) and `scripts/test-e2e.sh` (integration tests), and add them as `npm run test` and `npm run test:e2e` aliases in root `package.json`.

## Acceptance Criteria

**`scripts/test.sh`**:
```bash
#!/usr/bin/env bash
set -euo pipefail
echo "▶ Testing vite-plugin..."
npm run test --workspace=packages/vite-plugin
echo "▶ Testing mcp-server..."
npm run test --workspace=packages/mcp-server
echo "▶ Testing Angular (demo)..."
cd demo && ng test --watch=false --browsers=ChromeHeadless
echo "✓ All unit tests passed"
```

**`scripts/test-e2e.sh`**:
```bash
#!/usr/bin/env bash
set -euo pipefail
echo "▶ Running integration tests..."
echo "  (Dev server must be running — use 'npm run dev' first)"
cd demo && npx playwright test
```

- Both scripts are executable (`chmod +x`)
- Root `package.json` has:
  - `"test": "bash scripts/test.sh"` (already in FEATURE-001 as a stub — now filled in)
  - `"test:e2e": "bash scripts/test-e2e.sh"`
- `npm run test` exits 0 with all tests passing
- `npm run test:e2e` (with dev server running) exits 0

## Technical Notes

- `--browsers=ChromeHeadless` requires Karma's Chrome launcher — verify it's installed in the demo: `npm install -D karma-chrome-launcher --workspace=demo`
