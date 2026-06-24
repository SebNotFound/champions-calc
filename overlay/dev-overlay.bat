@echo off
REM Launch the overlay in DEV mode (hot reload, recompiles if code changed).
REM For everyday use prefer launch-overlay.bat (the built app, instant start).
cd /d "%~dp0"
call npm run tauri dev
