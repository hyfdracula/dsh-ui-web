# Regenerate the DSH fork patch(es) from the current working tree vs origin/master.
# Use AFTER t1/t2/t3 source changes are complete and settled, BEFORE freezing the
# adaptation set.
#
# Rules enforced (captain's hard-won lessons):
#   - Each patch file is written via [IO.File]::WriteAllText with a UTF8 encoder
#     created as [Text.UTF8Encoding]::new($false) -> NO BOM, and LF newlines,
#     otherwise `git apply` fails.
#   - New (untracked) fork files MUST be `git add -N` (intent-to-add) first so
#     `git diff origin/master -- <path>` includes them.
#   - Patches are generated in stable order (sort by patch number).
#   - Each generated patch is validated with `git apply --check --reverse` against
#     the dirty working tree (i.e. it must reverse cleanly off the current files).

param(
  [string]$ReposRoot = 'C:\Users\19161\deepseek-harness',
  [string]$PatchDir  = (Join-Path $PSScriptRoot '.'),
  [switch]$WhatIf
)

# Control flow relies on explicit $LASTEXITCODE checks, NOT on stderr-as-error:
# native git commands write to stderr even on success, and with EAP=Stop that
# becomes a terminating NativeCommandError. We keep EAP=Continue and inspect
# $LASTEXITCODE to decide success/failure.
$ErrorActionPreference = 'Continue'
function Log($m) { Write-Host ("[{0:HH:mm:ss}] {1}" -f (Get-Date), $m) }

# --- The fork source files that belong in the adapt set ---------------------
# Grouped by patch. New files (not present in origin/master) are marked as such
# and get `git add -N` before diffing. Order within a patch = file order.
# Captain's final naming scheme for the 5 fork patches.
$patches = @(
  @{
    Name = '010-settings-root-two-phase-close.patch'
    Files = @(
      'packages/client/ui-settings-general/src/client/SettingsRoot.tsx',
      'packages/client/ui-settings-general/src/client/SettingsRoot.module.css'
    )
  }
  @{
    Name = '020-model-select-no-reasoning-effort.patch'
    Files = @(
      'packages/client/ui-model-selection/src/client/ModelSelect.tsx',
      'packages/client/ui-model-selection/src/client/locales.ts',
      'packages/client/ui-model-selection/tests/model-select.client.spec.tsx'
    )
  }
  @{
    Name = '030-attachment-file-sync.patch'
    Files = @(
      'packages/attachment/attachment/src/error.ts',
      'packages/attachment/attachment/src/types.ts',
      'packages/attachment/attachment/src/index.ts',
      'packages/attachment/attachment-local/src/store.ts',
      'packages/attachment/attachment-local/src/index.ts',
      'packages/attachment/attachment-local/src/file-store.ts',        # NEW
      'packages/attachment/attachment-local/tests/file-store.spec.ts', # NEW
      'packages/attachment/attachment-local/tests/index.spec.ts'
    )
  }
  @{
    Name = '040-host-content-file.patch'
    Files = @(
      'packages/llm/llm/src/types.ts',
      'packages/llm/llm-deepseek/src/adapter.ts',   # compat: scope DeepSeekModality to text/image
      'packages/llm/llm-deepseek/src/index.ts',     # compat: MODEL_MODALITIES uses DeepSeekModality
      'packages/host/apiproxy/src/api-proxy.ts',
      'packages/host/apiproxy/src/api/sessions.schema.ts',
      'packages/host/apiproxy/src/api/sessions.ts',
      'packages/client/runtime/src/client/contract/session.ts',
      'packages/client/runtime/src/client/sessions/session.ts',
      'packages/client/connection/src/client/fixture.ts'
    )
  }
  @{
    Name = '050-ui-conversation-file.patch'
    Files = @(
      'packages/client/ui-conversation/src/client/contract/slots.ts',
      'packages/client/ui-conversation/src/client/input/contract.ts',
      'packages/client/ui-conversation/src/client/input/facade.ts',
      'packages/client/ui-conversation/src/client/input/hub.ts',
      'packages/client/ui-conversation/src/client/input/machine.ts',
      'packages/client/ui-conversation/src/client/service.ts',
      'packages/client/ui-conversation/src/client/apply.ts',
      'packages/client/ui-conversation/src/client/locales.ts',
      'packages/client/ui-conversation/src/client/image-labels.ts',
      'packages/client/ui-conversation/src/client/path-links.ts',             # NEW
      'packages/client/ui-conversation/src/client/skeleton/ConversationSession.tsx',
      'packages/client/ui-conversation/src/client/skeleton/InputBar.tsx',
      'packages/client/ui-conversation/src/client/skeleton/InputBar.module.css',
      'packages/client/ui-conversation/src/client/chat/MessageItem.tsx',
      'packages/client/ui-conversation/src/client/chat/MessageItem.module.css',
      'packages/client/ui-conversation/tests/input-bar.client.spec.tsx',
      'packages/client/ui-conversation/tests/input-matrix.client.spec.tsx',
      'packages/client/ui-conversation/tests/input-reference-submit.client.spec.ts',
      'packages/client/ui-conversation/tests/input-scenarios.client.spec.tsx',
      'packages/client/ui-conversation/tests/skeleton.client.spec.tsx',
      'packages/client/ui-conversation/tests/chat-view.client.spec.tsx',
      'packages/client/ui-conversation/tests/gate-branch-tails.client.spec.tsx',
      'packages/client/ui-conversation/tests/queue-dock.client.spec.tsx'
    )
  }
  @{
    # Cross-package consumer test compat: the ui-conversation input contract
    # grew file members (InputActions.addFiles/removeFile/pruneFiles,
    # InputState.fileIds, ConversationSessionInjected.releaseSessionFiles), which
    # forced updates to pristine upstream test fixtures in OTHER packages so the
    # client face still typechecks (tsc -b tsconfig.client.json). Replaying the
    # contract patch alone would re-break these, so they ship alongside 050.
    Name = '060-input-contract-consumer-tests.patch'
    Files = @(
      'packages/client/ui-tool/tests/diff-card.client.spec.tsx',
      'packages/client/ui-tool/tests/read-card.client.spec.tsx',
      'packages/client/ui-tool/tests/search-card.client.spec.tsx',
      'packages/client/ui-tool/tests/terminal-card.client.spec.tsx',
      'packages/client/ui-tool/tests/web-card.client.spec.tsx',
      'packages/client/ui-trajectory/tests/views.client.spec.tsx',
      'packages/client/ui-attachment/tests/message-image.client.spec.tsx'
    )
  }
  @{
    # Restore the "unlimited attachment" sentinel skip guard in
    # assertImageBodyCapacity. rc.8 dropped it, so an UNLIMITED_ATTACHMENT
    # deployment (maxMessageImageBytes = Number.MAX_SAFE_INTEGER) made every
    # /api request hit the request-body ceiling and stall the session list
    # after refresh. The guard makes the capacity check a no-op for the
    # no-finite-bound sentinel.
    Name = '070-connection-unlimited-skip.patch'
    Files = @(
      'packages/client/connection/src/index.ts'
    )
  }
  @{
    # Session-list loading state in the workspace browser: while the session
    # list phase is not yet 'ready' (e.g. right after page refresh), show
    # "正在加载会话…" instead of "暂无会话" (which upstream shows for any
    # empty list, causing a misleading "no sessions" flash during load).
    # Shipped in the same fork commit as the 070 refresh fix (8c3c5b4d4b).
    Name = '080-ui-workspace-loading-state.patch'
    Files = @(
      'packages/client/ui-workspace/src/client/WorkspaceBrowser.tsx',
      'packages/client/ui-workspace/src/client/locales.ts',
      'packages/client/ui-workspace/tests/workspace-browser.client.spec.tsx'
    )
  }
)

Push-Location $ReposRoot
try {
  foreach ($p in $patches) {
    $name = $p.Name
    $files = $p.Files
    Log ("=== {0} ({1} files) ===" -f $name, $files.Count)

    # Intent-to-add any file that is currently untracked.
    foreach ($f in $files) {
      $null = & git ls-files --error-unmatch -- $f 2>&1
      if ($LASTEXITCODE -ne 0) {
        if ($WhatIf) { Log ("  (whatif) intent-to-add (new): {0}" -f $f); continue }
        Log ("  + intent-to-add (new): {0}" -f $f)
        & git add -N -- $f 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "git add -N failed for $f" }
      }
    }

    if ($WhatIf) {
      Log "  (whatif) would generate $name"
      continue
    }

    # Capture the diff as an array of lines via a direct assignment (NOT
    # Out-String — that line-wraps and corrupts the patch). Join with "`n" and
    # write with no BOM, which is the pair that makes `git apply` succeed.
    $diff = git diff --no-color origin/master -- $files 2>$null
    if ($LASTEXITCODE -ne 0) { throw "git diff failed for $name" }
    $content = ($diff -join "`n") + "`n"
    $target = Join-Path $PatchDir $name
    # No BOM + LF: the whole reason `git apply` fails otherwise.
    [IO.File]::WriteAllText($target, $content, [Text.UTF8Encoding]::new($false))
    Log ("  wrote {0} ({1} bytes)" -f $name, $content.Length)

    if ($content.Trim().Length -eq 0) {
      Log "  WARNING: empty diff — no fork change present for these files?"
      continue
    }

    # Validate the patch reverses cleanly off the current (dirty) working tree.
    $revOut = (& git apply --check --reverse $target 2>&1 | Out-String)
    if ($LASTEXITCODE -eq 0) {
      Log "  OK: patch reverses cleanly off current tree"
    } else {
      Log "  FAIL: reverse-check reported problems (see above)"
      $revOut -split "`r?`n" | Where-Object { $_ -ne '' } | ForEach-Object { Log "    $_" }
    }
  }
} finally {
  Pop-Location
}

Log "=== regenerate-fork-patches done ==="
