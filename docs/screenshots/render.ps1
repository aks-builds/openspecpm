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

    # Capture propose + decompose against a one-shot dark-mode scratch.
    # Setup-Fixtures below re-creates dark-mode with its own tasks fixture.
    if (Test-Path 'openspec/changes/dark-mode') {
        Remove-Item -Recurse -Force 'openspec/changes/dark-mode'
    }
    # Strip the absolute cwd prefix so the BDD lint line fits a normal screenshot width.
    $proposeOut = (Invoke-Cli 'propose', 'dark-mode', '--offline') -replace [regex]::Escape((Get-Location).Path + '\'), ''
    New-TerminalPng -Command 'openspecpm propose dark-mode --offline' `
        -Output $proposeOut `
        -Path  'docs/screenshots/propose.png'

    # Curated synthetic output for the LLM judge. The real `propose --llm` makes a
    # network call to api.anthropic.com (Claude Haiku 4.5) and requires
    # ANTHROPIC_API_KEY, so it can't be captured deterministically alongside the
    # other commands here. This canned example shows the three new rule ids
    # (bdd/llm-contradiction, bdd/llm-missing-coverage, bdd/llm-vague-then)
    # merged with heuristic findings, in the same format the real run produces.
    # Use [char] codes for the linter sigils so the .ps1 source is encoding-safe.
    $warn = [char]0x26A0
    $err  = [char]0x2716
    $hell = [char]0x2026
    $judgeOut = @"
Proposal created at openspec\changes\dark-mode.

BDD lint (soft): 2 errors, 3 warnings
  $warn openspec\changes\dark-mode\specs\main.md:8 [bdd/non-observable-then] Then `"the change feels right`" lacks an observable verb. Consider: displays, shows, returns, stores, persists, rejects, $hell
  $err openspec\changes\dark-mode\specs\main.md:18 [bdd/llm-contradiction] `"User selects Dark in menu`" claims the system theme overrides the user choice, but scenario `"User opens app at night`" in night-mode.md:12 claims the user choice overrides the system theme. Specs disagree on precedence.
  $err openspec\changes\dark-mode\specs\persistence.md:7 [bdd/llm-missing-coverage] Success criterion `"Honor prefers-color-scheme on first load`" has no scenario in specs/. Add one before sync.
  $warn openspec\changes\dark-mode\specs\main.md:24 [bdd/llm-vague-then] Then `"the user is happy`" -- what does happy look like to a tester? Restate as an observable outcome (toast text, ARIA announcement, persisted state, etc.).
  $warn openspec\changes\dark-mode\specs\main.md:30 [bdd/weak-when] When `"is happening`" should start with an action verb (clicks, submits, requests, $hell), not a state verb.
These will block ``sync`` unless you pass --force. Refine scenarios before pushing.
Next: review proposal.md + specs/, then run ``openspecpm sync dark-mode``.
"@
    New-TerminalPng -Command 'openspecpm propose dark-mode --llm' `
        -Output $judgeOut `
        -Path  'docs/screenshots/judge.png'

    $decomposeOut = (Invoke-Cli 'decompose', 'dark-mode', '--force') -replace [regex]::Escape((Get-Location).Path + '\'), ''
    New-TerminalPng -Command 'openspecpm decompose dark-mode --force' `
        -Output $decomposeOut `
        -Path  'docs/screenshots/decompose.png'

    if (Test-Path 'openspec/changes/dark-mode') {
        Remove-Item -Recurse -Force 'openspec/changes/dark-mode'
    }

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

    New-TerminalPng -Command 'openspecpm fan-out dark-mode -l 1' `
        -Output (Invoke-Cli 'fan-out', 'dark-mode', '-l', '1') `
        -Path  'docs/screenshots/fan-out.png'

    New-TerminalPng -Command 'openspecpm search theme' `
        -Output (Invoke-Cli 'search', 'theme') `
        -Path  'docs/screenshots/search.png'

    New-TerminalPng -Command 'openspecpm validate' `
        -Output (Invoke-Cli 'validate') `
        -Path  'docs/screenshots/validate.png'
}
finally {
    Cleanup-Fixtures
}

Write-Host 'Done.'
