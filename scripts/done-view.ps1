# Done View Script
# Analyzes completed issues from the done folder (or archive)
# Shows completion stats, time tracking, and other useful metrics

param(
    [string]$Folder = "issue-tracking/done",
    [string]$SortBy = "completed",  # completed, effort, type, duration
    [string]$FilterType = "",       # bug, feature, refactor, explore
    [int]$LastNDays = 0,           # Filter to last N days (0 = all time)
    [switch]$ShowStats,
    [switch]$GroupByType,
    [switch]$GroupByMonth,
    [switch]$IncludeArchive        # Include archived issues in analysis
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

function Get-EffortHours {
    param([string]$Effort)
    if (-not $Effort) { return 0 }
    if ($Effort -match '(\d+)h') { return [int]$Matches[1] }
    if ($Effort -match '(\d+)d') { return [int]$Matches[1] * 8 }
    if ($Effort -match '(\d+)w') { return [int]$Matches[1] * 40 }
    return 0
}

function Get-DurationDays {
    param($Started, $Completed)

    if (-not $Started -or -not $Completed) { return $null }

    try {
        $startDate = [DateTime]::Parse($Started)
        $completedDate = [DateTime]::Parse($Completed)
        return ($completedDate - $startDate).TotalDays
    }
    catch {
        return $null
    }
}

function Format-Duration {
    param([double]$Days)

    if ($Days -eq $null) { return "N/A" }
    if ($Days -lt 1) { return "<1 day" }
    if ($Days -eq 1) { return "1 day" }
    return "$([math]::Round($Days, 1)) days"
}

function Get-MonthYear {
    param([string]$DateString)

    if (-not $DateString) { return "Unknown" }

    try {
        $date = [DateTime]::Parse($DateString)
        return $date.ToString("yyyy-MM")
    }
    catch {
        return "Unknown"
    }
}

# Get all issue files
$issueFiles = @()

if ($IncludeArchive) {
    # Get files from both done and archive folders
    $issueFiles += Get-ChildItem -Path "issue-tracking/done" -Filter "*.md" -File -ErrorAction SilentlyContinue
    $issueFiles += Get-ChildItem -Path "issue-tracking/archive" -Filter "*.md" -File -ErrorAction SilentlyContinue
    $Folder = "issue-tracking/done + archive"
} else {
    $issueFiles = Get-ChildItem -Path $Folder -Filter "*.md" -File -ErrorAction SilentlyContinue
}

if ($issueFiles.Count -eq 0) {
    Write-Host "No completed issues found in $Folder" -ForegroundColor Yellow
    return
}

# Parse all frontmatter
$issues = @()
foreach ($file in $issueFiles) {
    $data = Parse-Frontmatter -FilePath $file.FullName
    if ($data) {
        $issues += $data
    }
}

# Apply filters
if ($FilterType) {
    $issues = $issues | Where-Object { $_.type -eq $FilterType }
}

# Filter by date range
if ($LastNDays -gt 0) {
    $cutoffDate = (Get-Date).AddDays(-$LastNDays)
    $issues = $issues | Where-Object {
        $_.completed -and ([DateTime]::Parse($_.completed) -ge $cutoffDate)
    }
}

# Calculate duration for each issue
$issues | ForEach-Object {
    $_['_duration_days'] = Get-DurationDays $_.started $_.completed
    $_['_effort_hours'] = Get-EffortHours $_.effort
    $_['_month_year'] = Get-MonthYear $_.completed
}

# Sort issues
switch ($SortBy) {
    'completed' {
        $issues = $issues | Sort-Object completed -Descending
    }
    'effort' {
        $issues = $issues | Sort-Object { Get-EffortHours $_.effort } -Descending
    }
    'type' {
        $issues = $issues | Sort-Object type, completed -Descending
    }
    'duration' {
        $issues = $issues | Sort-Object { $_._duration_days } -Descending
    }
}

# Display stats if requested
if ($ShowStats) {
    $totalIssues = $issues.Count
    $byType = $issues | Group-Object type | Sort-Object Count -Descending
    $byPriority = $issues | Group-Object priority | Sort-Object Count -Descending
    $totalEffort = ($issues | ForEach-Object { Get-EffortHours $_.effort } | Measure-Object -Sum).Sum

    # Calculate actual duration (for issues with both started and completed dates)
    $issuesWithDuration = $issues | Where-Object { $_._duration_days -ne $null }
    $trackedCount = $issuesWithDuration.Count
    $avgDuration = if ($trackedCount -gt 0) {
        ($issuesWithDuration | ForEach-Object { $_._duration_days } | Measure-Object -Average).Average
    } else { 0 }

    # Time range analysis
    $completedDates = $issues | Where-Object { $_.completed } | ForEach-Object { [DateTime]::Parse($_.completed) }
    $firstCompleted = if ($completedDates) { ($completedDates | Measure-Object -Minimum).Minimum } else { $null }
    $lastCompleted = if ($completedDates) { ($completedDates | Measure-Object -Maximum).Maximum } else { $null }

    Write-Host "`n✅ Completed Issues Report" -ForegroundColor Green
    Write-Host ("=" * 70)
    Write-Host "Total Completed: $totalIssues issues"

    if ($firstCompleted -and $lastCompleted) {
        Write-Host "Time Range: $($firstCompleted.ToString('yyyy-MM-dd')) to $($lastCompleted.ToString('yyyy-MM-dd'))"
        $timeSpan = ($lastCompleted - $firstCompleted).TotalDays
        Write-Host "Duration: $([math]::Round($timeSpan, 0)) days"
    }

    Write-Host "`nTotal Estimated Effort: $totalEffort hours (~$([math]::Round($totalEffort/8, 1)) days)"

    if ($trackedCount -gt 0) {
        Write-Host "Average Time to Complete: $([math]::Round($avgDuration, 1)) days ($trackedCount issues tracked)"
    }

    Write-Host "`nBy Type:"
    foreach ($group in $byType) {
        $typeEffort = ($group.Group | ForEach-Object { Get-EffortHours $_.effort } | Measure-Object -Sum).Sum
        $typeIcon = switch ($group.Name) {
            'bug' { '🐛' }
            'feature' { '✨' }
            'refactor' { '♻️' }
            'explore' { '🔍' }
            default { '📝' }
        }
        Write-Host "  $typeIcon $($group.Name): $($group.Count) ($typeEffort hours)"
    }

    Write-Host "`nBy Priority:"
    foreach ($group in $byPriority) {
        $priorityEffort = ($group.Group | ForEach-Object { Get-EffortHours $_.effort } | Measure-Object -Sum).Sum
        Write-Host "  $($group.Name): $($group.Count) ($priorityEffort hours)"
    }

    # Top labels
    $allLabels = $issues | Where-Object { $_.labels } | ForEach-Object { $_.labels } | Group-Object | Sort-Object Count -Descending | Select-Object -First 10
    if ($allLabels) {
        Write-Host "`nTop 10 Labels:"
        foreach ($label in $allLabels) {
            Write-Host "  $($label.Name): $($label.Count)"
        }
    }

    Write-Host ("=" * 70)
}

# Group by type if requested
if ($GroupByType) {
    $typeGroups = $issues | Group-Object type | Sort-Object Name

    Write-Host "`n📊 Completed Issues by Type" -ForegroundColor Cyan

    foreach ($group in $typeGroups) {
        $typeIcon = switch ($group.Name) {
            'bug' { '🐛' }
            'feature' { '✨' }
            'refactor' { '♻️' }
            'explore' { '🔍' }
            default { '📝' }
        }

        $typeEffort = ($group.Group | ForEach-Object { Get-EffortHours $_.effort } | Measure-Object -Sum).Sum

        Write-Host "`n$typeIcon $($group.Name.ToUpper()) ($($group.Count) issues, $typeEffort hours)" -ForegroundColor Yellow
        Write-Host ("─" * 70)

        foreach ($issue in $group.Group) {
            Write-Host "  $($issue.id)" -NoNewline
            if ($issue.completed) {
                Write-Host " [$($issue.completed)]" -ForegroundColor DarkGray -NoNewline
            }
            if ($issue.effort) {
                Write-Host " [$($issue.effort)]" -ForegroundColor Cyan
            } else {
                Write-Host ""
            }
        }
    }

    Write-Host ""
    return
}

# Group by month if requested
if ($GroupByMonth) {
    $monthGroups = $issues | Group-Object _month_year | Sort-Object Name -Descending

    Write-Host "`n📅 Completed Issues by Month" -ForegroundColor Cyan

    foreach ($group in $monthGroups) {
        $monthEffort = ($group.Group | ForEach-Object { Get-EffortHours $_.effort } | Measure-Object -Sum).Sum
        $monthTypes = $group.Group | Group-Object type

        Write-Host "`n📆 $($group.Name) ($($group.Count) issues, $monthEffort hours)" -ForegroundColor Yellow
        Write-Host ("─" * 70)

        # Show type breakdown for the month
        $typeBreakdown = $monthTypes | ForEach-Object {
            $icon = switch ($_.Name) {
                'bug' { '🐛' }
                'feature' { '✨' }
                'refactor' { '♻️' }
                'explore' { '🔍' }
                default { '📝' }
            }
            "$icon$($_.Name):$($_.Count)"
        }
        Write-Host "  $($typeBreakdown -join '  ')" -ForegroundColor DarkGray
        Write-Host ""

        foreach ($issue in ($group.Group | Sort-Object completed -Descending)) {
            $typeIcon = switch ($issue.type) {
                'bug' { '🐛' }
                'feature' { '✨' }
                'refactor' { '♻️' }
                'explore' { '🔍' }
                default { '📝' }
            }

            Write-Host "  $typeIcon $($issue.id)" -NoNewline
            if ($issue.completed) {
                Write-Host " [$($issue.completed)]" -ForegroundColor DarkGray -NoNewline
            }
            if ($issue.effort) {
                Write-Host " [$($issue.effort)]" -ForegroundColor Cyan -NoNewline
            }
            if ($issue._duration_days -ne $null) {
                Write-Host " [$(Format-Duration $issue._duration_days)]" -ForegroundColor Magenta
            } else {
                Write-Host ""
            }
        }
    }

    Write-Host ""
    return
}

# Display issues (standard list view)
$dateFilter = if ($LastNDays -gt 0) { " (last $LastNDays days)" } else { "" }
Write-Host "`n✅ Completed Issues (sorted by $SortBy)$dateFilter" -ForegroundColor Green
Write-Host ("=" * 80)

$typeColors = @{
    'bug' = 'Red'
    'feature' = 'Green'
    'refactor' = 'Blue'
    'explore' = 'Cyan'
}

foreach ($issue in $issues) {
    $typeColor = $typeColors[$issue.type]
    if (-not $typeColor) { $typeColor = 'White' }

    $typeIcon = switch ($issue.type) {
        'bug' { '🐛' }
        'feature' { '✨' }
        'refactor' { '♻️' }
        'explore' { '🔍' }
        default { '📝' }
    }

    Write-Host "`n$typeIcon " -NoNewline
    Write-Host "$($issue.id)" -ForegroundColor $typeColor -NoNewline

    if ($issue.effort) {
        Write-Host " [$($issue.effort)]" -ForegroundColor Cyan -NoNewline
    }

    if ($issue._duration_days -ne $null) {
        Write-Host " [$(Format-Duration $issue._duration_days)]" -ForegroundColor Magenta
    } else {
        Write-Host ""
    }

    if ($issue.completed) {
        Write-Host "   Completed: $($issue.completed)" -ForegroundColor DarkGray
    }

    if ($issue.started -and $issue.completed) {
        Write-Host "   Started: $($issue.started)" -ForegroundColor DarkGray
    }

    if ($issue.labels -and $issue.labels.Count -gt 0) {
        Write-Host "   Labels: $($issue.labels -join ', ')" -ForegroundColor DarkGray
    }
}

Write-Host "`n" ("=" * 80)
Write-Host "Total: $($issues.Count) completed issues" -ForegroundColor Green
Write-Host "`nTip: Use -ShowStats for detailed statistics" -ForegroundColor DarkGray
Write-Host "      Use -GroupByType to group by issue type" -ForegroundColor DarkGray
Write-Host "      Use -GroupByMonth to see monthly breakdown" -ForegroundColor DarkGray
Write-Host "      Use -LastNDays 30 to filter recent completions" -ForegroundColor DarkGray
Write-Host "      Use -IncludeArchive to include archived issues" -ForegroundColor DarkGray
Write-Host "      Use -Folder issue-tracking/archive to view only archived issues" -ForegroundColor DarkGray
