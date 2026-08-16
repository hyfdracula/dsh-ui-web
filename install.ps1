# dsh-ui-web 一键接入脚本 —— 克隆本仓库后运行，即可获得与作者一致的插件效果。
#
# 前提：已安装 DeepSeek Harness（dsh）并至少启动过一次（~/.dsh 目录存在）。
# 用法：powershell -ExecutionPolicy Bypass -File install.ps1
# 可选参数：
#   -ProfileName web    dsh profile 名（默认 web，对应 ~/.dsh/profiles/web）
#   -SkipBuild          跳过全量构建（已构建过的 lib 直接接入）
param(
  [string]$ProfileName = 'web',
  [switch]$SkipBuild
)
$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$homeDir = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$patchFile = Join-Path $homeDir "profiles\$ProfileName\cordis.patch.yml"

Write-Host "== dsh-ui-web 一键接入 =="
Write-Host "仓库:  $repo"
Write-Host "profile: $ProfileName"
Write-Host "patch:  $patchFile"

# 1. 安装依赖
Push-Location $repo
Write-Host "`n[1/4] pnpm install ..."
pnpm install --prefer-offline
if ($LASTEXITCODE -ne 0) { throw 'pnpm install 失败' }

# 2. 构建全部 family 包（产 lib/，link 后由 dsh 直接加载）
if (-not $SkipBuild) {
  Write-Host "`n[2/4] 构建全部插件包 ..."
  pnpm -r build
  if ($LASTEXITCODE -ne 0) { throw 'pnpm build 失败' }
}
Pop-Location

# 3. junction 到 ~/.dsh/profiles/node_modules/@captain1275/
Write-Host "`n[3/4] link-profile.mjs ..."
Push-Location $repo
node scripts/link-profile.mjs
$lc = $LASTEXITCODE
Pop-Location
if ($lc -ne 0) { throw 'link-profile 失败' }

# 4. 幂等合并 cordis.patch.yml（只追加缺失的插件登记）
Write-Host "`n[4/4] 登记插件到 $patchFile ..."
$inserts = @(
  @{ id = 'ui-effort-slider';    name = '@captain1275/dsh-effort-slider' },
  @{ id = 'ui-usage-dashboard';  name = '@captain1275/dsh-usage-dashboard' },
  @{ id = 'ui-web-ui-settings';  name = '@captain1275/dsh-client-ui-web-ui-settings' },
  @{ id = 'open-path';           name = '@captain1275/dsh-open-path' }
)
$dir = Split-Path -Parent $patchFile
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$text = if (Test-Path $patchFile) { [IO.File]::ReadAllText($patchFile) } else { "# dsh profile patch layer`n" }
$encoder = [Text.UTF8Encoding]::new($false)
$changed = $false
foreach ($ins in $inserts) {
  if (-not $text.Contains("id: $($ins.id)`n")) {
    $block = "`n- insert:`n    - id: $($ins.id)`n      name: '$($ins.name)'`n"
    $text += $block
    Write-Host "  + $($ins.id) ($($ins.name))"
    $changed = $true
  } else {
    Write-Host "  = $($ins.id) 已存在"
  }
}
if ($changed) { [IO.File]::WriteAllText($patchFile, $text, $encoder) }

Write-Host "`n完成。重启 dsh web（或 dsh 进程）后刷新 http://127.0.0.1:3080 生效。"
Write-Host "可选：极光等皮肤在设置 -> 插件 里按需启用；Aqua 玻璃主题是独立插件，见 README。"