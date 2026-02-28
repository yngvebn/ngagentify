---
id: FEATURE-007-scripts-build-sh
type: feature
priority: high
effort: 1h
status: done
labels: [scripts, phase-0]
depends_on: [FEATURE-002-vite-plugin-stub-package, FEATURE-003-mcp-server-stub-package, FEATURE-004-angular-stub-package]
blocks: [FEATURE-009-scripts-dev-sh, FEATURE-008-scripts-build-watch-sh]
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Create scripts/build.sh

## Summary

Create the `scripts/build.sh` helper script that builds all packages in the correct dependency order.

## Acceptance Criteria

- File exists at `scripts/build.sh` and is executable (`chmod +x`)
- Script header: `#!/usr/bin/env bash` and `set -euo pipefail`
- Builds packages in order: vite-plugin → mcp-server → angular
- Uses `npm run build --workspace=packages/<name>` for each package
- Prints labelled progress output: `[1/3] vite-plugin`, `[2/3] mcp-server`, `[3/3] angular`
- Final line: `✓ All packages built`
- `npm run build` from repo root executes this script and exits 0 (via the `"build": "bash scripts/build.sh"` entry in root `package.json` from FEATURE-001)

## Script Content

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "▶ Building packages..."

echo "  [1/3] vite-plugin"
npm run build --workspace=packages/vite-plugin

echo "  [2/3] mcp-server"
npm run build --workspace=packages/mcp-server

echo "  [3/3] angular"
npm run build --workspace=packages/angular

echo "✓ All packages built"
```
