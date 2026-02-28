# Issue Create Script
# Create issues with frontmatter (interactive or non-interactive)

param(
    [string]$Type,           # bug, feature, refactor, explore (optional - prompts if missing)
    [string]$Title,          # Issue title (optional - prompts if missing)
    [string]$Priority,       # high, medium, low (optional - defaults to medium)
    [string]$Effort,         # e.g., 2h, 4h, 1d, 3d, 1w (optional - defaults to 4h)
    [string]$Labels,         # Comma-separated (optional)
    [string]$RiskCategory,   # Comma-separated risk types (optional): security, data-loss, performance, etc.
    [string]$RiskImpact,     # high, medium, low (optional)
    [string]$BacklogFolder = "issue-tracking/backlog",
    [switch]$NonInteractive  # Skip all prompts, use defaults
)

function Get-ValidatedInput {
    param(
        [string]$Prompt,
        [string[]]$ValidValues,
        [string]$DefaultValue = $null
    )

    while ($true) {
        if ($DefaultValue) {
            Write-Host "$Prompt [$DefaultValue]: " -NoNewline -ForegroundColor Cyan
        } else {
            Write-Host "${Prompt}: " -NoNewline -ForegroundColor Cyan
        }

        $input = Read-Host

        if ([string]::IsNullOrWhiteSpace($input) -and $DefaultValue) {
            return $DefaultValue
        }

        if ($ValidValues -and $input -notin $ValidValues) {
            Write-Host "❌ Invalid value. Choose from: $($ValidValues -join ', ')" -ForegroundColor Red
            continue
        }

        if (-not [string]::IsNullOrWhiteSpace($input)) {
            return $input
        }

        Write-Host "❌ Value required" -ForegroundColor Red
    }
}

function Convert-ToKebabCase {
    param([string]$Text)

    # Remove special characters, convert to lowercase, replace spaces with hyphens
    $kebab = $Text.ToLower() -replace '[^\w\s-]', '' -replace '\s+', '-' -replace '-+', '-'
    $kebab = $kebab.Trim('-')

    # Limit length
    if ($kebab.Length -gt 50) {
        $kebab = $kebab.Substring(0, 50).TrimEnd('-')
    }

    return $kebab
}

# Determine if running interactively
$isInteractive = -not $NonInteractive -and -not $Title

if ($isInteractive) {
    Write-Host "\n📝 Create New Issue" -ForegroundColor Cyan
    Write-Host ("=" * 50)
}

# Type
if (-not $Type) {
    if ($isInteractive) {
        $Type = Get-ValidatedInput -Prompt "Type (bug/feature/refactor/explore)" `
            -ValidValues @('bug', 'feature', 'refactor', 'explore') `
            -DefaultValue 'feature'
    } else {
        $Type = 'feature'
    }
}

$typePrefix = $Type.ToUpper()

# Title
if (-not $Title) {
    if ($isInteractive) {
        Write-Host "\nTitle (brief description): " -NoNewline -ForegroundColor Cyan
        $Title = Read-Host
    }
    if ([string]::IsNullOrWhiteSpace($Title)) {
        Write-Host "❌ ERROR: Title required" -ForegroundColor Red
        exit 1
    }
}

# Generate filename
$kebabTitle = Convert-ToKebabCase $Title
$issueId = "$typePrefix-$kebabTitle"
$filename = "$issueId.md"
$filepath = Join-Path $BacklogFolder $filename

# Check if exists
if (Test-Path $filepath) {
    Write-Host "❌ ERROR: Issue already exists: $filename" -ForegroundColor Red
    exit 1
}

# Priority
if (-not $Priority) {
    if ($isInteractive) {
        $Priority = Get-ValidatedInput -Prompt "`nPriority (high/medium/low)" `
            -ValidValues @('high', 'medium', 'low') `
            -DefaultValue 'medium'
    } else {
        $Priority = 'medium'
    }
}

# Effort
if (-not $Effort) {
    if ($isInteractive) {
        Write-Host "`nEffort estimate (e.g., 2h, 4h, 1d, 3d, 1w) [4h]: " -NoNewline -ForegroundColor Cyan
        $Effort = Read-Host
    }
    if ([string]::IsNullOrWhiteSpace($Effort)) {
        $Effort = '4h'
    }
}

# Labels
if (-not $Labels) {
    if ($isInteractive) {
        Write-Host "`nLabels (comma-separated, optional): " -NoNewline -ForegroundColor Cyan
        $Labels = Read-Host
    }
}

if ([string]::IsNullOrWhiteSpace($Labels)) {
    $labels = '[]'
} else {
    $labelArray = $Labels -split ',' | ForEach-Object { $_.Trim() }
    $labels = '[' + (($labelArray | ForEach-Object { $_ }) -join ', ') + ']'
}

# Risk Category
if (-not $RiskCategory) {
    if ($isInteractive) {
        Write-Host "`nRisk Category (comma-separated, optional):" -ForegroundColor Cyan
        Write-Host "  Options: security, data-loss, performance, breaking-change, ux-regression," -ForegroundColor Gray
        Write-Host "           integration, database, infrastructure, compliance, none" -ForegroundColor Gray
        Write-Host "  Enter categories: " -NoNewline -ForegroundColor Cyan
        $RiskCategory = Read-Host
    }
}

if ([string]::IsNullOrWhiteSpace($RiskCategory)) {
    $riskCategory = '[]'
} else {
    $riskCategoryArray = $RiskCategory -split ',' | ForEach-Object { $_.Trim() }
    $riskCategory = '[' + (($riskCategoryArray | ForEach-Object { $_ }) -join ', ') + ']'
}

# Risk Impact
if (-not $RiskImpact) {
    if ($isInteractive) {
        Write-Host "`nRisk Impact (high/medium/low, optional): " -NoNewline -ForegroundColor Cyan
        $RiskImpact = Read-Host
    }
}

# Validate risk impact if provided
if (-not [string]::IsNullOrWhiteSpace($RiskImpact)) {
    $validRiskImpacts = @('high', 'medium', 'low')
    if ($RiskImpact -notin $validRiskImpacts) {
        Write-Host "❌ ERROR: Invalid risk_impact. Must be: high, medium, or low" -ForegroundColor Red
        exit 1
    }
    $riskImpact = $RiskImpact
} else {
    $riskImpact = 'null'
}

# Dates (using timestamp for precise tracking)
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Generate frontmatter
$frontmatter = @"
---
id: $issueId
type: $Type
priority: $Priority
effort: $Effort
status: backlog
labels: $labels
risk_category: $riskCategory
risk_impact: $riskImpact
depends_on: []
blocks: []
created: $timestamp
updated: $timestamp
started: null
completed: null
---
"@

# Generate body template
$bodyTemplate = @"

# $($typePrefix): $Title

## Problem Statement

[Describe the problem or need]

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

## Verification

- [ ] Unit tests passing
- [ ] E2E tests passing (if applicable)
- [ ] Backend tests passing (if applicable)
- [ ] Documentation updated

## Resolution

[Final outcome, what was implemented, any deviations from plan]

## Related Issues

[Links to related bugs/features]
"@

# Combine frontmatter and body
$content = $frontmatter + $bodyTemplate

# Ensure backlog folder exists
if (-not (Test-Path $BacklogFolder)) {
    New-Item -ItemType Directory -Path $BacklogFolder -Force | Out-Null
}

# Write file
Set-Content -Path $filepath -Value $content -NoNewline

# Success - structured output for AI agents
Write-Host "`n✅ SUCCESS: Issue created" -ForegroundColor Green
Write-Host "📋 Issue ID: $issueId" -ForegroundColor Cyan
Write-Host "📁 File path: $filepath" -ForegroundColor Cyan
Write-Host "`n📊 Issue metadata:" -ForegroundColor Cyan
Write-Host "   Type: $Type" -ForegroundColor Gray
Write-Host "   Priority: $Priority" -ForegroundColor Gray
Write-Host "   Effort: $Effort" -ForegroundColor Gray
Write-Host "   Status: backlog" -ForegroundColor Gray
Write-Host "   Labels: $Labels" -ForegroundColor Gray
Write-Host "   Created: $timestamp" -ForegroundColor Gray

Write-Host "`n💡 Required next steps for AI agent:" -ForegroundColor Yellow
Write-Host "   1. Read file: $filepath" -ForegroundColor Gray
Write-Host "   2. Fill in Problem Statement section" -ForegroundColor Gray
Write-Host "   3. Complete Acceptance Criteria (use checkboxes)" -ForegroundColor Gray
Write-Host "   4. Add Technical Context (affected files, systems)" -ForegroundColor Gray
if ($Priority -eq 'high') {
    Write-Host "   5. CRITICAL: Add to PLANNING-BOARD.md (high priority item)" -ForegroundColor Red
} else {
    Write-Host "   5. Optionally add to PLANNING-BOARD.md if current priority" -ForegroundColor Gray
}
Write-Host "   6. Use .\scripts\issue-start.ps1 $issueId when ready to implement" -ForegroundColor Gray
Write-Host "`n📄 File ready for editing" -ForegroundColor Green
