@echo off
rem ============================================================
rem  DSH fork 改动一键适配（双击运行）
rem  对 DSH 原版的页面层改动（设置面板关闭动画等）重新应用到当前 checkout
rem  升级 DSH 后跑一次即可，避免改动被官方版本覆盖丢失
rem ============================================================
setlocal
cd /d C:\Users\19161\deepseek-harness

echo.
echo  [1/3] 应用 fork 补丁（git apply --3way）...
call powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\19161\Documents\dsh-work\dsh-fork-adapt\apply-fork-patches.ps1" -ReposRoot C:\Users\19161\deepseek-harness -PatchDir C:\Users\19161\Documents\dsh-work\dsh-fork-adapt -SkipBuild -SkipRestart
echo.
echo  [2/3] 重建 ui-settings-general（让改动进浏览器产物）...
call npx tsdown -C packages/client/ui-settings-general >nul 2>&1
echo      done.
echo.
echo  [3/3] 重启 DSH Web 服务...
call powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\19161\deepseek-harness\dsh-web-restart.ps1"
echo.
echo  完成！如补丁有冲突会留下 .rej 文件，请按 FORK-CHANGES.md 手工合并。
pause
