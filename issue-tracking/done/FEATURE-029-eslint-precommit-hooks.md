---
id: FEATURE-029-eslint-precommit-hooks
type: feature
priority: medium
effort: 1h
status: done
labels: [eslint, phase-1]
depends_on: [FEATURE-028-eslint-lint-scripts]
blocks: []
created: 2026-02-27
updated: 2026-02-27
started: 2026-02-27
completed: 2026-02-27
---

# Install lint-staged and simple-git-hooks, configure pre-commit

## Summary

Install `lint-staged` and `simple-git-hooks` to enforce lint on staged files only, keeping commits fast. Activate the git hook.

## Acceptance Criteria

- Run from repo root: `npm install -D lint-staged simple-git-hooks`
- Root `package.json` has:
  ```json
  {
    "simple-git-hooks": {
      "pre-commit": "npx lint-staged"
    },
    "lint-staged": {
      "packages/**/*.ts": "eslint --max-warnings=0",
      "demo/src/**/*.ts": "eslint --max-warnings=0",
      "demo/src/**/*.html": "ng lint --project=ng-annotate-demo"
    }
  }
  ```
- Run: `npx simple-git-hooks` to activate the hooks
- `.git/hooks/pre-commit` exists and is executable
- Making a commit with a lint error causes the commit to be rejected
- Making a clean commit succeeds

## Technical Notes

- `lint-staged` runs lint only on staged files — it does not lint the entire codebase on every commit
- `simple-git-hooks` is minimal and does not require Node.js background processes
- After `npm ci` or cleaning `node_modules`, re-run `npx simple-git-hooks` (note this in `scripts/clean.sh` as a comment)
