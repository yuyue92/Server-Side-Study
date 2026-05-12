@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  start http://localhost:5500
  py -m http.server 5500
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  start http://localhost:5500
  python -m http.server 5500
  goto :eof
)

echo [ERROR] Python not found.
echo Please install Python or open index.html directly.
pause
