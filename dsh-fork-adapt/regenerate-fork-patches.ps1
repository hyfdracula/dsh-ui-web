# Regenerate the DSH fork adaptation patches from the fork checkout's commits.
#
# WHAT THIS IS
#   The 0.1.5 fork work lives as real commits on branch fork/0.1.5-rc.2 in
#   C:\Users\19161\deepseek-harness-next:
#
#     20faee2  re-port the four client-side fork features (F1 F2 F3 F4)
#     90fef94  web-restart command and the local service launchers (F9)
#     c41e032  GLM stream-normalizer seam (F7)
#     8016f4f  interrupted-turn recovery panel (F6)
#
#   This script turns exactly one commit into exactly one patch, in commit order,
#   against upstream base fb2c4b9e698e30edb738bca4cf0618587db7d203 (tag
#   dsh-v0.1.5-rc.2). It reads committed objects only -- never the working tree --
#   so a dirty or half-edited checkout cannot leak into a patch. Uncommitted local
#   edits (for example the 2026-09 launcher tweaks in the 0.1.5 checkout) are NOT
#   captured; commit them first if they belong in the set.
#
# USAGE
#   powershell -NoProfile -ExecutionPolicy Bypass -File regenerate-fork-patches.ps1 `
#     [-ReposRoot <checkout>] [-PatchDir <dir>] [-BaseCommit <sha>] `
#     [-Verify] [-VerifyWorktree <path>] [-KeepWorktree]
#
# GUARANTEES ENFORCED (each one aborts with exit code 2)
#   - the checkout is a git work tree, its toplevel equals -ReposRoot, and the
#     base commit exists and is reachable from HEAD;
#   - the four commits exist and form the exact chain base -> 20faee2 -> 90fef94
#     -> c41e032 -> 8016f4f (parents are verified, not assumed);
#   - patches are written by git itself (`git diff --binary --full-index
#     --no-color --output=<file>`), which is LF and BOM-free by construction, and
#     every written file is then re-measured byte-wise: 0x0D count must be 0
#     (blocker F12: a CRLF patch never applies to a `* text=auto eol=lf` tree).
#     If a CR ever shows up the file is rewritten byte-wise as LF, loudly.
#   - the expected tree of each commit is printed and cross-checked against the
#     table inside apply-fork-patches.ps1 (drift is reported as a warning).
#
# -Verify additionally creates a THROWAWAY git worktree of the checkout at the
# base commit, runs apply-fork-patches.ps1 against it with -VerifyTree (real
# apply + `git write-tree` equality per commit), and removes the worktree again
# unless -KeepWorktree is given. Do NOT run `pnpm install` inside that worktree:
# installing node_modules creates paths beyond MAX_PATH, and with Windows
# LongPathsEnabled=0 neither `git worktree remove` nor PowerShell can delete them
# (finish with `cmd /c rd /s /q <worktree>`, which handles it without following
# reparse points).
#
# EXIT CODES
#   0 ok, 1 verification failed, 2 precondition/guard failure

param(
  [string]$ReposRoot      = 'C:\Users\19161\deepseek-harness-next',
  [string]$PatchDir       = $PSScriptRoot,
  [string]$BaseCommit     = 'fb2c4b9e698e30edb738bca4cf0618587db7d203',
  [string]$VerifyWorktree = (Join-Path $env:TEMP 'dsh-fork-patchcheck-015'),
  [switch]$Verify,
  [switch]$KeepWorktree
)

# Native git writes to stderr even on success; decide on $LASTEXITCODE instead of
# turning stderr into a terminating error.
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
function Measure-Bytes([string]$Path) {
  $bytes = [IO.File]::ReadAllBytes($Path)
  $cr = 0; foreach ($b in $bytes) { if ($b -eq 0x0D) { $cr++ } }
  $lf = 0; foreach ($b in $bytes) { if ($b -eq 0x0A) { $lf++ } }
  return [pscustomobject]@{
    Bytes = $bytes.Length
    CR    = $cr
    LF    = $lf
    BOM   = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
  }
}

# --- The fork commit chain, in patch order -----------------------------------
$chain = @(
  [pscustomobject]@{
    Name    = '010-fork-f1-f4-client-features.patch'
    Commit  = '20faee250e8ab7b3d3a47a018870a431ef60ee45'
    Feature = 'F1 settings two-phase close + aqua anchor, F2 model select without reasoning effort, F3 bare-path links, F4 workspace session-list loading state'
  }
  [pscustomobject]@{
    Name    = '020-fork-f9-web-restart-launchers.patch'
    Commit  = '90fef94712d1c397d12bb03d467ca11d01a9637e'
    Feature = 'F9 /restart host command + restart worker + local Windows service launchers'
  }
  [pscustomobject]@{
    Name    = '030-fork-f7-glm-normalizer.patch'
    Commit  = 'c41e032013aa9d841469ad7bea8a5d1c27e4cf2e'
    Feature = 'F7 llm-glm-normalize package + llm-pi-ai stream-normalizer seam'
  }
  [pscustomobject]@{
    Name    = '040-fork-f6-turn-recovery.patch'
    Commit  = '8016f4fdc2bbb4b537d293f43cf2e85a481a9302'
    Feature = 'F6 ui-turn-recovery panel wired into the web-app bundle'
  }
  [pscustomobject]@{
    Name    = '050-fork-desktop-entry-and-telemetry.patch'
    Commit  = '0e0f0673ca6cc8c3144a94d7391258757ab4c3fb'
    Feature = 'desktop entry point (dsh-web-open.ps1/.vbs), DSH_TELEMETRY_DISABLED opt-out and the service-config host key'
  }
  [pscustomobject]@{
    Name    = '060-fork-aggregate-refs-and-spec-fixture.patch'
    Commit  = 'ecccb300f1e092d6950ddc79a7f2996e2743b9f9'
    Feature = 'host/client aggregate references for the two fork packages + the pi-ai Usage.cost spec fixture'
  }
)

Log "=== regenerate DSH fork patches (0.1.5) ==="
Log "checkout   : $ReposRoot"
Log "patch dir  : $PatchDir"
Log "base commit: $BaseCommit"

# --- 0. Preconditions --------------------------------------------------------
if (-not (Test-Path -LiteralPath $ReposRoot)) {
  Fail 2 "checkout not found: $ReposRoot. This script targets the 0.1.5 fork checkout C:\Users\19161\deepseek-harness-next; pass -ReposRoot <path> if it moved."
}
$rootFull = [IO.Path]::GetFullPath($ReposRoot)
$top = Invoke-Git $rootFull @('rev-parse', '--show-toplevel')
if ($top.Code -ne 0) {
  Fail 2 "$rootFull is not a git work tree. git rev-parse --show-toplevel failed: $($top.Lines -join ' | ')"
}
$topFull = [IO.Path]::GetFullPath($top.Lines[0].Trim())
if (-not $topFull.Equals($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
  Fail 2 "checkout mismatch: -ReposRoot is $rootFull but git reports the work tree root as $topFull."
}
if (-not (Test-Path -LiteralPath $PatchDir)) { Fail 2 "patch dir not found: $PatchDir" }

$hasBase = Invoke-Git $rootFull @('cat-file', '-e', "$BaseCommit^{commit}")
if ($hasBase.Code -ne 0) {
  Fail 2 "base commit $BaseCommit (upstream 0.1.5-rc.2) is missing from $rootFull; wrong checkout, shallow clone or rewritten history."
}
$baseIsAncestor = Invoke-Git $rootFull @('merge-base', '--is-ancestor', $BaseCommit, 'HEAD')
if ($baseIsAncestor.Code -ne 0) {
  $headNow = Invoke-Git $rootFull @('rev-parse', 'HEAD')
  Fail 2 "base commit $BaseCommit is NOT an ancestor of HEAD=$($headNow.Lines[0]); this is not a 0.1.5-rc.2 descendant."
}
$headHash = (Invoke-Git $rootFull @('rev-parse', 'HEAD')).Lines[0].Trim()
$branchName = (Invoke-Git $rootFull @('rev-parse', '--abbrev-ref', 'HEAD')).Lines[0].Trim()
Log "checkout OK (branch $branchName, HEAD $($headHash.Substring(0,12)))"

# The chain must be exactly base -> commit1 -> commit2 -> commit3 -> commit4.
$expectedParent = $BaseCommit
foreach ($c in $chain) {
  $resolved = Invoke-Git $rootFull @('rev-parse', "$($c.Commit)^{commit}")
  if ($resolved.Code -ne 0) {
    Fail 2 "fork commit $($c.Commit) ($($c.Name)) is missing from $rootFull; the branch fork/0.1.5-rc.2 was rewritten or the objects were pruned."
  }
  $actualParent = (Invoke-Git $rootFull @('rev-parse', "$($c.Commit)^")).Lines[0].Trim()
  if ($actualParent -ne $expectedParent) {
    Fail 2 "commit chain broken at $($c.Commit): its parent is $actualParent, expected $expectedParent. Patches are only meaningful while the four commits sit directly on $BaseCommit."
  }
  $expectedParent = (Invoke-Git $rootFull @('rev-parse', "$($c.Commit)^{commit}")).Lines[0].Trim()
}
Log "commit chain OK: base -> $((($chain | ForEach-Object { $_.Commit.Substring(0,7) }) -join ' -> '))"

$tipReachable = Invoke-Git $rootFull @('merge-base', '--is-ancestor', $chain[-1].Commit, 'HEAD')
if ($tipReachable.Code -ne 0) {
  Log "WARNING: the fork tip $($chain[-1].Commit.Substring(0,12)) is not reachable from HEAD ($($headHash.Substring(0,12))); generating from the commits anyway."
}

# --- 1. Generate one patch per commit ---------------------------------------
$applyScript = Join-Path $PSScriptRoot 'apply-fork-patches.ps1'
$applyText = if (Test-Path -LiteralPath $applyScript) { Get-Content -LiteralPath $applyScript -Raw } else { '' }
$written = @()

foreach ($c in $chain) {
  $parent = (Invoke-Git $rootFull @('rev-parse', "$($c.Commit)^")).Lines[0].Trim()
  $commit = (Invoke-Git $rootFull @('rev-parse', "$($c.Commit)^{commit}")).Lines[0].Trim()
  $tree = (Invoke-Git $rootFull @('rev-parse', "$($c.Commit)^{tree}")).Lines[0].Trim()
  $target = Join-Path $PatchDir $c.Name

  Log "=== $($c.Name) ==="
  Log "  commit : $($commit.Substring(0,12)) ($($c.Feature))"
  Log "  parent : $($parent.Substring(0,12))"
  Log "  tree   : $tree"

  # git writes the file itself: LF endings, no BOM, no PowerShell pipeline in
  # between (a native command's stdout can keep a trailing CR per line, which is
  # exactly how the 0.1.1 set ended up CRLF).
  $diff = Invoke-Git $rootFull @('diff', '--binary', '--full-index', '--no-color', "--output=$target", $parent, $commit)
  if ($diff.Code -ne 0) {
    Show-Lines $diff.Lines '    '
    Fail 2 "git diff failed for $($c.Name)"
  }
  if (-not (Test-Path -LiteralPath $target)) { Fail 2 "git diff --output wrote nothing for $($c.Name)" }

  # Byte measurement is the guarantee, not the tool's intent.
  $m = Measure-Bytes $target
  if ($m.Bytes -eq 0) { Fail 2 "$($c.Name) is empty; commit $($commit.Substring(0,12)) would then be untracked work." }
  if ($m.CR -gt 0) {
    Log "  WARNING: $($m.CR) CR byte(s) found; rewriting as LF (byte-wise, no re-encode)."
    $raw = [IO.File]::ReadAllBytes($target)
    $out = New-Object System.Collections.Generic.List[byte]
    for ($i = 0; $i -lt $raw.Length; $i++) {
      if ($raw[$i] -eq 0x0D -and ($i + 1) -lt $raw.Length -and $raw[$i + 1] -eq 0x0A) { continue }
      if ($raw[$i] -eq 0x0D) { $out.Add([byte]0x0A); continue }
      $out.Add($raw[$i])
    }
    [IO.File]::WriteAllBytes($target, $out.ToArray())
    $m = Measure-Bytes $target
  }
  if ($m.CR -ne 0) { Fail 2 "$($c.Name) still contains CR bytes after the rewrite; refusing to ship it." }
  if ($m.BOM) { Fail 2 "$($c.Name) starts with a UTF-8 BOM; refusing to ship it." }

  $stat = Invoke-Git $rootFull @('apply', '--stat', $target)
  $paths = @()
  foreach ($line in $stat.Lines) {
    if ($line -match '^\s*(.+?)\s+\|\s+(\d+)\s*([+-]*)\s*$') { $paths += $Matches[1].Trim() }
  }
  Log ("  wrote  : {0} ({1} bytes, {2} LF, {3} CR, BOM={4}, {5} path(s))" -f $c.Name, $m.Bytes, $m.LF, $m.CR, $m.BOM, $paths.Count)
  foreach ($line in $stat.Lines) { Log "    $line" }

  # Cross-check the table the apply script uses.
  if ($applyText -ne '') {
    if ($applyText -notmatch [regex]::Escape($c.Name)) { Log "  WARNING: apply-fork-patches.ps1 does not mention $($c.Name)." }
    if ($applyText -notmatch [regex]::Escape($tree)) { Log "  WARNING: apply-fork-patches.ps1 has no expected tree $tree for $($c.Name); update its table." }
    if ($applyText -notmatch [regex]::Escape($commit)) { Log "  WARNING: apply-fork-patches.ps1 has no commit id $($commit.Substring(0,12)) for $($c.Name)." }
  }
  $written += [pscustomobject]@{ Name = $c.Name; Path = $target; Bytes = $m.Bytes; CR = $m.CR; LF = $m.LF; Paths = $paths.Count; Tree = $tree; Commit = $commit }
}

Log "patches regenerated: $($written.Count)"

# --- 2. Optional end-to-end verification in a throwaway worktree ------------
$verifyExit = 0
if ($Verify) {
  if (Test-Path -LiteralPath $VerifyWorktree) {
    Fail 2 "verification worktree path already exists: $VerifyWorktree. Remove it or pass -VerifyWorktree <other path>."
  }
  Log "=== verifying in a throwaway worktree at $BaseCommit ==="
  Log "worktree: $VerifyWorktree"
  $add = Invoke-Git $rootFull @('worktree', 'add', '--detach', $VerifyWorktree, $BaseCommit)
  if ($add.Code -ne 0) {
    Show-Lines $add.Lines '    '
    Fail 2 "git worktree add failed; nothing to verify against."
  }
  try {
    if (-not (Test-Path -LiteralPath $applyScript)) { Fail 2 "apply-fork-patches.ps1 not found next to this script." }
    & powershell -NoProfile -ExecutionPolicy Bypass -File $applyScript -ReposRoot $VerifyWorktree -PatchDir $PatchDir -BaseCommit $BaseCommit -VerifyTree
    $verifyExit = $LASTEXITCODE
    if ($verifyExit -ne 0) { Log "verification FAILED (apply script exit $verifyExit)" }
    else { Log "verification OK: replay reproduces the fork commits tree for tree" }
  } finally {
    if ($KeepWorktree) {
      Log "keeping the worktree as requested: $VerifyWorktree"
    } else {
      $rm = Invoke-Git $rootFull @('worktree', 'remove', '--force', $VerifyWorktree)
      if ($rm.Code -ne 0) {
        Show-Lines $rm.Lines '    '
        Log "WARNING: could not remove $VerifyWorktree; remove it manually with: git -C `"$rootFull`" worktree remove --force `"$VerifyWorktree`""
      } else {
        Log "worktree removed"
      }
    }
  }
  Log "=== also running a dry run against the real checkout ==="
  & powershell -NoProfile -ExecutionPolicy Bypass -File $applyScript -ReposRoot $rootFull -PatchDir $PatchDir -BaseCommit $BaseCommit -Check
  if ($LASTEXITCODE -ne 0) { Log "dry run against $rootFull reported: exit $LASTEXITCODE (expected when the checkout already has the four commits)" }
}

Log "=== regenerate done ==="
if ($Verify -and $verifyExit -ne 0) { exit 1 }
exit 0
