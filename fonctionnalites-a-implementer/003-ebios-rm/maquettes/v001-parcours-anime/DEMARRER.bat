@echo off
setlocal DisableDelayedExpansion
cd /d "%~dp0"
if not exist "%~dp0index.html" (
  echo Fichier index.html introuvable.
  echo Extrayez tout le ZIP avant de lancer DEMARRER.bat.
  pause
  exit /b 1
)
start "" "%~dp0index.html"
if errorlevel 1 (
  echo Ouvrez index.html directement dans votre navigateur.
  pause
  exit /b 1
)
exit /b 0
