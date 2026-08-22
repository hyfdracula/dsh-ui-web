# One-time windowless restart: kill the current 3080 host and start it again.
# This copy is used by apply-fork-patches.ps1 and is kept in sync with the
# installed script in the DSH checkout.

[CmdletBinding()]
param(
  [int]$Port = 3080,
  [int]$TimeoutSeconds = 60
)

$ErrorActionPreference = 'Stop'
$RepoRoot = 'C:\Users\19161\deepseek-harness'
$StartCmd = Join-Path $RepoRoot 'start-dsh-web.cmd'
$Log = Join-Path $RepoRoot 'dsh-restart-verify.log'

function Write-Log {
  param([string]$Message)
  Add-Content -LiteralPath $Log -Value ("{0:yyyy-MM-dd HH:mm:ss} {1}" -f (Get-Date), $Message)
}

function Get-WebProcessIds {
  $ids = @{}
  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { $ids[[int]$_.OwningProcess] = $true }
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match '(?i)(?:^|[\\/ ])lib[\\/]bin\.js.*--profile\s+web(?:\s|$)' } |
    ForEach-Object { $ids[[int]$_.ProcessId] = $true }
  return @($ids.Keys | ForEach-Object { [int]$_ })
}

function Wait-ListeningState {
  param([bool]$Expected, [int]$Seconds = 20)
  $deadline = (Get-Date).AddSeconds($Seconds)
  do {
    $listening = [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    if ($listening -eq $Expected) { return $true }
    Start-Sleep -Milliseconds 250
  } while ((Get-Date) -lt $deadline)
  return $false
}

function Test-Http200 {
  try {
    $response = Invoke-WebRequest "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 3
    return ([int]$response.StatusCode -eq 200)
  } catch {
    return $false
  }
}

try {
  if (-not (Test-Path -LiteralPath $StartCmd -PathType Leaf)) { throw "Start script not found: $StartCmd" }
  Write-Log '=== DSH Web restart begin ==='
  foreach ($id in (Get-WebProcessIds)) {
    $process = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($process) {
      Write-Log ("stopping PID {0} ({1})" -f $process.Id, $process.ProcessName)
      Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
    }
  }
  if (-not (Wait-ListeningState -Expected:$false -Seconds 20)) { throw "Port $Port is still listening after stop." }

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = Join-Path $env:WINDIR 'System32\cmd.exe'
  $psi.Arguments = '/d /c call "' + $StartCmd + '"'
  $psi.WorkingDirectory = $RepoRoot
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $child = [System.Diagnostics.Process]::Start($psi)
  if (-not $child) { throw 'Failed to create the detached start process.' }
  $child.Dispose()

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    if (Test-Http200) { break }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
  if (-not (Test-Http200)) { throw "DSH did not return HTTP 200 within $TimeoutSeconds seconds." }

  Write-Log ("IPv4 127.0.0.1:{0} -> OK 200; host PID(s): {1}" -f $Port, ((Get-WebProcessIds) -join ', '))
  try {
    $ipv6Response = Invoke-WebRequest "http://[::1]:$Port/" -UseBasicParsing -TimeoutSec 3
    $ipv6State = if ([int]$ipv6Response.StatusCode -eq 200) { 'OK 200' } else { "HTTP $($ipv6Response.StatusCode)" }
  } catch { $ipv6State = 'not available' }
  Write-Log ("IPv6 ::1:{0} -> {1}" -f $Port, $ipv6State)
  Write-Log '=== DSH Web restart end: success ==='
  exit 0
} catch {
  $message = $_.Exception.Message
  try { Write-Log ("=== DSH Web restart failed: {0} ===" -f $message) } catch {}
  Write-Error $message
  exit 1
}
