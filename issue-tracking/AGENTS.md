# Issue Tracking System - Agent Instructions

This folder contains the project's issue tracking system with a simple, file-based workflow.

## Core Principles

- **One issue per file**: Each bug, feature, or refactor gets its own markdown file
- **Clear status tracking**: Issues move between folders as work progresses
- **Living documents**: Update files in real-time as work proceeds
- **Structured naming**: Consistent file naming for easy identification
- **Prioritize effectively**: Use priority levels and effort estimates to focus on high-impact work

## Folder Structure

```
issue-tracking/
├── PLANNING-BOARD.md  # Current priorities (what's next)
├── backlog/           # New issues, not yet started
├── in-progress/       # Currently being worked on
├── done/              # Recently completed (max ~20 items)
├── archive/           # Older completed issues (moved from done/)
└── wont-fix/          # Decided not to implement
```

## PLANNING-BOARD.md

**Purpose**: A short, focused list of the next 3-5 prioritized actions. This is your north star for what to work on next.

**Key Rules**:
- **Keep it short**: Maximum 3-5 items at any time
- **Not a history**: Remove completed items, don't accumulate
- **Always current**: Update during every work session
- **Priority order**: Most important items at the top
- **Actionable**: Each item should be clear and specific

**When to Update**:
- **Before starting work**: Check priorities, pick top item
- **During work**: Update status/notes as you progress
- **After completion**: Remove completed item, add next priority
- **When priorities shift**: Reorder or replace items immediately

**What to Include**:
- Next feature to implement (link to backlog issue)
- Critical bug to fix (link to backlog issue)
- Refactoring needed before next feature
- Blocking technical debt
- Dependencies to unblock other work

**What NOT to Include**:
- Completed work (move to done/ folder instead)
- Detailed implementation notes (use issue files)
- Long-term vision (use backlog/ for that)
- Nice-to-have ideas (backlog/ or separate doc)

## File Naming Convention

Use descriptive, kebab-case names with type prefix:

- **Bugs**: `BUG-[short-description].md`
  - Example: `BUG-timer-not-pausing.md`
  - Example: `BUG-voting-results-incorrect.md`

- **Features**: `FEATURE-[short-description].md`
  - Example: `FEATURE-anonymous-voting.md`
  - Example: `FEATURE-export-session-results.md`

- **Refactors**: `REFACTOR-[short-description].md`
  - Example: `REFACTOR-simplify-auth-flow.md`
  - Example: `REFACTOR-extract-timer-logic.md`

- **Exploratories**: `EXPLORE-[short-description].md`
  - Example: `EXPLORE-database-migration-options.md`
  - Example: `EXPLORE-ui-component-library.md`

- **Plans**: `PLAN-[short-description].md`
  - Example: `PLAN-authentication-module.md`
  - Example: `PLAN-payment-integration.md`
  - Used for major features requiring comprehensive planning
  - Created by implementation-plan agent (see Agent Decision Matrix below)

## Issue File Metadata (YAML Frontmatter)

**All new issues MUST include YAML frontmatter** at the top of the file:

```yaml
---
id: FEATURE-001                    # Auto-generated from filename (required)
type: feature                      # bug | feature | refactor | explore (required)
priority: high                     # high | medium | low (required)
effort: 4h                         # Estimated effort: 2h, 1d, 3d, 1w (required)
status: backlog                    # backlog | in-progress | done | wont-fix (required)
labels: [insights, api, do-early]  # Tags for filtering (optional)
risk_category: [security, data-loss] # Risk types (optional, see Risk Assessment below)
risk_impact: high                  # high | medium | low (optional, see Risk Assessment below)
depends_on: []                     # Issue IDs this depends on (optional)
blocks: []                         # Issue IDs this blocks (optional)
created: 2025-11-24               # Creation date YYYY-MM-DD (required)
updated: 2025-11-24               # Last update YYYY-MM-DD (required)
started: null                      # Date moved to in-progress (auto-set)
completed: null                    # Date moved to done (auto-set)
---
```

**Field Definitions**:

- **id**: Extracted from filename (e.g., `FEATURE-basic-topic-friction.md` → `FEATURE-basic-topic-friction`)
- **type**: Issue category - `bug`, `feature`, `refactor`, `explore`, or `plan`
- **priority**: Urgency level - `high` (do now), `medium` (do soon), `low` (do later)
- **effort**: Time estimate - `2h`, `4h`, `1d`, `3d`, `1w` (hours/days/weeks)
- **status**: Current state - `backlog`, `in-progress`, `done`, `wont-fix`
- **labels**: Array of tags for filtering/grouping (e.g., `[frontend, ui, accessibility]`)
- **risk_category**: Array of risk types this issue introduces (optional, see Risk Assessment section)
- **risk_impact**: Severity if something goes wrong - `high`, `medium`, `low` (optional, see Risk Assessment section)
- **depends_on**: Array of issue IDs that must complete first (e.g., `[FEATURE-user-authentication]`)
- **blocks**: Array of issue IDs waiting on this issue
- **created**: Date created in YYYY-MM-DD format
- **updated**: Date last modified in YYYY-MM-DD format (update on every significant change)
- **started**: Date moved to `in-progress/` (null until started)
- **completed**: Date moved to `done/` (null until completed)

**Frontmatter Rules**:
- Always include frontmatter in new issues
- Update `updated` date on every significant change
- Update `status` when moving files between folders
- Set `started` when moving to `in-progress/`
- Set `completed` when moving to `done/`
- Keep `labels` consistent across related issues
- Use `depends_on` to track dependencies explicitly

**Legacy Issues** (created before frontmatter was added):
- Frontmatter is optional for existing issues
- Add frontmatter when making significant updates
- No need to backfill all old issues

## Risk Assessment (Production Readiness)

**Purpose**: Identify and track potential risks introduced by changes to ensure production safety and informed prioritization.

### Risk Category (risk_category)

**Format**: Array of risk types (e.g., `[security, data-loss, performance]`)

**Available Categories**:
- **`security`** - Authentication, authorization, data exposure, XSS, CSRF, SQL injection
- **`data-loss`** - Could cause data deletion, corruption, or loss
- **`performance`** - Could degrade app performance, increase latency, cause bottlenecks
- **`breaking-change`** - API changes, backward compatibility issues, contract changes
- **`ux-regression`** - Could break existing user workflows or expected behavior
- **`integration`** - Third-party service dependencies (payment providers, external APIs, webhooks)
- **`database`** - Schema changes, migrations, RLS policies, indexes
- **`infrastructure`** - Deployment changes, scaling, cloud resources, configuration
- **`compliance`** - GDPR, data privacy, legal requirements, audit requirements
- **`none`** - Low-risk changes (refactoring, docs, tests only, CSS changes)

**Examples**:
```yaml
risk_category: [security, data-loss]  # Auth change that touches user data
risk_category: [integration, performance]  # Payment webhook with heavy processing
risk_category: [database, breaking-change]  # Database migration changing column types
risk_category: [none]  # CSS refactoring, no logic changes
```

### Risk Impact (risk_impact)

**Format**: Single value (`high`, `medium`, `low`)

**Impact Levels**:

- **`high`** - Could cause:
  - Data loss or corruption
  - Security breach or data exposure
  - Application downtime or critical failures
  - Revenue loss or payment failures
  - Legal/compliance violations
  - Major user-facing bugs affecting core workflows
  - **Examples**: Billing changes, authentication overhaul, database migrations, permission policy changes

- **`medium`** - Could cause:
  - Feature degradation or partial failures
  - Poor UX or user confusion
  - Performance issues (slow queries, memory leaks)
  - Customer complaints or support tickets
  - Recoverable errors with manual intervention
  - **Examples**: New feature with edge cases, API endpoint changes, integration updates

- **`low`** - Limited blast radius:
  - Minor bugs or cosmetic issues
  - Internal tooling or developer experience
  - Non-critical features with limited usage
  - Easy to rollback or fix
  - **Examples**: CSS changes, refactoring, documentation, test improvements

### Risk-Based Decision Matrix

| Risk Impact | Priority | Recommendation |
|-------------|----------|----------------|
| **High** | High | ⚠️ **Pre-Launch Gate** - Must complete before production. Requires: extensive testing, security review, staging validation, rollback plan, monitoring setup |
| **High** | Medium/Low | 🔒 **Defer to Post-Launch** - Too risky to rush. Schedule for v1.1 with proper planning |
| **Medium** | High | ✅ **Launch with Monitoring** - Complete with rollback plan, monitor closely post-launch |
| **Medium** | Medium/Low | 📋 **Backlog Candidate** - Evaluate based on team capacity and launch timeline |
| **Low** | Any | ✅ **Safe to Ship** - Low risk, proceed with standard testing and code review |

### Required Checks for High-Risk Issues

When `risk_impact: high`, the following MUST be completed before marking as done:

- [ ] **Security Review** - Code reviewed for vulnerabilities (SQL injection, XSS, auth bypass, etc.)
- [ ] **Database Backup Plan** - Rollback procedure documented (for database changes)
- [ ] **Staging Validation** - Tested in staging environment with production-like data
- [ ] **Monitoring Setup** - Alerts configured for failure scenarios
- [ ] **Rollback Procedure** - Step-by-step rollback instructions documented
- [ ] **Customer Communication** - Communication plan prepared (if user-facing)
- [ ] **Load Testing** - Performance tested under expected load (for performance-critical changes)

### Risk Assessment Guidelines

**When to use `risk_category: [security]`:**
- Changes to authentication or authorization logic
- User data access or permission checks
- API endpoints handling sensitive data
- Integration with third-party services (OAuth, webhooks)
- Changes to permission policies or data filtering

**When to use `risk_category: [data-loss]`:**
- Database migrations (especially dropping columns/tables)
- Bulk delete operations
- Data transformation or migration scripts
- Changes to backup/restore procedures
- File upload/deletion features

**When to use `risk_category: [database]`:**
- Schema changes (adding/removing/modifying columns)
- Index creation/deletion
- Permission or access policy changes
- Migration scripts
- Query performance optimizations

**When to use `risk_category: [integration]`:**
- Payment processing changes
- External API integration changes
- Third-party webhook handling
- OAuth flow modifications
- Third-party API upgrades

**When to use `risk_impact: high`:**
- Changes that could cause data loss or corruption
- Changes to billing or payment processing
- Authentication or authorization changes
- Database schema migrations
- Breaking API changes
- Permission or access policy modifications

**When to use `risk_impact: low`:**
- CSS-only changes
- Documentation updates
- Refactoring with no behavior changes
- Test improvements
- Internal tooling updates
- Comment additions

**When to omit risk fields:**
- Documentation-only changes (README updates)
- Comment-only changes
- Test-only additions (no production code changes)
- Low-risk refactorings with comprehensive test coverage

## Agent Decision Matrix

This project has two AI agents for issue management. Choose based on scope and complexity:

### Use `issue-workflow.agent.md` (90% of work)

**When**:
- Bugs and bug fixes
- Small features (< 1 week)
- Refactors and code cleanup
- Day-to-day development tasks
- Explorations and research spikes

**Characteristics**:
- Human-readable, lightweight tracking
- Checkbox-based acceptance criteria
- Real-time Progress Log updates
- TDD emphasis (write tests first)
- Quick iteration and feedback
- PLANNING-BOARD.md integration

**File naming**: `BUG-`, `FEATURE-`, `REFACTOR-`, `EXPLORE-`

### Use `implementation-plan.agent.md` (10% of work)

**When**:
- Major features (multi-week/multi-phase)
- Architecture changes affecting multiple systems
- Complex explorations requiring alternatives analysis
- Need for comprehensive Requirements/Constraints documentation
- AI-executable plans for automated processing

**Characteristics**:
- Machine-parseable structure (TASK-001 identifiers, tables)
- Comprehensive sections (Requirements, Alternatives, Dependencies)
- Deterministic language for AI-to-AI execution
- Structured phase tracking with measurable criteria
- Front matter with status badges

**File naming**: `PLAN-`

**Movement**: Same as other issues: `backlog/` → `in-progress/` → `done/`

**Note**: PLAN- files don't appear on PLANNING-BOARD.md (they track progress internally via status badges and task tables). Only current work-in-progress items (3-5 max) go on the planning board.

## Workflow

### 1. Before Starting Work

1. **Move file** from `backlog/` to `in-progress/`
2. **Read the file** to understand scope and requirements
3. **Add implementation plan** section with:
   - Approach and strategy
   - Files to be modified
   - Tests to be added/updated
   - Dependencies or blockers
   - Estimated effort

### 2. During Implementation

- **Update progress** in real-time as you complete steps
- **Document decisions** made during implementation
- **Track file changes** with list of modified files
- **Note blockers** or scope changes immediately
- **Update test status** as tests are written/passing
- **Monitor your test suite** continuously, making sure tests don't break

### 3. After Completion

1. **Verify all acceptance criteria** are met
2. **Confirm tests** are passing (unit, E2E, backend)
3. **Update file** with final status and outcomes
4. **Move file** to `done/` folder
5. **Update** related documentation if needed

### 4. Won't Fix

If an issue is no longer relevant or decided against:
1. **Add explanation** why it won't be implemented
2. **Move file** to `wont-fix/` folder
3. **Retain for reference** (don't delete)

## File Template

Use this structure for all issue files:

```markdown
# [Type]: [Short Description]

**Status**: [Backlog/In Progress/Done/Won't Fix]
**Created**: [Date]
**Priority**: [High/Medium/Low]
**Labels**: [comma, separated, labels]

## Problem Statement
[Clear description of the bug or feature need]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Context
[Relevant technical details, affected systems, related code]

## Implementation Plan
[Added when moving to in-progress]
- Approach: [Strategy]
- Files to modify: [List]
- Tests needed: [List]
- Dependencies: [List]

## Progress Log
[Real-time updates during implementation]
- [Timestamp] - [What was done]
- [Timestamp] - [Decision made]
- [Timestamp] - [Test status]

## Verification
- [ ] Unit tests passing
- [ ] E2E tests passing
- [ ] Backend tests passing
- [ ] Documentation updated
- [ ] Code reviewed

## Resolution
[Final outcome, what was implemented, any deviations from plan]

## Related Issues
[Links to related bugs/features]
```

## Agent Responsibilities

### When Creating Issues
- Do a proper analysis of the bug or feature request first
- Look through codebase and identify possible causes/places of interest to add to the report
- Ask follow up questions to the user if the report or request is unclear
- Do not bundle multiple unrelated tasks in same document - Create multiple documents if needed
- Use correct naming convention
- Start in `backlog/` folder
- Fill out all template sections (except Implementation Plan)
- Set priority and labels
- Cross-reference related issues

### Before Starting Work
- **Check PLANNING-BOARD.md** for current priorities
- Move to `in-progress/`
- Add detailed implementation plan
- **Update PLANNING-BOARD.md** with current status
- Verify no conflicting work in progress
- Check dependencies are resolved

### TDD Approach
- Check to see if existing unit tests have coverage for reported bug
- If no coverage, add a test to reproduce
- Fix implementation in order to turn test green

### During Work
- **Update PLANNING-BOARD.md** as work progresses
- Update Progress Log frequently
- Keep status current
- Document all decisions
- Track file modifications
- Update test status

### After Completion
- Verify all criteria met
- Confirm all tests passing
- Update documentation
- Move to `done/`
- **Remove from PLANNING-BOARD.md**
- **Add next priority to PLANNING-BOARD.md**
- Close any related issues

### Archive Management
- Keep `done/` folder lean: Maximum ~20 recent completions
- Periodically move older completed issues to `archive/`
- Use `.\scripts\archive-old-issues.ps1` to automate archival
- Archive criteria: Completed more than 90 days ago
- Preserve all files in archive for historical reference

### When Abandoning
- Document why in Resolution section
- Move to `wont-fix/`
- Update related issues

## Best Practices

1. **One thing at a time**: Limit work in `in-progress/` to avoid context switching
2. **Update frequently**: Keep files current with real progress
3. **Be specific**: Clear, actionable descriptions and criteria
4. **Link related work**: Cross-reference related issues
5. **Test first**: Define test strategy before implementation
6. **Document decisions**: Record why, not just what
7. **Complete fully**: Don't move to done until verified

## Integration with Workflow

- **Before pull requests**: Verify issue in `done/` folder
- **During code review**: Reference issue file for context
- **Sprint planning**: Review `backlog/` for priorities
- **Retrospectives**: Analyze `done/` and `wont-fix/` patterns

## PowerShell Scripts

**All scripts support AI-agent execution** with rich, structured output and no interactive prompts when needed.

The following scripts automate common issue management tasks:

### `.\scripts\issue-create.ps1`
**Purpose**: Create a new issue with frontmatter (interactive or non-interactive)

**AI Agent Usage** (recommended):
```powershell
.\scripts\issue-create.ps1 -Type feature -Title "Add export to CSV" -Priority medium -Effort 1d -Labels "export,csv,reporting" -NonInteractive
```

**Interactive Usage**:
```powershell
.\scripts\issue-create.ps1  # Prompts for all values
```

**Parameters**:
- `-Type`: bug, feature, refactor, explore (default: feature)
- `-Title`: Issue title (required for non-interactive)
- `-Priority`: high, medium, low (default: medium)
- `-Effort`: 2h, 4h, 1d, 3d, 1w (default: 4h)
- `-Labels`: Comma-separated (optional)
- `-NonInteractive`: Skip prompts, use defaults

**Output**:
- ✅ SUCCESS/❌ ERROR status
- 📋 Issue ID, 📁 File path
- 💡 Required next steps (actionable, numbered)
- 🚨 Highlights critical actions (high priority → update PLANNING-BOARD)

### `.\scripts\issue-start.ps1 <issue-id>`
**Purpose**: Start working on an issue (move backlog → in-progress)

**Usage**:
```powershell
.\scripts\issue-start.ps1 FEATURE-user-authentication
```

**What it does**:
- Moves file from `backlog/` to `in-progress/`
- Updates frontmatter: `status: in-progress`, sets `started` date
- Updates `updated` date
- Optionally opens file in editor

**Reminder**: Update `PLANNING-BOARD.md` manually after running

### `.\scripts\issue-complete.ps1 <issue-id>`
**Purpose**: Mark issue as done (move in-progress → done)

**Usage**:
```powershell
.\scripts\issue-complete.ps1 FEATURE-user-authentication
```

**What it does**:
- Moves file from `in-progress/` to `done/`
- Updates frontmatter: `status: done`, sets `completed` date
- Updates `updated` date
- Shows high-priority backlog items for next work

**Reminder**: Update `PLANNING-BOARD.md` manually after running (remove completed, add next priority)

### `.\scripts\backlog-view.ps1`
**Purpose**: View and filter backlog issues

**Usage**:
```powershell
# View all with statistics
.\scripts\backlog-view.ps1 -ShowStats

# Filter by priority
.\scripts\backlog-view.ps1 -FilterPriority high

# Filter by type
.\scripts\backlog-view.ps1 -FilterType bug

# Sort by effort (smallest first)
.\scripts\backlog-view.ps1 -SortBy effort
```

**What it shows**:
- All issues with frontmatter
- Priority, effort, labels, dependencies
- Total effort calculations
- Statistics by type and priority

### `.\\scripts\\archive-old-issues.ps1`
**Purpose**: Move older completed issues from done/ to archive/

**Usage**:
```powershell
# Archive issues completed more than 90 days ago (default)
.\scripts\archive-old-issues.ps1

# Custom age threshold (e.g., 60 days)
.\scripts\archive-old-issues.ps1 -DaysOld 60

# Preview what would be archived without moving
.\scripts\archive-old-issues.ps1 -WhatIf
```

**Parameters**:
- `-DaysOld`: Age threshold in days (default: 90)
- `-WhatIf`: Preview mode, doesn't move files

**What it does**:
- Identifies issues in `done/` completed more than N days ago
- Moves them to `archive/` folder
- Preserves all frontmatter and content
- Shows summary of archived items

**When to run**:
- When `done/` folder exceeds ~20-25 items
- Monthly maintenance routine
- After major project milestones

## Maintenance

- Periodically review `in-progress/` for stale issues
- Keep `done/` folder lean (~20 items max) by moving older issues to `archive/`
- Archive completed issues older than 90 days using `.\scripts\archive-old-issues.ps1`
- Clean up duplicate issues
- Update templates as workflow evolves
- Archive preserves all historical data for retrospectives and analysis
