---
name: start-working
description: Continue work on the next priority from the issue tracking system. Use this skill when the user asks to start working, continue work, or pick up the next task. Follows the lightweight issue workflow (backlog → in-progress → done) with TDD emphasis and real-time progress tracking.
---

# Start Working Skill

This skill provides a structured workflow for continuing work on the next priority from the issue tracking system. It automates the process of selecting, planning, implementing, and completing issues following the project's lightweight, checkbox-based workflow.

**CRITICAL**: Never commit and push unless explicitly confirmed by the user first.

## When to Use This Skill

Use this skill when the user requests:
- "Start working on the next task"
- "Continue work" or "Keep going"
- "Pick up the next priority"
- "Work on the planning board items"
- Any request to begin implementation work

## Workflow Overview

This skill follows a **10-step workflow** that moves issues through the lifecycle:

```
backlog/ → in-progress/ → done/
```

With continuous updates to:
- **Issue frontmatter** (status, timestamps)
- **PLANNING-BOARD.md** (current priorities)

**Frontmatter Updates During Workflow**:
- **Start work**: Set `status: in-progress`, `started: [date]`, `updated: [date]`
- **Complete work**: Set `status: done`, `completed: [date]`, `updated: [date]`

## The 10-Step Workflow

### Step 1: Check Current Priorities

Read [`issue-tracking/PLANNING-BOARD.md`](../../issue-tracking/PLANNING-BOARD.md) to see what's next.

**If PLANNING-BOARD is empty**: Ask the user if they want to reprioritize the backlog first.

### Step 2: Select Top Priority

Pick the **first item** from the planning board (unless blocked or user specifies otherwise).

**Decision criteria**:
- Is it blocked by dependencies?
- Are all prerequisites met?
- Is the scope clear?

If the top priority is blocked, move to the next unblocked item.

### Step 3: Move to In-Progress

Move the issue file from `issue-tracking/backlog/` to `issue-tracking/in-progress/`.

**Update frontmatter**:
- Change `status: backlog` → `status: in-progress`
- Set `started: 2025-11-24` (current date)
- Update `updated: 2025-11-24` (current date)

**Example**:
```bash
Move: issue-tracking/backlog/BUG-timer-not-pausing.md
  To: issue-tracking/in-progress/BUG-timer-not-pausing.md
```

### Step 4: Read the Issue File

Thoroughly understand:
- **Problem Statement**: What needs to be fixed/built?
- **Acceptance Criteria**: What defines success?
- **Technical Context**: Root cause, affected components, file paths
- **Related Issues**: Any dependencies or cross-references?

### Step 5: Clarify Uncertainties (Critical)

**STOP and ask the user follow-up questions if**:
- The issue description is unclear or ambiguous
- Multiple implementation approaches are possible
- There are technical uncertainties about the approach
- The scope seems too large or ill-defined
- Priority conflicts exist

**Only proceed to Step 6 after all uncertainties are resolved**.

### Step 6: Assess Complexity

Evaluate if the task is appropriately sized:

**If task is too complex**:
- Break it down into smaller, focused sub-tasks
- Create new issue files in `backlog/` for each sub-task
- Update `PLANNING-BOARD.md` with the new breakdown
- Select the first sub-task to work on

**Complexity indicators**:
- Affects more than 5 files
- Requires changes across multiple layers (frontend + backend + database)
- Estimated effort > 4 hours
- Multiple architectural patterns involved

### Step 7: Add Implementation Plan

Update the issue file with a **detailed Implementation Plan** section:

```markdown
## Implementation Plan

**Approach**: [Strategy and high-level steps]

**Files to modify**:
- `server/Controllers/SessionsController.cs` - Add new endpoint
- `src/app/session/session.store.ts` - Update state management
- `Server.Tests/Controllers/SessionsControllerTests.cs` - Add integration tests

**Tests needed**:
- [ ] Unit test: SessionStore updates state correctly
- [ ] Integration test: Controller endpoint returns expected response
- [ ] E2E test: Full user flow works end-to-end

**Dependencies**: [Any blockers or prerequisites]

**Estimated effort**: [Time estimate]
```

### Step 8: Update Planning Board

Mark the issue as **"In Progress"** in `PLANNING-BOARD.md` with status notes.

**Update format**:
```markdown
### 1. 🔨 **[Issue Title]** (IN PROGRESS)
**Issue**: `in-progress/BUG-timer-not-pausing.md`
**Status**: Implementation started - adding tests
**Progress**: 2/5 acceptance criteria met
```

### Step 9: Implement the Solution

Follow the **TDD workflow** defined in [`issue-tracking/AGENTS.md`](../../issue-tracking/AGENTS.md):

#### TDD Approach (Test-Driven Development)

1. **Check existing test coverage**:
   - Search for existing unit tests covering the affected code
   - Run Wallaby to see current test status

2. **Write test to reproduce** (if bug):
   - Create failing test that demonstrates the bug
   - Confirm test fails as expected

3. **Fix implementation**:
   - Make minimal changes to turn test green
   - Follow project architecture patterns (see below)

4. **Add integration/E2E tests**:
   - Add higher-level tests as needed
   - Verify full user flow works

5. **Monitor Wallaby continuously**:
   - Ensure tests stay green during implementation
   - Fix any regressions immediately

#### Architecture Patterns to Follow

**Backend (.NET / CQRSLite)**:
- CQRS pattern: Commands/queries separated, event-driven
- **Never call SignalR directly from controllers**: Use domain events and event handlers
- Commands → Command Handlers → Domain Events → Event Handlers → SignalR
- Register DI: IRepository and ISession are Singleton, Handlers are Transient
- Tests location: `Server.Tests/`

**Frontend (Angular 20 / NgRx SignalStore)**:
- **Components are UI only**: No business logic in components
- **All logic in SignalStores**: State management, API calls, side effects
- Use new control flow: `@if`, `@for` (not `*ngIf`, `*ngFor`)
- Prefer `@codegen` types from Firebase schema
- Tests location: `*.spec.ts` alongside components

#### Real-Time Progress Tracking

**Update the issue file's Progress Log frequently**:

```markdown
## Progress Log
- 2025-11-19 14:30 - Started implementation, reviewed existing tests
- 2025-11-19 14:45 - Added failing test in SessionsControllerTests.cs
- 2025-11-19 15:00 - Implemented fix in SessionsController.cs:142
- 2025-11-19 15:15 - All tests passing, Wallaby green
- 2025-11-19 15:30 - Added E2E test for full user flow
```

**Update PLANNING-BOARD.md as work progresses**:
- Add status notes ("Writing tests", "Implementation complete", "Testing")
- Update progress percentage or checklist items
- Note any blockers or scope changes

### Step 10: Complete and Move to Done

Before marking complete, verify the **Verification Checklist**:

```markdown
## Verification
- [ ] All acceptance criteria met
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] CHANGELOG.md updated
- [ ] Documentation updated
- [ ] Code reviewed (if applicable)
```

**Then finalize**:

1. **Update frontmatter**:
   - Change `status: in-progress` → `status: done`
   - Set `completed: 2025-11-24` (current date)
   - Update `updated: 2025-11-24` (current date)

2. **Update Resolution section** with final outcome:
   ```markdown
   ## Resolution

   Successfully implemented pause functionality. All acceptance criteria met.

   **Changes made**:
   - Fixed `controllers/SessionsController.ts:142` - Added proper interval clearing
   - Updated `stores/session.store.ts:87` - Added pause state management
   - Added 3 unit tests in `SessionsController.test.ts`
   - Added E2E test in `session-timer.e2e.spec.ts`

   **Test results**:
   - ✅ All unit tests passing
   - ✅ All integration tests passing
   - ✅ All E2E tests passing
   ```

2. **Move file to done**:
   ```bash
   Move: issue-tracking/in-progress/BUG-timer-not-pausing.md
     To: issue-tracking/done/BUG-timer-not-pausing.md
   ```

3. **Update PLANNING-BOARD.md**:
   - Remove completed item from the board
   - Add next priority from backlog (if applicable)
   - Keep board at 3-5 items maximum

4. **Update CHANGELOG.md**:
   - Add an entry under the upcoming version (or current version if a release is planned)
   - Use [Keep a Changelog](https://keepachangelog.com) format: `## [version] — YYYY-MM-DD` with `### Added / Changed / Fixed / Removed` sub-sections
   - Keep entries concise — one bullet per user-visible change
   - If the version isn't known yet, use `## [Unreleased]`

5. **Update related documentation** (if needed):
   - Architecture docs
   - API documentation
   - README files

## Constraints and Guidelines

### Critical Constraints

1. **Never commit/push without user approval**: Always ask before running git commands
2. **Follow architecture patterns**: Follow your project's established patterns and conventions
3. **TDD approach mandatory**: Tests first, then implementation
4. **Keep PLANNING-BOARD.md lean**: Maximum 3-5 items, short notes only
5. **Real-time updates**: Update Progress Log frequently during work
6. **One issue at a time**: Don't start multiple issues simultaneously

### Testing Guidelines

**Run your test suite**:
- Use your continuous test runner if available
- Keep tests green during implementation
- Run full test suite before marking issue complete

**Quick validation**:
- Run build + test commands for your project
- Verify all tests pass before moving to done

### Documentation Requirements

Update docs **BEFORE, DURING, and AFTER** work:
- **BEFORE**: Update status docs with planned changes
- **DURING**: Track implementation progress in issue Progress Log
- **AFTER**: Update with results, file changes, test outcomes

Key docs to maintain:
- Issue files (Progress Log, Resolution)
- `PLANNING-BOARD.md` (current priorities)
- Component/feature status documentation
- Implementation guides and HOWTOs

## Success Criteria

A work session is complete when:

- [ ] Top priority issue moved to `in-progress/`
- [ ] Implementation plan added to issue file
- [ ] `PLANNING-BOARD.md` status updated
- [ ] Solution implemented following all acceptance criteria
- [ ] All tests passing (unit, E2E, backend)
- [ ] Issue file updated with final status and Resolution
- [ ] Issue moved to `done/`
- [ ] `PLANNING-BOARD.md` updated (item removed, next priority added if applicable)
- [ ] Related documentation updated

## Handling Edge Cases

### If PLANNING-BOARD is Empty

Ask the user:
```
The PLANNING-BOARD is currently empty. Would you like me to:
1. Review the backlog and suggest priorities?
2. Wait for you to add priorities manually?
3. Create a new issue from a bug/feature report?
```

### If Top Priority is Blocked

Identify the blocker and ask:
```
The top priority (BUG-xyz) is blocked by [dependency]. Would you like me to:
1. Work on the blocker first?
2. Skip to the next unblocked item?
3. Re-prioritize the board?
```

### If Issue is Unclear

**ALWAYS ask clarifying questions** before proceeding. Examples:
- "The acceptance criteria mention 'improve performance'. What specific metric should I target?"
- "Should this work for all user roles or just admins?"
- "Which error handling approach do you prefer: silent fail or user notification?"

### If Task is Too Large

Break it down:
```
This task seems too complex for a single issue. I recommend breaking it into:

1. BUG-xyz-part1-database-schema.md (2 hours)
2. BUG-xyz-part2-backend-api.md (3 hours)
3. BUG-xyz-part3-frontend-ui.md (2 hours)

Should I create these sub-issues and start with part 1?
```

## Integration with Other Workflows

### Issue Reporting Workflow

If the user reports a new bug/feature **before** using this skill:
1. Use the **report-issue** skill first to create comprehensive issue documentation
2. The new issue gets added to `backlog/`
3. Update `PLANNING-BOARD.md` if it's high priority
4. Then use this **start-working** skill to implement

### Implementation Plan Workflow

For major features (10% of work), use the **implementation-plan agent** instead:
- Multi-week/multi-phase implementations
- Architecture changes affecting multiple systems
- Need for AI-executable plans with TASK-001 identifiers
- Comprehensive Requirements/Constraints documentation

This skill is optimized for **day-to-day work** (90% of cases): bugs, small features, refactors.

## Repository Structure

### Issue Tracking

```
project-root/
├── issue-tracking/      # Issue workflow system
│   ├── PLANNING-BOARD.md
│   ├── backlog/
│   ├── in-progress/
│   ├── done/            # Recent completions (~20 max)
│   └── archive/         # Historical completions
└── scripts/             # Automation scripts
```

### Adapt to Your Project

- Follow your project's folder structure
- Use your project's naming conventions
- Respect your project's architecture patterns
- Follow your team's coding standards
```bash
ng generate component my-component
```

### Never Modify

- `_legacy/` folder - Historical code, don't touch
- Azure resources - Require explicit user approval
- `.codegen` files - Follow specific modification instructions in file headers

## See Also

- [`issue-tracking/AGENTS.md`](../../issue-tracking/AGENTS.md) - Complete workflow documentation
- [`.github/agents/issue-workflow.agent.md`](../../.github/agents/issue-workflow.agent.md) - Issue workflow agent details
- [`.claude/CLAUDE.md`](../../.claude/CLAUDE.md) - Project-wide instructions
- [`e2e/tests/stage-engine/AGENTS.md`](../../e2e/tests/stage-engine/AGENTS.md) - E2E testing guidance
