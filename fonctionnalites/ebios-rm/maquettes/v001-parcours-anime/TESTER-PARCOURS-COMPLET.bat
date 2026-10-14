@echo off
setlocal DisableDelayedExpansion
cd /d "%~dp0"
if not exist "%~dp0parcours-complet.html" (
  echo Extrayez tout le ZIP avant de lancer ce fichier.
  pause
  exit /b 1
)
start "" "%~dp0parcours-complet.html"
exit /b 0
