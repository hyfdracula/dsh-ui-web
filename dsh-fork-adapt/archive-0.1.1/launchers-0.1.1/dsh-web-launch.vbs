' DeepSeek Harness Web launcher bridge.
' wscript.exe (GUI subsystem, never creates a console) launches PowerShell
' with window style 0 (SW_HIDE applied at process creation), so no console
' window flashes — unlike "powershell -WindowStyle Hidden", which hides the
' console only AFTER Windows has already shown it.
'
' Usage:
'   wscript.exe dsh-web-launch.vbs            -> start service only (autostart task)
'   wscript.exe dsh-web-launch.vbs -OpenBrowser -> start service + open GUI (desktop shortcut)

Dim shell, cmd, arg
Set shell = CreateObject("WScript.Shell")
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""C:\Users\19161\deepseek-harness\dsh-web-launch.ps1"""
If WScript.Arguments.Count > 0 Then
  cmd = cmd & " " & WScript.Arguments(0)
End If
' intWindowStyle=0 (hidden), bWaitOnReturn=False (fire and forget)
shell.Run cmd, 0, False

' Clipboard vision watcher: bound to the Harness service lifecycle.
' Starts hidden with the service; watches port 3080 and exits by itself
' when the service goes away. -WatchPort also guards against duplicates.
' intWindowStyle=0 (hidden), bWaitOnReturn=False (fire and forget)
watcher = "powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File ""C:\Users\19161\Documents\dsh-work\free-vision-mcp\tools\clipboard-watcher\clipboard-watcher.ps1"" -WatchPort 3080"
shell.Run watcher, 0, False
