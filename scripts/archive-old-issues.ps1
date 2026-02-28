# Archive Old Issues Script
# Moves older completed issues from done/ to archive/ to keep done/ folder lean
# Default threshold: 90 days old

param(
    [int]$DaysOld = 90,            # Age threshold in days
    [switch]$WhatIf,               # Preview mode, doesn't move files
    [string]$DoneFolder = "issue-tracking/done",
    [string]$ArchiveFolder = "issue-tracking/archive"
)

function Parse-Frontmatter {
    param([string]$FilePath)

    $content = Get-Content $FilePath -Raw
    if ($content -notmatch '(?s)^---\s*\n(.*?)\n---') {
        return $null
    }

    $frontmatter = $Matches[1]
    $data = @{}

    foreach ($line in $frontmatter -split "`n") {
        if ($line -match '^\s*([^:]+):\s*(.+)$') {
            $key = $Matches[1].Trim()
            $value = $Matches[2].Trim()

            # Parse arrays
            if ($value -match '^\[(.*)\]$') {
                $data[$key] = $Matches[1] -split ',\s*' | ForEach-Object { $_.Trim() }
            }
            # Parse null
            elseif ($value -eq 'null') {
                $data[$key] = $null
            }
            # Parse strings
            else {
                $data[$key] = $value
            }
        }
    }

    $data['_filepath'] = $FilePath
    $data['_filename'] = Split-Path $FilePath -Leaf
    return $data
}

# Ensure archive folder exists
if (-not (Test-Path $ArchiveFolder)) {
    if ($WhatIf) {
        Write-Host "📁 [WhatIf] Would create archive folder: $ArchiveFolder" -ForegroundColor Cyan
    } else {
        New-Item -ItemType Directory -Path $ArchiveFolder -Force | Out-Null
        Write-Host "📁 Created archive folder: $ArchiveFolder" -ForegroundColor Cyan
    }
}

# Get all completed issues
$issueFiles = Get-ChildItem -Path $DoneFolder -Filter "*.md" -File -ErrorAction SilentlyContinue

if ($issueFiles.Count -eq 0) {
    Write-Host "No completed issues found in $DoneFolder" -ForegroundColor Yellow
    return
}

# Calculate cutoff date
$cutoffDate = (Get-Date).AddDays(-$DaysOld)

# Parse and filter issues
$issuesToArchive = @()
$totalIssues = 0

foreach ($file in $issueFiles) {
    $totalIssues++
    $data = Parse-Frontmatter -FilePath $file.FullName

    if ($data -and $data.completed) {
        try {
            $completedDate = [DateTime]::Parse($data.completed)

            if ($completedDate -lt $cutoffDate) {
                $issuesToArchive += $data
            }
        }
        catch {
            Write-Host "⚠️  Warning: Could not parse completed date for $($file.Name)" -ForegroundColor Yellow
        }
    }
}

# Display results
Write-Host "`n📦 Archive Old Issues" -ForegroundColor Green
Write-Host ("=" * 70)
Write-Host "Cutoff Date: $($cutoffDate.ToString('yyyy-MM-dd')) (issues completed before this date)" -ForegroundColor Cyan
Write-Host "Total issues in done/: $totalIssues" -ForegroundColor Gray
Write-Host "Issues to archive: $($issuesToArchive.Count)" -ForegroundColor Cyan

if ($issuesToArchive.Count -eq 0) {
    Write-Host "`n✅ No issues older than $DaysOld days. Done folder is up to date." -ForegroundColor Green
    return
}

# Group by type for summary
$byType = $issuesToArchive | Group-Object type | Sort-Object Count -Descending

Write-Host "`nBreakdown by type:" -ForegroundColor Yellow
foreach ($group in $byType) {
    $typeIcon = switch ($group.Name) {
        'bug' { '🐛' }
        'feature' { '✨' }
        'refactor' { '♻️' }
        'explore' { '🔍' }
        default { '📝' }
    }
    Write-Host "  $typeIcon $($group.Name): $($group.Count)" -ForegroundColor Gray
}

# Show some examples
Write-Host "`nOldest issues to archive (top 10):" -ForegroundColor Yellow
$oldest = $issuesToArchive | Sort-Object { [DateTime]::Parse($_.completed) } | Select-Object -First 10

foreach ($issue in $oldest) {
    $typeIcon = switch ($issue.type) {
        'bug' { '🐛' }
        'feature' { '✨' }
        'refactor' { '♻️' }
        'explore' { '🔍' }
        default { '📝' }
    }
    Write-Host "  $typeIcon $($issue.id) - completed $($issue.completed)" -ForegroundColor DarkGray
}

if ($issuesToArchive.Count -gt 10) {
    Write-Host "  ... and $($issuesToArchive.Count - 10) more" -ForegroundColor DarkGray
}

# Preview or execute
if ($WhatIf) {
    Write-Host "`n🔍 [WhatIf] Preview mode - no files will be moved" -ForegroundColor Yellow
    Write-Host "Run without -WhatIf to actually archive these issues" -ForegroundColor Yellow
} else {
    Write-Host "`n📦 Moving issues to archive..." -ForegroundColor Cyan

    $movedCount = 0
    $errorCount = 0

    foreach ($issue in $issuesToArchive) {
        $sourceFile = $issue._filepath
        $destFile = Join-Path $ArchiveFolder $issue._filename

        try {
            # Check if destination already exists
            if (Test-Path $destFile) {
                Write-Host "  ⚠️  Skipping $($issue.id) - already exists in archive" -ForegroundColor Yellow
                continue
            }

            # Move the file
            Move-Item -Path $sourceFile -Destination $destFile -Force
            $movedCount++

            if ($movedCount -le 5) {
                Write-Host "  ✅ Archived: $($issue.id)" -ForegroundColor Green
            }
        }
        catch {
            Write-Host "  ❌ Error archiving $($issue.id): $_" -ForegroundColor Red
            $errorCount++
        }
    }

    if ($movedCount -gt 5) {
        Write-Host "  ... and $($movedCount - 5) more" -ForegroundColor Gray
    }

    # Summary
    Write-Host "`n✅ Archive complete" -ForegroundColor Green
    Write-Host ("=" * 70)
    Write-Host "Successfully archived: $movedCount issues" -ForegroundColor Cyan

    if ($errorCount -gt 0) {
        Write-Host "Errors: $errorCount issues" -ForegroundColor Red
    }

    # Show remaining count in done folder
    $remainingCount = (Get-ChildItem -Path $DoneFolder -Filter "*.md" -File -ErrorAction SilentlyContinue).Count
    Write-Host "Remaining in done/: $remainingCount issues" -ForegroundColor Gray

    if ($remainingCount -gt 25) {
        Write-Host "`n💡 Tip: done/ folder still has $remainingCount items (target: ~20)" -ForegroundColor Yellow
        Write-Host "   Consider running with a higher threshold: -DaysOld 60" -ForegroundColor Yellow
    }
}

Write-Host "`n💡 View archived issues:" -ForegroundColor DarkGray
Write-Host "   .\scripts\done-view.ps1 -Folder issue-tracking/archive -ShowStats" -ForegroundColor DarkGray
Write-Host "   .\scripts\done-view.ps1 -IncludeArchive -ShowStats" -ForegroundColor DarkGray
