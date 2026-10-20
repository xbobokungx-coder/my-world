@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-online.ps1"
timeout /t 4 >nul
