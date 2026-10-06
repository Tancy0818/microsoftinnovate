@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -File "%~dp0scripts\start-local.ps1"
if errorlevel 1 (
  echo Could not start AcuityCompass. See the message above.
  pause
  exit /b 1
)
start "" "http://127.0.0.1:5173/"
