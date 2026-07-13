@echo off
setlocal
title Roop Sandook - Preview Sanity Import

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "CMS_ROOT=%%~fI"

echo.
echo Roop Sandook product import - Step 2
echo Previewing Sanity changes. This will not write anything.
echo.

cd /d "%CMS_ROOT%"
call corepack yarn seed:products:dry
if errorlevel 1 (
  echo.
  echo Preview failed. Please check the errors above.
  echo.
  pause
  exit /b 1
)

echo.
echo Preview complete. If the changes above look correct, run Step 3.
echo.
pause
