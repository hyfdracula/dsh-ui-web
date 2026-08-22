# One-click re-apply of the DSH fork patches after an upstream upgrade.
# Replays the page-layer fork changes (see FORK-CHANGES.md) onto the current
# checkout. Idempotent-ish: `git apply` reports "already applied" or a clean
# apply; launch scripts are copied verbatim (they are untracked upstream).
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File apply-fork-patches.ps1 [-ReposRoot ...] [-SkipBuild]
#
# After a successful apply, rebuild the affected package + restart the web
# service (steps 2/4 of FORK-CHANGES.md) — set -SkipBuild to skip the heavy
# rebuild when you plan to run it yourself.

param(
  [string]$ReposRoot = 'C:\Users\19161\deepseek-harness',
  [string]$PatchDir  = (Join-Path $PSScriptRoot '.'),
  [switch]$SkipBuild,
  [switch]$SkipRestart
)

$ErrorActionPreference = 'Continue'
function Log($m) { Write-Host ("[{0:HH:mm:ss}] {1}" -f (Get-Date), $m) }

Log "=== DSH fork patch re-apply ==="
Log "repos root : $ReposRoot"
Log "patch dir  : $PatchDir"

if (-not (Test-Path (Join-Path $ReposRoot '.git'))) {
  Write-Error "Not a git checkout: $ReposRoot"; exit 2
}

# --- 1. Apply source patch(es) with 3-way merge -----------------------------
$applied = 0
$skipped = 0
Get-ChildItem (Join-Path $PatchDir '*.patch') -ErrorAction SilentlyContinue | Sort-Object Name | ForEach-Object {
  $patch = $_.FullName
  Log ("applying: {0}" -f $_.Name)
  Push-Location $ReposRoot
  try {
    $out = git apply --3way $patch 2>&1
    $code = $LASTEXITCODE
    if ($code -eq 0) {
      $applied++
      Log "  + applied cleanly"
    } elseif (($out -join ' ') -match 'already exists in working directory|input differs|patch does not apply|does not match') {
      # Could be "already applied" or a genuine reject; surface the details.
      Log "  ~ not a clean apply (see messages):"
      $out | ForEach-Object { Log "      $_" }
      # Try reject files so the user can hand-merge.
      git apply --reject $patch 2>&1 | ForEach-Object { Log "      $_" }
      $skipped++
    } else {
      Log "  ~ applied partially (or conflict markers):"
      $out | ForEach-Object { Log "      $_" }
      $skipped++
    }
  } finally {
    Pop-Location
  }
}
Log "patches applied=$applied skipped/conflict=$skipped"

# --- 2. Copy launch scripts (untracked upstream, safe to copy) ---------------
$launchFiles = @(
  'start-dsh-web.cmd','dsh-web-launch.ps1','dsh-web-launch.vbs',
  'dsh-web-launch.vbs.bak','native-drag-bridge-launch.vbs','dsh-web-restart.ps1','restart-dsh-web.ps1'
)
foreach ($f in $launchFiles) {
  $src = Join-Path $PatchDir $f
  if (-not (Test-Path $src)) { continue }
  Copy-Item -Force $src (Join-Path $ReposRoot $f)
  Log "launch script: $f"
}

# --- 3. Optional: rebuild + restart ------------------------------------------
if (-not $SkipBuild) {
  Log "rebuilding ui-settings-general..."
  Push-Location $ReposRoot
  try {
    & npx tsdown -C packages/client/ui-settings-general 2>&1 | Select-Object -Last 3 | ForEach-Object { Log "  $_" }
    Log "note: a full 'npm run build' is the safe path for the whole client chain."
  } finally { Pop-Location }
}
if (-not $SkipRestart) {
  $restart = Join-Path $ReposRoot 'dsh-web-restart.ps1'
  if (Test-Path $restart) {
    Log "restarting DSH web..."
    & powershell -NoProfile -ExecutionPolicy Bypass -File $restart
  }
}

Log "=== DSH fork patch re-apply done ==="
exit 0
