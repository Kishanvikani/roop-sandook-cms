@echo off
setlocal
title Roop Sandook - Convert CSV to JSON

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "CMS_ROOT=%%~fI"

echo.
echo Roop Sandook product import - Step 1
echo Converting google-sheet\product-import.csv to JSON...
echo.

cd /d "%CMS_ROOT%"
call corepack yarn sheet:json
if errorlevel 1 (
  echo.
  echo Conversion failed. Please check the errors above.
  echo.
  pause
  exit /b 1
)

echo.
echo Done. Please check:
echo %CMS_ROOT%\google-sheet\generated\product-import.json
echo.
echo Verify the JSON before running Step 2 preview.
echo.
pause
