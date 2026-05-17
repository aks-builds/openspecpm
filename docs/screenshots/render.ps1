# Generate README screenshots from non-interactive CLI output.
# Re-run after CLI output changes:  pwsh docs/screenshots/render.ps1
#
# This script is self-contained: it creates sample OpenSpec changes
# (dark-mode, auth-rate-limit) before rendering flow screenshots, then
# removes them so the working tree stays clean.

Add-Type -AssemblyName System.Drawing

function New-TerminalPng {
    param(
        [Parameter(Mandatory)][string]$Command,
        [Parameter(Mandatory)][string]$Output,
        [Parameter(Mandatory)][string]$Path
    )

    $lines = @("`$ $Command", "") + ($Output -split "`r?`n")
    $lines = $lines | ForEach-Object { $_ -replace "`e\[[0-9;]*[A-Za-z]", "" }

    $font = New-Object System.Drawing.Font('Consolas', 13, [System.Drawing.FontStyle]::Regular)

    $tmp = New-Object System.Drawing.Bitmap(1, 1)
    $tmpG = [System.Drawing.Graphics]::FromImage($tmp)
    $maxWidth = 0
    foreach ($line in $lines) {
        $size = $tmpG.MeasureString($line, $font)
        if ($size.Width -gt $maxWidth) { $maxWidth = $size.Width }
    }
    $lineHeight = [int]($tmpG.MeasureString('Xy', $font).Height) + 2
    $tmp.Dispose()

    $padding = 24
    $headerH = 40
    $width = [int]($maxWidth + 2 * $padding)
    if ($width -lt 720) { $width = 720 }
    $height = [int]($lineHeight * $lines.Count + 2 * $padding + $headerH)

    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

    $g.Clear([System.Drawing.Color]::FromArgb(13, 17, 23))

    $headerBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(22, 27, 34))
    $g.FillRectangle($headerBg, 0, 0, $width, $headerH)

    $red    = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 95, 86))
    $yellow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 189, 46))
    $green  = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(39, 201, 63))
    $g.FillEllipse($red,    16, 14, 12, 12)
    $g.FillEllipse($yellow, 36, 14, 12, 12)
    $g.FillEllipse($green,  56, 14, 12, 12)

    $textBrush   = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(201, 209, 217))
    $promptBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(88, 166, 255))

    $y = $padding + $headerH
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $brush = if ($i -eq 0) { $promptBrush } else { $textBrush }
        $g.DrawString($lines[$i], $font, $brush, [single]$padding, [single]$y)
        $y += $lineHeight
    }

    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    Write-Host "  Wrote $Path  ($width x $height)"
}

function Invoke-Cli {
    param([Parameter(Mandatory)][string[]]$Args)
    (& node cli/bin/openspecpm.js @Args 2>&1) -join "`n"
}

$darkModeTasks = @'
---
schema_version: 1
items:
  - title: "Add theme toggle to header"
    sync_state: pending
    depends_on: []
    parallel: true
    effort_hours: 2
  - title: "Define CSS variables for dark palette"
    sync_state: pending
    depends_on: []
    parallel: true
    effort_hours: 3
  - title: "Persist user theme to localStorage"
    sync_state: pending
    depends_on: ["Add theme toggle to header"]
    parallel: false
    effort_hours: 2
  - title: "Honor prefers-color-scheme on first load"
    sync_state: pending
    depends_on: ["Persist user theme to localStorage"]
    parallel: false
    effort_hours: 3
---

# Tasks
'@

$rateLimitTasks = @'
---
schema_version: 1
items:
  - title: "Add token-bucket middleware"
    sync_state: pending
    depends_on: []
    parallel: true
    effort_hours: 4
  - title: "Wire middleware into /login route"
    sync_state: pending
    depends_on: ["Add token-bucket middleware"]
    parallel: false
    effort_hours: 1
  - title: "Add unit tests for rate limiter"
    sync_state: pending
    depends_on: ["Add token-bucket middleware"]
    parallel: true
    effort_hours: 3
  - title: "Add Grafana dashboard panel for 429s"
    sync_state: pending
    depends_on: ["Wire middleware into /login route"]
    parallel: false
    effort_hours: 2
---

# Tasks
'@

function Setup-Fixtures {
    Write-Host 'Setting up sample OpenSpec changes...'
    foreach ($f in @('dark-mode', 'auth-rate-limit')) {
        if (Test-Path "openspec/changes/$f") {
            Remove-Item -Recurse -Force "openspec/changes/$f"
        }
    }
    & node cli/bin/openspecpm.js propose dark-mode --offline -p 'Per-user dark theme with persistence' | Out-Null
    & node cli/bin/openspecpm.js propose auth-rate-limit --offline -p 'Per-IP rate limiting on login endpoint' | Out-Null
    # Write UTF-8 without BOM. Windows PowerShell's `Set-Content -Encoding utf8`
    # prepends a BOM, which breaks the CLI's frontmatter regex (^---\n...).
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText((Resolve-Path 'openspec/changes/dark-mode/tasks.md'),       $darkModeTasks,  $utf8NoBom)
    [System.IO.File]::WriteAllText((Resolve-Path 'openspec/changes/auth-rate-limit/tasks.md'), $rateLimitTasks, $utf8NoBom)
}

function Cleanup-Fixtures {
    Write-Host 'Cleaning up sample changes...'
    foreach ($f in @('dark-mode', 'auth-rate-limit')) {
        if (Test-Path "openspec/changes/$f") {
            Remove-Item -Recurse -Force "openspec/changes/$f"
        }
    }
    if ((Test-Path 'openspec/changes') -and -not (Get-ChildItem 'openspec/changes')) {
        Remove-Item -Recurse -Force 'openspec/changes'
    }
    if ((Test-Path 'openspec') -and -not (Get-ChildItem 'openspec')) {
        Remove-Item -Recurse -Force 'openspec'
    }
}

Set-Location (Join-Path $PSScriptRoot '..\..')
$env:NO_COLOR = '1'
$env:FORCE_COLOR = '0'

Write-Host 'Generating CLI screenshots...'

try {
    # Setup-free captures
    New-TerminalPng -Command 'openspecpm help-table' `
        -Output (Invoke-Cli 'help-table') `
        -Path  'docs/screenshots/help-table.png'

    New-TerminalPng -Command 'openspecpm doctor' `
        -Output (Invoke-Cli 'doctor') `
        -Path  'docs/screenshots/doctor.png'

    # Populate sample state, then capture flow commands
    Setup-Fixtures

    New-TerminalPng -Command 'openspecpm status' `
        -Output (Invoke-Cli 'status') `
        -Path  'docs/screenshots/status.png'

    New-TerminalPng -Command 'openspecpm next -l 5' `
        -Output (Invoke-Cli 'next', '-l', '5') `
        -Path  'docs/screenshots/next.png'

    New-TerminalPng -Command 'openspecpm blocked' `
        -Output (Invoke-Cli 'blocked') `
        -Path  'docs/screenshots/blocked.png'

    New-TerminalPng -Command 'openspecpm validate' `
        -Output (Invoke-Cli 'validate') `
        -Path  'docs/screenshots/validate.png'
}
finally {
    Cleanup-Fixtures
}

Write-Host 'Done.'
