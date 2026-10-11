@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  python demarrer.py
) else (
  py -3 demarrer.py
)
pause
