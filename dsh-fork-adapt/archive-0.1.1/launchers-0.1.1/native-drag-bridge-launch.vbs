' DSH native drag bridge launcher.
' wscript.exe is a GUI-subsystem host; launching PowerShell with window style 0
' prevents a console window from being created or flashed.

Dim shell, command
Set shell = CreateObject("WScript.Shell")
command = "powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File ""C:\Users\19161\Documents\dsh-work\free-vision-mcp\tools\clipboard-watcher\native-drag-bridge.ps1"" -WatchPort 3080 -EventPort 3081"
shell.Run command, 0, False
