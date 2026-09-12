# One-click replay of the DSH fork adaptation set onto the 0.1.5 checkout.
#
# WHAT THIS IS
#   dsh-fork-adapt/ is the local patch set for the DSH fork checkout
#   C:\Users\19161\deepseek-harness-next (branch fork/0.1.5-rc.2). There is ONE
#   patch per fork commit and they are CUMULATIVE: apply them in numeric order.
#
#     patch                                      fork commit  feature
#     010-fork-f1-f4-client-features.patch       20faee2      F1 F2 F3 F4
#     020-fork-f9-web-restart-launchers.patch    90fef94      F9
#     030-fork-f7-glm-normalizer.patch           c41e032      F7
#     040-fork-f6-turn-recovery.patch            8016f4f      F6
#
#   Upstream base the four commits sit on: fb2c4b9e698e30edb738bca4cf0618587db7d203
#   (tag dsh-v0.1.5-rc.2, merge of PR #3978). See FORK-CHANGES.md for the feature
#   list and archive-0.1.1/README.md for the retired 0.1.1 patch set -- those files
#   cannot apply to 0.1.5 and this script never reads them.
#
# USAGE
#   powershell -NoProfile -ExecutionPolicy Bypass -File apply-fork-patches.ps1 `
#     [-ReposRoot <checkout>] [-PatchDir <dir>] [-BaseCommit <sha>] `
#     [-Check] [-VerifyTree] [-Build] [-Restart]
#
# MODES
#   default      apply for real; per patch: strict, then --ignore-whitespace,
#                then --3way. Nothing is copied by hand: the launchers F9 needs
#                (dsh-web-host-launch.ps1, dsh-web-service-launch.vbs, ...) live
#                inside patch 020.
#   -Check       dry run. Stages every patch through a throwaway GIT_INDEX_FILE
#                (git read-tree HEAD + git apply --cached), so the whole
#                sequential ladder is validated without touching the working
#                tree, the real index or the working HEAD commit.
#   -VerifyTree  after each patch run `git add -A` + `git write-tree` and require
#                the result to equal that fork commit's tree, i.e. the replay
#                reproduces the fork checkout byte for byte. Needs a clean tree.
#   -Build       run `pnpm run build:lib` (host + client faces) afterwards.
#   -Restart     run <checkout>\dsh-web-restart.ps1 afterwards.
#
# EXIT CODES
#   0  applied, or already integrated, or dry run passed
#   1  dry run: at least one patch would not apply
#   2  precondition failure (checkout, base commit, patch files, line endings)
#   3  git apply failed
#   4  tree verification failed
#
# LINE ENDINGS (blocker F12)
#   Every patch must be LF. The checkout enforces `* text=auto eol=lf`, and a
#   context line carrying a trailing CR never matches it, so a CRLF patch fails
#   even against its own baseline. This script refuses to run on a patch that
#   contains 0x0D (or a UTF-8 BOM) instead of silently "fixing" it; regenerate
#   with regenerate-fork-patches.ps1, which lets git itself write the file
#   (git diff --output) and re-checks the bytes.

param(
  [string]$ReposRoot  = 'C:\Users\19161\deepseek-harness-next',
  [string]$PatchDir   = $PSScriptRoot,
  [string]$BaseCommit = 'fb2c4b9e698e30edb738bca4cf0618587db7d203',
  [switch]$Check,
  [switch]$VerifyTree,
  [switch]$Build,
  [switch]$Restart
)

# Control flow uses explicit $LASTEXITCODE checks, NOT stderr-as-error: native git
# commands write to stderr even on success, and with EAP=Stop that becomes a
# terminating NativeCommandError.
$ErrorActionPreference = 'Continue'
if (Test-Path variable:PSNativeCommandUseErrorActionPreference) {
  $PSNativeCommandUseErrorActionPreference = $false
}

function Log($m) { Write-Host ("[{0:HH:mm:ss}] {1}" -f (Get-Date), $m) }
function Fail([int]$code, $message) {
  Write-Host ""
  Write-Host "FAILED: $message" -ForegroundColor Red
  exit $code
}

function Invoke-Git {
  param([string]$WorkDir, [string[]]$Arguments)
  $lines = & git -C $WorkDir @Arguments 2>&1
  return [pscustomobject]@{ Code = $LASTEXITCODE; Lines = @($lines | ForEach-Object { [string]$_ }) }
}
function Show-Lines($lines, [string]$indent) {
  foreach ($l in $lines) { Log ("{0}{1}" -f $indent, $l) }
}

# --- The adaptation set ------------------------------------------------------
# One entry per fork commit, in apply order. Tree = git rev-parse <commit>^{tree}.
$patches = @(
  [pscustomobject]@{
    Name = '010-fork-f1-f4-client-features.patch'
    From = 'fb2c4b9e698e30edb738bca4cf0618587db7d203'
    To   = '20faee250e8ab7b3d3a47a018870a431ef60ee45'
    Tree = '9d2153dfadf71b58d63a8e9aaf1bcf2c5d3ad010'
    What = 'F1 settings two-phase close + aqua anchor, F2 model menu without reasoning effort, F3 bare-path links, F4 session-list loading state'
  }
  [pscustomobject]@{
    Name = '020-fork-f9-web-restart-launchers.patch'
    From = '20faee250e8ab7b3d3a47a018870a431ef60ee45'
    To   = '90fef94712d1c397d12bb03d467ca11d01a9637e'
    Tree = '02c909b962c967ed722f079bbde9869fc184f7c2'
    What = 'F9 /restart host command, restart worker and the local Windows service launchers'
  }
  [pscustomobject]@{
    Name = '030-fork-f7-glm-normalizer.patch'
    From = '90fef94712d1c397d12bb03d467ca11d01a9637e'
    To   = 'c41e032013aa9d841469ad7bea8a5d1c27e4cf2e'
    Tree = '2a6ef84af4924014fc6d2e3d754d2a5d618f8d0d'
    What = 'F7 GLM stream-normalizer package plus the llm-pi-ai seam'
  }
  [pscustomobject]@{
    Name = '040-fork-f6-turn-recovery.patch'
    From = 'c41e032013aa9d841469ad7bea8a5d1c27e4cf2e'
    To   = '8016f4fdc2bbb4b537d293f43cf2e85a481a9302'
    Tree = '07b6d638e32489299a18ef9a1697b811f7c29a07'
    What = 'F6 interrupted-turn recovery panel (ui-turn-recovery) wired into the web-app bundle'
  }
)
$tipCommit = $patches[-1].To

Log "=== DSH fork patch replay (0.1.5) ==="
Log "checkout   : $ReposRoot"
Log "patch dir  : $PatchDir"
Log "base commit: $BaseCommit"
if ($Check) { Log "mode       : dry run (-Check)" }
elseif ($VerifyTree) { Log "mode       : apply + tree verification" }
else { Log "mode       : apply" }

# --- 0. Preconditions: the checkout must be the 0.1.5 one --------------------
if (-not (Test-Path -LiteralPath $ReposRoot)) {
  Fail 2 "checkout not found: $ReposRoot. This adaptation set targets the 0.1.5 fork checkout (default C:\Users\19161\deepseek-harness-next); pass -ReposRoot <path> if it lives elsewhere."
}
$rootFull = [IO.Path]::GetFullPath($ReposRoot)
$top = Invoke-Git $rootFull @('rev-parse', '--show-toplevel')
if ($top.Code -ne 0) {
  Fail 2 "$rootFull is not a git work tree. git rev-parse --show-toplevel failed: $($top.Lines -join ' | ')"
}
$topFull = [IO.Path]::GetFullPath($top.Lines[0].Trim())
if (-not $topFull.Equals($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
  Fail 2 "checkout mismatch: -ReposRoot is $rootFull but git reports the work tree root as $topFull. Refusing to patch a different checkout."
}
$head = Invoke-Git $rootFull @('rev-parse', 'HEAD')
$hasBase = Invoke-Git $rootFull @('cat-file', '-e', "$BaseCommit^{commit}")
if ($hasBase.Code -ne 0) {
  Fail 2 "base commit $BaseCommit (upstream 0.1.5-rc.2) is missing from $rootFull. Wrong checkout, a shallow clone, or a rewritten history -- this patch set cannot be validated there."
}
$baseIsAncestor = Invoke-Git $rootFull @('merge-base', '--is-ancestor', $BaseCommit, 'HEAD')
if ($baseIsAncestor.Code -ne 0) {
  Fail 2 "base commit $BaseCommit is NOT an ancestor of HEAD=$($head.Lines[0]) in $rootFull. This is not a 0.1.5-rc.2 descendant, or the checkout predates the release this set was generated against."
}
if ($head.Lines[0] -ne $BaseCommit) {
  Log "note: HEAD differs from the base commit; the --3way fallback may engage."
}
Log "checkout OK (HEAD $($head.Lines[0].Substring(0,12)), base reachable)"

# --- 1. Patch files: presence, LF, no BOM ------------------------------------
if (-not (Test-Path -LiteralPath $PatchDir)) { Fail 2 "patch dir not found: $PatchDir" }
$missing = @($patches | Where-Object { -not (Test-Path -LiteralPath (Join-Path $PatchDir $_.Name)) })
if ($missing.Count -gt 0) {
  $missingNames = ($missing | ForEach-Object { $_.Name }) -join ', '
  Fail 2 "missing patch file(s): $missingNames. If you only have the 0.1.1 files (010-settings-root-two-phase-close.patch ... 080-ui-workspace-loading-state.patch), they are retired: they cannot apply to 0.1.5 and are archived under archive-0.1.1/."
}
foreach ($p in $patches) {
  $path = Join-Path $PatchDir $p.Name
  $bytes = [IO.File]::ReadAllBytes($path)
  if ($bytes.Length -eq 0) { Fail 2 "empty patch file: $path" }
  $cr = 0; foreach ($b in $bytes) { if ($b -eq 0x0D) { $cr++ } }
  if ($cr -gt 0) {
    Fail 2 "$($p.Name) contains $cr CR byte(s) (0x0D). A CRLF patch never applies to this LF checkout (blocker F12). Re-run regenerate-fork-patches.ps1, which writes the patch through git diff --output."
  }
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    Fail 2 "$($p.Name) starts with a UTF-8 BOM; regenerate it with regenerate-fork-patches.ps1."
  }
}
Log "patch files OK ($($patches.Count) files, LF, no BOM)"

# --- 2. Already integrated? --------------------------------------------------
$tipReachable = Invoke-Git $rootFull @('merge-base', '--is-ancestor', $tipCommit, 'HEAD')
if ($tipReachable.Code -eq 0) {
  Log "all four fork commits are already in HEAD history -- nothing to apply."
  Write-Host ""
  Write-Host "Result: already integrated (no changes made)." -ForegroundColor Green
  exit 0
}

# --- 3. Dirty-tree warning ---------------------------------------------------
$status = Invoke-Git $rootFull @('status', '--porcelain')
$dirty = @($status.Lines | Where-Object { $_ -ne '' })
if ($dirty.Count -gt 0) {
  if ($VerifyTree) {
    Fail 2 ("-VerifyTree needs a clean working tree: git status --porcelain lists {0} path(s), and git add -A would fold them into the compared tree. Stash or commit them first." -f $dirty.Count)
  }
  if (-not $Check) {
    Log "WARNING: working tree is not clean ($($dirty.Count) path(s)); the replay may conflict with local edits."
  }
}

# --- 4. Dry run through a throwaway index ------------------------------------
if ($Check) {
  $savedIndex = $env:GIT_INDEX_FILE
  $tempIndex = Join-Path ([IO.Path]::GetTempPath()) ("dsh-fork-applycheck-{0}.index" -f ([guid]::NewGuid().ToString('N')))
  $failures = 0
  try {
    $env:GIT_INDEX_FILE = $tempIndex
    $read = Invoke-Git $rootFull @('read-tree', 'HEAD')
    if ($read.Code -ne 0) { Show-Lines $read.Lines '      '; Fail 2 "could not seed the throwaway index (git read-tree HEAD)." }
    foreach ($p in $patches) {
      $path = Join-Path $PatchDir $p.Name
      Log ("checking: {0}" -f $p.Name)
      $mode = $null
      $advance = @()
      $lastLines = @()
      foreach ($attempt in @(
          @{ Label = 'strict';            Args = @('apply', '--cached', '--check'); Advance = @() },
          @{ Label = 'ignore-whitespace'; Args = @('apply', '--cached', '--check', '--ignore-whitespace'); Advance = @('--ignore-whitespace') },
          @{ Label = '3way';              Args = @('apply', '--cached', '--check', '--3way'); Advance = @('--3way') }
        )) {
        $r = Invoke-Git $rootFull ($attempt.Args + @($path))
        if ($r.Code -eq 0) { $mode = $attempt.Label; $advance = $attempt.Advance; break }
        $lastLines = $r.Lines
      }
      if ($null -eq $mode) {
        $failures++
        Log "  FAIL: does not apply (strict, --ignore-whitespace and --3way all failed)"
        Show-Lines $lastLines '      '
        continue
      }
      # Advance the simulated state so the next (cumulative) patch sees it.
      $r2 = Invoke-Git $rootFull (@('apply', '--cached') + $advance + @($path))
      if ($r2.Code -ne 0) {
        $failures++
        Log "  FAIL: check passed ($mode) but staging into the throwaway index failed"
        Show-Lines $r2.Lines '      '
        continue
      }
      Log "  OK: applies ($mode)"
      $statOut = Invoke-Git $rootFull @('apply', '--stat', $path)
      Show-Lines $statOut.Lines '      '
    }
  } finally {
    if ($null -eq $savedIndex) { Remove-Item Env:\GIT_INDEX_FILE -ErrorAction SilentlyContinue }
    else { $env:GIT_INDEX_FILE = $savedIndex }
    Remove-Item -LiteralPath $tempIndex -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath "$tempIndex.lock" -Force -ErrorAction SilentlyContinue
  }
  Write-Host ""
  if ($failures -gt 0) {
    Write-Host "Result: dry run FAILED for $failures of $($patches.Count) patch(es)." -ForegroundColor Red
    exit 1
  }
  Write-Host "Result: dry run passed ($($patches.Count)/$($patches.Count) patches apply in order)." -ForegroundColor Green
  exit 0
}

# --- 5. Real apply ------------------------------------------------------------
$applied = 0
foreach ($p in $patches) {
  $path = Join-Path $PatchDir $p.Name
  Log ("applying: {0}" -f $p.Name)
  Log ("  {0}" -f $p.What)
  $mode = $null
  $lastLines = @()
  foreach ($attempt in @(
      @{ Label = 'strict';            Args = @('apply') },
      @{ Label = 'ignore-whitespace'; Args = @('apply', '--ignore-whitespace') },
      @{ Label = '3way';              Args = @('apply', '--3way') }
    )) {
    $r = Invoke-Git $rootFull ($attempt.Args + @($path))
    if ($r.Code -eq 0) { $mode = $attempt.Label; break }
    $lastLines = $r.Lines
  }
  if ($null -eq $mode) {
    Log "  git apply diagnostics:"
    Show-Lines $lastLines '      '
    Fail 3 ("$($p.Name) does not apply (strict, --ignore-whitespace and --3way all failed). Upstream probably changed the same region: hand-merge with  git -C `"$rootFull`" apply --reject `"$path`" , resolve the *.rej files, then re-run this script. Do NOT apply anything from archive-0.1.1/.")
  }
  $applied++
  Log "  + applied ($mode)"

  if ($VerifyTree) {
    $add = Invoke-Git $rootFull @('add', '-A')
    if ($add.Code -ne 0) { Show-Lines $add.Lines '      '; Fail 4 "git add -A failed after $($p.Name)" }
    $wt = Invoke-Git $rootFull @('write-tree')
    if ($wt.Code -ne 0) { Show-Lines $wt.Lines '      '; Fail 4 "git write-tree failed after $($p.Name)" }
    $got = $wt.Lines[0].Trim()
    if ($got -ne $p.Tree) {
      Fail 4 ("tree mismatch after $($p.Name): got $got, expected $($p.Tree) ($($p.To.Substring(0,12))). The replay does not reproduce the fork commit.")
    }
    Log "  = tree matches $($p.To.Substring(0,12)) ($got)"
  }
}
$reset = Invoke-Git $rootFull @('reset', '-q')
if ($reset.Code -ne 0) { Log "note: git reset -q reported: $($reset.Lines -join ' | ')" }

Log "patches applied=$applied/$($patches.Count)"

# --- 6. Optional build / restart ---------------------------------------------
if ($Build) {
  Log "building the host and client libs (pnpm run build:lib)..."
  Push-Location $rootFull
  try {
    & pnpm run build:lib
    if ($LASTEXITCODE -ne 0) { Fail 3 "pnpm run build:lib failed (exit $LASTEXITCODE)." }
  } finally { Pop-Location }
}
if ($Restart) {
  $restart = Join-Path $rootFull 'dsh-web-restart.ps1'
  if (-not (Test-Path -LiteralPath $restart)) {
    Fail 2 "dsh-web-restart.ps1 is missing from $rootFull; patch 020 should have created it. Re-check the apply output."
  }
  Log "restarting DSH web..."
  & powershell -NoProfile -ExecutionPolicy Bypass -File $restart
  if ($LASTEXITCODE -ne 0) { Log "note: dsh-web-restart.ps1 exited with $LASTEXITCODE" }
}

Write-Host ""
Write-Host "Result: $applied/$($patches.Count) fork patches applied to $rootFull." -ForegroundColor Green
Write-Host "Next: pnpm run build:lib (or -Build), then restart the web host (or -Restart); see FORK-CHANGES.md."
exit 0
