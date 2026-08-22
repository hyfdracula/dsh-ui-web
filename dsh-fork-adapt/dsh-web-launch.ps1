# DeepSeek Harness Web launcher
# Used by BOTH the logon autostart task (service only) and the desktop
# shortcut (service + open the GUI in the default browser).
#
#   powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File dsh-web-launch.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File dsh-web-launch.ps1 -OpenBrowser
#
# It never starts a second instance: if something already answers on the port
# it assumes the service is up and moves on.

param(
  [switch]$OpenBrowser
)

$ErrorActionPreference = 'Continue'
$Port = 3080
$Url = "http://127.0.0.1:$Port"
$StartCmd = 'C:\Users\19161\deepseek-harness\start-dsh-web.cmd'
$WaitSeconds = 60

function Test-Listening {
  try {
    $client = [System.Net.Sockets.TcpClient]::new()
    $client.Connect('127.0.0.1', $Port)
    $client.Dispose()
    return $true
  } catch {
    return $false
  }
}

if (-not (Test-Listening)) {
  # Start with CREATE_NO_WINDOW: the console is never created at all, so no
  # black window flashes or survives — unlike -WindowStyle Hidden, which still
  # allocates a console (conhost) and can flash it during startup.
  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = 'cmd.exe'
  $psi.Arguments = '/c "' + $StartCmd + '"'
  $psi.WorkingDirectory = 'C:\Users\19161\deepseek-harness'
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  [void][System.Diagnostics.Process]::Start($psi)
  $deadline = (Get-Date).AddSeconds($WaitSeconds)
  while (-not (Test-Listening) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
  }
}

if ($OpenBrowser -and (Test-Listening)) {
  Start-Process $Url
}
