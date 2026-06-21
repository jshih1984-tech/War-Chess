@echo off
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  set "PYTHON_CMD=py"
) else (
  where python >nul 2>nul
  if %errorlevel%==0 (
    set "PYTHON_CMD=python"
  ) else (
    set "PYTHON_CMD="
  )
)

echo Starting Chess Master at http://127.0.0.1:8765/
start "" "http://127.0.0.1:8765/"
if defined PYTHON_CMD (
  %PYTHON_CMD% -m http.server 8765 --bind 127.0.0.1
) else (
  node dev-server.js
)
pause
