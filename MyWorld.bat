@echo off
chcp 65001 >nul
title My World Control
set "PS=powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0control.ps1""

:menu
cls
echo ==============================
echo        MY WORLD CONTROL
echo ==============================
%PS% status
echo.
echo  1) Start game + online
echo  2) Stop all
echo  3) Restart game server
echo  4) Online ON
echo  5) Online OFF
echo  6) Restart online
echo  7) Start game only (local)
echo  8) Refresh status
echo  0) Exit
echo.
set /p c=Choose:
if "%c%"=="1" %PS% all-start
if "%c%"=="2" %PS% all-stop
if "%c%"=="3" %PS% game-restart
if "%c%"=="4" %PS% online-on
if "%c%"=="5" %PS% online-off
if "%c%"=="6" %PS% online-restart
if "%c%"=="7" %PS% game-start
if "%c%"=="0" exit /b
timeout /t 2 >nul
goto menu
