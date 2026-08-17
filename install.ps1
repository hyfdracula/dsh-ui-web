# dsh-ui-web 一键接入脚本 —— 克隆本仓库后运行，即可获得与作者一致的插件效果。
#
# 前提：已安装 DeepSeek Harness（dsh）并至少启动过一次（~/.dsh 目录存在）。
# 用法：powershell -ExecutionPolicy Bypass -File install.ps1
# 可选参数：
#   -ProfileName web    dsh profile 名（默认 web，对应 ~/.dsh/profiles/web）
#   -DshHome <path>    DSH_HOME 覆盖（默认取 $env:DSH_HOME，其次 ~/.dsh）
#   -SkipBuild          跳过全量构建（已构建过的 lib 直接接入）
param(
  [string]$ProfileName = 'web',
  [string]$DshHome,
  [switch]$SkipBuild
)
$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
# 与 dsh 运行时同一解析顺序：显式参数 > $env:DSH_HOME > ~/.dsh
$homeDir = if ($DshHome) { $DshHome } elseif ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$patchFile = Join-Path $homeDir "profiles\$ProfileName\cordis.patch.yml"

# 依赖预检：先给出明确中文提示，而不是裸的 CommandNotFoundException 堆栈
foreach ($cmd in @('pnpm', 'node')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    throw "未找到 $cmd，请先安装 Node.js 与 pnpm（见 README 环境准备章节）。"
  }
}

# 幂等检测：行级正则，兼容 CRLF / 行首缩进变化 / 有无列表符号，避免 Contains("id: x`n")
# 对 CRLF 文件失效而每跑一次重复追加；同时按 name 防重，同一包名只允许一行，
# 避免用户手写别名 id 造成同一包被重复挂载。
function Test-PatchEntryPresent {
  param([string]$Text, [string]$Id, [string]$Name)
  $idPattern = "(?m)^[ \t]*-?[ \t]*id:[ \t]*$([regex]::Escape($Id))[ \t]*\r?$"
  if ([regex]::IsMatch($Text, $idPattern)) { return $true }
  $namePattern = "(?m)^[ \t]*-?[ \t]*name:[ \t]*'$([regex]::Escape($Name))'[ \t]*\r?$"
  return [regex]::IsMatch($Text, $namePattern)
}

Write-Host "== dsh-ui-web 一键接入 =="
Write-Host "仓库:   $repo"
Write-Host "profile: $ProfileName"
Write-Host "patch:  $patchFile"

# 1. 安装依赖 + 2. 构建 + 3. junction 链接（均在仓库目录内执行；finally 保证任何
# 异常路径都会 Pop-Location，不会把调用方当前位置留在 repo 目录）
try {
  Push-Location $repo
  Write-Host "`n[1/4] pnpm install ..."
  pnpm install --prefer-offline
  if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw 'pnpm install 失败' }

  if (-not $SkipBuild) {
    Write-Host "`n[2/4] 构建全部插件包 ..."
    pnpm -r build
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw 'pnpm build 失败' }
  }

  # 3. junction 到 <homeDir>/profiles/node_modules/@captain1275/
  # 把 DSH_HOME 显式传给子进程，保证 link 层与 patch 层（以及 dsh 运行时）同一 home
  Write-Host "`n[3/4] link-profile.mjs ..."
  $env:DSH_HOME = $homeDir
  node scripts/link-profile.mjs
  $lc = $LASTEXITCODE
  if ($lc -and $lc -ne 0) { throw 'link-profile 失败' }
} finally {
  Pop-Location
}

# 4. 幂等合并 cordis.patch.yml（只追加缺失的插件登记；open-path 已退役，不再随装启用）
Write-Host "`n[4/4] 登记插件到 $patchFile ..."
$inserts = @(
  @{ id = 'ui-effort-slider';    name = '@captain1275/dsh-effort-slider' },
  @{ id = 'ui-usage-dashboard';  name = '@captain1275/dsh-usage-dashboard' },
  @{ id = 'ui-web-ui-settings';  name = '@captain1275/dsh-client-ui-web-ui-settings' }
)
$dir = Split-Path -Parent $patchFile
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
# 显式按 UTF-8 读取（含 BOM 检测），避免 GBK/GB2312 旧文件被误解码后整体写回成 mojibake
$text = if (Test-Path $patchFile) { [IO.File]::ReadAllText($patchFile, [Text.Encoding]::UTF8) } else { "# dsh profile patch layer`n" }
$encoder = [Text.UTF8Encoding]::new($false)
$changed = $false
foreach ($ins in $inserts) {
  if (-not (Test-PatchEntryPresent -Text $text -Id $ins.id -Name $ins.name)) {
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