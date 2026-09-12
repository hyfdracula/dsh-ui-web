@echo off
rem ============================================================
rem  DSH fork 改动一键适配（双击运行）—— 0.1.5 checkout
rem  把 dsh-fork-adapt 的 4 个补丁（= fork/0.1.5-rc.2 的 4 个提交）
rem  重放到 C:\Users\19161\deepseek-harness-next，然后重建并重启 web。
rem  升级 DSH 后跑一次即可，避免 fork 改动被官方版本覆盖丢失。
rem  只改 dsh-fork-adapt 与目标 checkout，不提交任何仓库。
rem ============================================================
setlocal
set FORK=C:\Users\19161\deepseek-harness-next
set ADAPT=C:\Users\19161\Documents\dsh-work\dsh-fork-adapt
cd /d %FORK%

echo.
echo  [1/3] 应用 4 个 fork 补丁（strict / --ignore-whitespace / --3way 三级回退）...
call powershell -NoProfile -ExecutionPolicy Bypass -File "%ADAPT%\apply-fork-patches.ps1" -ReposRoot "%FORK%" -PatchDir "%ADAPT%"
if errorlevel 1 goto failed
echo.
echo  [2/3] 重建 host + client 产物（pnpm run build:lib）...
call pnpm run build:lib
if errorlevel 1 goto failed
echo.
echo  [3/3] 重启 DSH Web 服务...
call powershell -NoProfile -ExecutionPolicy Bypass -File "%FORK%\dsh-web-restart.ps1"
if errorlevel 1 goto failed
echo.
echo  完成！如需逐步核对，先跑 -Check 干跑，或 -VerifyTree 逐提交比对 tree。
goto done

:failed
echo.
echo  失败：请看上方脚本输出。补丁套不上时用 git apply --reject 生成 .rej 后手工合并，
echo  具体映射见 %ADAPT%\FORK-CHANGES.md；archive-0.1.1\ 里的旧补丁不要使用。

:done
pause
