@echo off
REM Creates a "EXO Calc" shortcut on your Desktop pointing at the built overlay.
setlocal
set "TARGET=%~dp0src-tauri\target\release\app.exe"
if not exist "%TARGET%" (
  echo The overlay is not built yet. From the overlay folder run:
  echo     npm run tauri build
  echo then run this file again.
  pause
  exit /b 1
)
powershell -NoProfile -Command "$d=[Environment]::GetFolderPath('Desktop'); $s=(New-Object -ComObject WScript.Shell).CreateShortcut($d+'\EXO Calc.lnk'); $s.TargetPath='%TARGET%'; $s.WorkingDirectory='%~dp0src-tauri\target\release'; $s.IconLocation='%TARGET%,0'; $s.Description='EXO Calc overlay'; $s.Save()"
echo Done - "EXO Calc" shortcut created on your Desktop.
pause
