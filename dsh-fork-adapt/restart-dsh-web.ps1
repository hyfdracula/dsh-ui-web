# Compatibility entry point for the DSH web restart command.
& (Join-Path 'C:\Users\19161\deepseek-harness' 'dsh-web-restart.ps1') @args
exit $LASTEXITCODE
