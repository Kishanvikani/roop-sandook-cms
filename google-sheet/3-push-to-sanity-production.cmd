@echo off
setlocal
title Roop Sandook - Push to Sanity Production

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "CMS_ROOT=%%~fI"

echo.
echo Roop Sandook product import - Step 3
echo This will write product data to the Sanity production dataset.
echo.
set /p CONFIRM=Type PUSH and press Enter to continue: 
if /I not "%CONFIRM%"=="PUSH" (
  echo.
  echo Push cancelled.
  echo.
  pause
  exit /b 0
)

echo.
echo Pushing to Sanity production...
echo.

cd /d "%CMS_ROOT%"
call corepack yarn seed:products
if errorlevel 1 (
  echo.
  echo Push failed. Please check the errors above.
  echo.
  pause
  exit /b 1
)

echo.
echo Push complete. Products have been written to Sanity production.
echo.
pause
