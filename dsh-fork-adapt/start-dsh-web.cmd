@echo off
rem Start dsh web from the BUILT entry (apps/cli/lib/bin.js): cold start is
rem ~2s vs ~26s for the tsx source path. Output goes to dsh-web.log.
cd /d C:\Users\19161\deepseek-harness\apps\cli
rem Native Explorer FileDrop -> localhost:3081 SSE -> composer text.
rem Use wscript.exe (GUI subsystem) to prevent a PowerShell console flash.
start "" wscript.exe "C:\Users\19161\deepseek-harness\native-drag-bridge-launch.vbs"
"C:\Users\19161\AppData\Local\Programs\kimi-desktop\resources\resources\runtime\node.exe" lib/bin.js --profile web > ..\dsh-web.log 2>&1
