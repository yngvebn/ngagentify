# Backlog View Script
# Parses YAML frontmatter from issue files and displays prioritized view

param(
    [string]$Folder = "issue-tracking/backlog",
    [string]$SortBy = "priority",  # priority, effort, updated, created
    [string]$FilterType = "",      # bug, feature, refactor, explore
    [string]$FilterPriority = "",  # high, medium, low
    [string]$FilterRiskImpact = "",  # high, medium, low
    [string]$FilterRiskCategory = "",  # security, data-loss, performance, etc.
    [switch]$ShowStats
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

function Get-PriorityWeight {
    param([string]$Priority)
    switch ($Priority) {
        'high' { return 3 }
        'medium' { return 2 }
        'low' { return 1 }
        default { return 0 }
    }
}

function Get-EffortHours {
    param([string]$Effort)
    if ($Effort -match '(\d+)h') { return [int]$Matches[1] }
    if ($Effort -match '(\d+)d') { return [int]$Matches[1] * 8 }
    if ($Effort -match '(\d+)w') { return [int]$Matches[1] * 40 }
    return 0
}

# Get all issue files
$issueFiles = Get-ChildItem -Path $Folder -Filter "*.md" -File

if ($issueFiles.Count -eq 0) {
    Write-Host "No issues found in $Folder" -ForegroundColor Yellow
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

if ($FilterPriority) {
    $issues = $issues | Where-Object { $_.priority -eq $FilterPriority }
}

if ($FilterRiskImpact) {
    $issues = $issues | Where-Object { $_.risk_impact -eq $FilterRiskImpact }
}

if ($FilterRiskCategory) {
    $issues = $issues | Where-Object {
        $_.risk_category -and ($_.risk_category -contains $FilterRiskCategory)
    }
}

# Sort issues
switch ($SortBy) {
    'priority' {
        $issues = $issues | Sort-Object { Get-PriorityWeight $_.priority }, updated -Descending
    }
    'effort' {
        $issues = $issues | Sort-Object { Get-EffortHours $_.effort }
    }
    'updated' {
        $issues = $issues | Sort-Object updated -Descending
    }
    'created' {
        $issues = $issues | Sort-Object created -Descending
    }
}

# Display stats if requested
if ($ShowStats) {
    $totalIssues = $issues.Count
    $byType = $issues | Group-Object type | ForEach-Object { "{0}: {1}" -f $_.Name, $_.Count }
    $byPriority = $issues | Group-Object priority | ForEach-Object { "{0}: {1}" -f $_.Name, $_.Count }
    $byRiskImpact = $issues | Where-Object { $_.risk_impact -and $_.risk_impact -ne 'null' } | Group-Object risk_impact | ForEach-Object { "{0}: {1}" -f $_.Name, $_.Count }
    $totalEffort = ($issues | ForEach-Object { Get-EffortHours $_.effort } | Measure-Object -Sum).Sum
    $highRiskCount = ($issues | Where-Object { $_.risk_impact -eq 'high' }).Count

    Write-Host "`n📊 Backlog Statistics" -ForegroundColor Cyan
    Write-Host ("=" * 50)
    Write-Host "Total Issues: $totalIssues"
    Write-Host "Total Effort: $totalEffort hours (~$([math]::Round($totalEffort/8, 1)) days)"
    Write-Host "`nBy Type:"
    $byType | ForEach-Object { Write-Host "  $_" }
    Write-Host "`nBy Priority:"
    $byPriority | ForEach-Object { Write-Host "  $_" }
    if ($byRiskImpact.Count -gt 0) {
        Write-Host "`nBy Risk Impact:"
        $byRiskImpact | ForEach-Object { Write-Host "  $_" }
        if ($highRiskCount -gt 0) {
            Write-Host "`n⚠️  $highRiskCount high-risk issue(s) - require pre-launch validation" -ForegroundColor Yellow
        }
    }
    Write-Host ("=" * 50)
}

# Display issues
Write-Host "`n📋 Backlog Issues (sorted by $SortBy)" -ForegroundColor Cyan
Write-Host ("=" * 80)

$priorityColors = @{
    'high' = 'Red'
    'medium' = 'Yellow'
    'low' = 'Gray'
}

foreach ($issue in $issues) {
    $priorityColor = $priorityColors[$issue.priority]
    $typeIcon = switch ($issue.type) {
        'bug' { '🐛' }
        'feature' { '✨' }
        'refactor' { '♻️' }
        'explore' { '🔍' }
        default { '📝' }
    }

    Write-Host "`n$typeIcon " -NoNewline
    Write-Host "$($issue.id)" -ForegroundColor White -NoNewline
    Write-Host " [$($issue.priority)]" -ForegroundColor $priorityColor -NoNewline
    Write-Host " [$($issue.effort)]" -ForegroundColor Cyan

    if ($issue.labels -and $issue.labels.Count -gt 0) {
        Write-Host "   Labels: $($issue.labels -join ', ')" -ForegroundColor DarkGray
    }

    # Display risk information
    if ($issue.risk_impact -and $issue.risk_impact -ne 'null') {
        $riskColor = switch ($issue.risk_impact) {
            'high' { 'Red' }
            'medium' { 'Yellow' }
            'low' { 'Green' }
            default { 'Gray' }
        }
        Write-Host "   Risk: " -NoNewline -ForegroundColor DarkGray
        Write-Host "$($issue.risk_impact)" -NoNewline -ForegroundColor $riskColor

        if ($issue.risk_category -and $issue.risk_category.Count -gt 0 -and $issue.risk_category[0] -ne '') {
            Write-Host " [$($issue.risk_category -join ', ')]" -ForegroundColor DarkGray
        } else {
            Write-Host ""
        }
    }

    if ($issue.depends_on -and $issue.depends_on.Count -gt 0 -and $issue.depends_on[0] -ne '') {
        Write-Host "   Depends on: $($issue.depends_on -join ', ')" -ForegroundColor DarkYellow
    }

    Write-Host "   Updated: $($issue.updated)" -ForegroundColor DarkGray
}

Write-Host "`n" ("=" * 80)
Write-Host "Total: $($issues.Count) issues" -ForegroundColor Cyan
