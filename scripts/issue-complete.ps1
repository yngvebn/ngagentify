# Issue Complete Script
# Moves an issue from in-progress to done and updates frontmatter

param(
    [Parameter(Mandatory=$true)]
    [string]$IssueId,  # Filename without .md extension
    [string]$InProgressFolder = "issue-tracking/in-progress",
    [string]$DoneFolder = "issue-tracking/done"
)

function Get-StartedTimestamp {
    param([string]$FilePath)

    $content = Get-Content $FilePath -Raw
    if ($content -match 'started:\s*([0-9]{4}-[0-9]{2}-[0-9]{2}\s+[0-9]{2}:[0-9]{2}:[0-9]{2})') {
        return $Matches[1]
    }
    # Fallback for old date-only format
    if ($content -match 'started:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})') {
        return "$($Matches[1]) 00:00:00"
    }
    return $null
}

function Format-TimeSpan {
    param([TimeSpan]$TimeSpan)

    $parts = @()
    if ($TimeSpan.Days -gt 0) { $parts += "$($TimeSpan.Days)d" }
    if ($TimeSpan.Hours -gt 0) { $parts += "$($TimeSpan.Hours)h" }
    if ($TimeSpan.Minutes -gt 0) { $parts += "$($TimeSpan.Minutes)m" }
    if ($TimeSpan.Seconds -gt 0 -and $TimeSpan.TotalMinutes -lt 60) { $parts += "$($TimeSpan.Seconds)s" }

    if ($parts.Count -eq 0) { return "< 1s" }
    return $parts -join " "
}

function Update-Frontmatter {
    param(
        [string]$FilePath,
        [string]$NewStatus,
        [string]$CompletedDate
    )

    $content = Get-Content $FilePath -Raw

    if ($content -notmatch '(?s)^---\s*\n(.*?)\n---(.*)') {
        Write-Host "❌ No frontmatter found in $FilePath" -ForegroundColor Red
        return $false
    }

    $frontmatter = $Matches[1]
    $body = $Matches[2]

    # Update status (use [\w-]+ to match hyphenated statuses like "in-progress")
    $frontmatter = $frontmatter -replace 'status:\s*[\w-]+', "status: $NewStatus"

    # Update completed date if null
    if ($frontmatter -match 'completed:\s*null') {
        $frontmatter = $frontmatter -replace 'completed:\s*null', "completed: $CompletedDate"
    }

    # Update updated date (handle both date and timestamp formats)
    $frontmatter = $frontmatter -replace 'updated:\s*[\d-]+(\s+[\d:]+)?', "updated: $CompletedDate"

    # Write back
    $newContent = "---`n$frontmatter`n---$body"
    Set-Content -Path $FilePath -Value $newContent -NoNewline

    return $true
}

# Main logic
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$completedDateTime = Get-Date
$sourceFile = Join-Path $InProgressFolder "$IssueId.md"
$destFile = Join-Path $DoneFolder "$IssueId.md"

# Validation
if (-not (Test-Path $sourceFile)) {
    Write-Host "❌ Issue not found in in-progress: $sourceFile" -ForegroundColor Red
    Write-Host "💡 Tip: Use just the filename without .md (e.g., FEATURE-basic-topic-friction)" -ForegroundColor Yellow
    exit 1
}

if (Test-Path $destFile) {
    Write-Host "⚠️  Issue already completed: $destFile" -ForegroundColor Yellow
    Write-Host "💡 If you want to reopen it, move it back to backlog manually" -ForegroundColor Yellow
    exit 1
}

# Run validation tests before moving to done
Write-Host "`n🧪 Running validation tests before completing issue..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

$validationFailed = $false

# Test 1: Backend tests (dotnet test)
Write-Host "`n1️⃣  Running backend tests (dotnet test)..." -ForegroundColor Yellow
Push-Location Server.Tests
try {
    $dotnetTestOutput = dotnet test 2>&1
    $dotnetTestExitCode = $LASTEXITCODE

    if ($dotnetTestExitCode -ne 0) {
        Write-Host "❌ Backend tests FAILED" -ForegroundColor Red
        Write-Host $dotnetTestOutput -ForegroundColor DarkGray
        $validationFailed = $true
    } else {
        Write-Host "✅ Backend tests passed" -ForegroundColor Green
    }
} finally {
    Pop-Location
}

# Test 2: TypeScript compilation check
Write-Host "`n2️⃣  Running TypeScript compilation check..." -ForegroundColor Yellow
$tscOutput = npx tsc -p ./.storybook/tsconfig.json --noEmit 2>&1
$tscExitCode = $LASTEXITCODE

if ($tscExitCode -ne 0) {
    Write-Host "❌ TypeScript compilation FAILED" -ForegroundColor Red
    Write-Host $tscOutput -ForegroundColor DarkGray
    $validationFailed = $true
} else {
    Write-Host "✅ TypeScript compilation passed" -ForegroundColor Green
}

# Test 3: Frontend tests (Jest)
Write-Host "`n3️⃣  Running frontend tests (Jest)..." -ForegroundColor Yellow
$jestOutput = npx jest --passWithNoTests 2>&1
$jestExitCode = $LASTEXITCODE

if ($jestExitCode -ne 0) {
    Write-Host "❌ Frontend tests FAILED - USE WALLABY MCP TO DEBUG" -ForegroundColor Red
    Write-Host $jestOutput -ForegroundColor DarkGray
    $validationFailed = $true
} else {
    Write-Host "✅ Frontend tests passed" -ForegroundColor Green
}

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

# Exit if any validation failed
if ($validationFailed) {
    Write-Host "`n❌ VALIDATION FAILED: Cannot complete issue" -ForegroundColor Red
    Write-Host "💡 Fix the failing tests before marking this issue as complete" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n✅ All validation tests passed!" -ForegroundColor Green

# Ensure done folder exists
if (-not (Test-Path $DoneFolder)) {
    New-Item -ItemType Directory -Path $DoneFolder -Force | Out-Null
}

# Move file
Copy-Item $sourceFile $destFile
Write-Host "📁 Moved: $IssueId.md" -ForegroundColor Cyan
Write-Host "   From: $InProgressFolder/" -ForegroundColor Gray
Write-Host "   To:   $DoneFolder/" -ForegroundColor Gray

# Get started timestamp before updating frontmatter
$startedTimestamp = Get-StartedTimestamp -FilePath $sourceFile

# Update frontmatter
if (Update-Frontmatter -FilePath $destFile -NewStatus "done" -CompletedDate $timestamp) {
    Write-Host "✅ Updated frontmatter:" -ForegroundColor Green
    Write-Host "   status: done" -ForegroundColor Gray
    Write-Host "   completed: $timestamp" -ForegroundColor Gray
    Write-Host "   updated: $timestamp" -ForegroundColor Gray
} else {
    Write-Host "⚠️  Frontmatter update failed (file moved but not updated)" -ForegroundColor Yellow
}

# Delete original
Remove-Item $sourceFile
Write-Host "🗑️  Removed from in-progress" -ForegroundColor Gray

# Calculate time spent
$timeSpentMessage = ""
if ($startedTimestamp) {
    try {
        $startedDateTime = [DateTime]::ParseExact($startedTimestamp, "yyyy-MM-dd HH:mm:ss", $null)
        $timeSpent = $completedDateTime - $startedDateTime
        $timeSpentFormatted = Format-TimeSpan -TimeSpan $timeSpent
        $timeSpentMessage = "`n⏱️  Time spent: $timeSpentFormatted"
    } catch {
        Write-Host "⚠️  Could not calculate time spent (invalid started timestamp)" -ForegroundColor Yellow
    }
}

# Success message
Write-Host "\n✅ SUCCESS: Issue completed" -ForegroundColor Green
Write-Host "📋 Issue ID: $IssueId" -ForegroundColor Cyan
Write-Host "📁 Location: $destFile" -ForegroundColor Cyan
Write-Host "📅 Started: $startedTimestamp" -ForegroundColor Cyan
Write-Host "📅 Completed: $timestamp" -ForegroundColor Cyan
if ($timeSpentMessage) {
    Write-Host $timeSpentMessage -ForegroundColor Magenta
}
Write-Host "\n💡 Required follow-up actions for AI agent:" -ForegroundColor Yellow
Write-Host "   1. CRITICAL: Update PLANNING-BOARD.md (remove this completed item)" -ForegroundColor Red
Write-Host "   2. CRITICAL: Add next high-priority item to PLANNING-BOARD.md" -ForegroundColor Red
Write-Host "   3. Check if this unblocks other issues (review 'depends_on' references)" -ForegroundColor Gray
Write-Host "   4. Update related documentation if needed" -ForegroundColor Gray

# Show backlog high priority items
Write-Host "`n📋 High priority items in backlog:" -ForegroundColor Cyan
$backlogFiles = Get-ChildItem -Path "issue-tracking/backlog" -Filter "*.md"
$highPriorityCount = 0

foreach ($file in $backlogFiles) {
    $content = Get-Content $file.FullName -Raw
    if ($content -match 'priority:\s*high') {
        $highPriorityCount++
        if ($highPriorityCount -le 3) {
            $filename = $file.Name -replace '\.md$', ''
            Write-Host "   • $filename" -ForegroundColor Gray
        }
    }
}

if ($highPriorityCount -eq 0) {
    Write-Host "   (None - check medium priority)" -ForegroundColor DarkGray
} elseif ($highPriorityCount -gt 3) {
    Write-Host "   ... and $($highPriorityCount - 3) more" -ForegroundColor DarkGray
}

Write-Host "`n💡 Tip: Use .\scripts\backlog-view.ps1 -FilterPriority high to see all" -ForegroundColor Yellow
