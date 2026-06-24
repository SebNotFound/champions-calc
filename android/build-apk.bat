@echo off
REM Build the offline web calc, copy it into the Android assets, and assemble a
REM debug APK. Run from anywhere; paths are resolved relative to this file.
setlocal
set "ANDROID_DIR=%~dp0"
set "REPO_DIR=%~dp0.."

echo [1/3] Building the web calc...
pushd "%REPO_DIR%"
call npm run build || (echo Web build failed& popd & exit /b 1)
popd

echo [2/3] Copying dist into android assets...
set "ASSETS=%ANDROID_DIR%app\src\main\assets"
if exist "%ASSETS%" rmdir /s /q "%ASSETS%"
mkdir "%ASSETS%"
xcopy /e /i /y "%REPO_DIR%\dist\*" "%ASSETS%\" >nul || (echo Copy failed& exit /b 1)

echo [3/3] Assembling the debug APK...
pushd "%ANDROID_DIR%"
call gradlew.bat assembleDebug || (echo Gradle build failed& popd & exit /b 1)
popd

echo.
echo Done. APK: %ANDROID_DIR%app\build\outputs\apk\debug\app-debug.apk
echo Install with: adb install -r "%ANDROID_DIR%app\build\outputs\apk\debug\app-debug.apk"
