# Generate README screenshots from non-interactive CLI output.
# Re-run after CLI output changes:  pwsh docs/screenshots/render.ps1

Add-Type -AssemblyName System.Drawing

function New-TerminalPng {
    param(
        [Parameter(Mandatory)][string]$Command,
        [Parameter(Mandatory)][string]$Output,
        [Parameter(Mandatory)][string]$Path
    )

    $lines = @("`$ $Command", "") + ($Output -split "`r?`n")
    # Strip stray ANSI escapes if the CLI emitted any.
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

    $bg = [System.Drawing.Color]::FromArgb(13, 17, 23)
    $g.Clear($bg)

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

Set-Location (Join-Path $PSScriptRoot '..\..')
Write-Host 'Generating CLI screenshots...'

$env:NO_COLOR = '1'
$env:FORCE_COLOR = '0'

$out = (& node cli/bin/openspecpm.js help-table 2>&1) -join "`n"
New-TerminalPng -Command 'openspecpm help-table' -Output $out -Path 'docs/screenshots/help-table.png'

$out = (& node cli/bin/openspecpm.js doctor github 2>&1) -join "`n"
New-TerminalPng -Command 'openspecpm doctor github' -Output $out -Path 'docs/screenshots/doctor.png'

$out = (& node cli/bin/openspecpm.js status 2>&1) -join "`n"
New-TerminalPng -Command 'openspecpm status' -Output $out -Path 'docs/screenshots/status.png'

Write-Host 'Done.'
