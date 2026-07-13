@echo off
setlocal

set "STUDIO_URL=http://localhost:3333"

start "Roop Sandook Sanity Studio" /D "%~dp0" cmd /k "corepack yarn dev"
timeout /t 8 /nobreak >nul
start "" chrome "%STUDIO_URL%"

endlocal
