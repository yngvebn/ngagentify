# Issue Start Script
# Moves an issue from backlog to in-progress and updates frontmatter

param(
    [Parameter(Mandatory=$true)]
    [string]$IssueId,  # Filename without .md extension (e.g., "FEATURE-basic-topic-friction")
    [string]$BacklogFolder = "issue-tracking/backlog",
    [string]$InProgressFolder = "issue-tracking/in-progress"
)

function Update-Frontmatter {
    param(
        [string]$FilePath,
        [string]$NewStatus,
        [string]$StartedDate
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

    # Update started date if null
    if ($frontmatter -match 'started:\s*null') {
        $frontmatter = $frontmatter -replace 'started:\s*null', "started: $StartedDate"
    }

    # Update updated date
    $frontmatter = $frontmatter -replace 'updated:\s*[\d-]+', "updated: $StartedDate"

    # Write back
    $newContent = "---`n$frontmatter`n---$body"
    Set-Content -Path $FilePath -Value $newContent -NoNewline

    return $true
}

# Main logic
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$sourceFile = Join-Path $BacklogFolder "$IssueId.md"
$destFile = Join-Path $InProgressFolder "$IssueId.md"

# Validation
if (-not (Test-Path $sourceFile)) {
    Write-Host "❌ Issue not found: $sourceFile" -ForegroundColor Red
    Write-Host "💡 Tip: Use just the filename without .md (e.g., FEATURE-basic-topic-friction)" -ForegroundColor Yellow
    exit 1
}

if (Test-Path $destFile) {
    Write-Host "⚠️  Issue already in progress: $destFile" -ForegroundColor Yellow
    exit 1
}

# Ensure in-progress folder exists
if (-not (Test-Path $InProgressFolder)) {
    New-Item -ItemType Directory -Path $InProgressFolder -Force | Out-Null
}

# Move file
Copy-Item $sourceFile $destFile
Write-Host "📁 Moved: $IssueId.md" -ForegroundColor Cyan
Write-Host "   From: $BacklogFolder/" -ForegroundColor Gray
Write-Host "   To:   $InProgressFolder/" -ForegroundColor Gray

# Update frontmatter
if (Update-Frontmatter -FilePath $destFile -NewStatus "in-progress" -StartedDate $timestamp) {
    Write-Host "✅ Updated frontmatter:" -ForegroundColor Green
    Write-Host "   status: in-progress" -ForegroundColor Gray
    Write-Host "   started: $timestamp" -ForegroundColor Gray
    Write-Host "   updated: $timestamp" -ForegroundColor Gray
} else {
    Write-Host "⚠️  Frontmatter update failed (file moved but not updated)" -ForegroundColor Yellow
}

# Delete original
Remove-Item $sourceFile
Write-Host "🗑️  Removed from backlog" -ForegroundColor Gray

# Success message
Write-Host "\n✅ SUCCESS: Issue started" -ForegroundColor Green
Write-Host "📋 Issue ID: $IssueId" -ForegroundColor Cyan
Write-Host "📁 Location: $destFile" -ForegroundColor Cyan
Write-Host "📅 Started: $timestamp" -ForegroundColor Cyan
Write-Host "\n💡 Next steps for AI agent:" -ForegroundColor Yellow
Write-Host "   1. Read file to understand acceptance criteria" -ForegroundColor Gray
Write-Host "   2. Add Implementation Plan section with approach, files, tests" -ForegroundColor Gray
Write-Host "   3. Update PLANNING-BOARD.md with current status" -ForegroundColor Gray
Write-Host "   4. Begin TDD implementation (write failing tests first)" -ForegroundColor Gray
Write-Host "   5. Update Progress Log in real-time as work proceeds" -ForegroundColor Gray
Write-Host "\n📄 File ready for reading/editing" -ForegroundColor Green
