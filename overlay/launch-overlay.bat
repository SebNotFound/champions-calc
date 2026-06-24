@echo off
REM One-click launcher for the EXO Calc overlay (the built release app).
REM Build it once with:  cd overlay  &&  npm run tauri build
set "EXE=%~dp0src-tauri\target\release\app.exe"
if exist "%EXE%" (
  start "" "%EXE%"
) else (
  echo The overlay is not built yet.
  echo Build it once from the overlay folder:
  echo.
  echo     npm run tauri build
  echo.
  echo Then double-click this file again.
  pause
)
