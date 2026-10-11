@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title Moo Krata - Restaurant

rem Short paths avoid npm command errors when a folder name contains special characters.
pushd "%~sdp0"
if errorlevel 1 goto folder_error

where node >nul 2>&1
if errorlevel 1 goto node_required
where npm.cmd >nul 2>&1
if errorlevel 1 goto node_required
node -e "if (process.versions.node.split('.')[0] !== '24' || process.arch !== 'x64') process.exit(1)"
if errorlevel 1 goto node_required

if not exist "package-lock.json" goto missing_files
if not exist "server.js" goto missing_files
if not exist "scripts\start-cloudflare.js" goto missing_files

node -e "Object.keys(require('./package.json').dependencies).forEach(name => require(name))" >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies. Internet is required for this step.
    call npm.cmd ci --no-audit --no-fund
    if errorlevel 1 goto install_failed
)

echo.
echo Starting the website and Cloudflare...
echo Keep this window open while using the website. Press Ctrl+C to stop.
echo The public URL and cashier URL will appear below.
echo.
call npm.cmd start
set "TASK_EXIT_CODE=%errorlevel%"
if not "%TASK_EXIT_CODE%"=="0" echo Startup failed. Read the error above before trying again.
goto finish

:node_required
echo Install Node.js 24 for Windows x64, then double-click START.bat again.
echo Download: https://nodejs.org/en/download
set "TASK_EXIT_CODE=1"
goto finish

:missing_files
echo Project files are missing. Extract the entire ZIP before opening START.bat.
set "TASK_EXIT_CODE=1"
goto finish

:install_failed
echo Installation failed. Check your internet connection and the error above.
set "TASK_EXIT_CODE=1"

:finish
popd
echo.
pause
exit /b %TASK_EXIT_CODE%

:folder_error
echo Cannot open the project folder. Extract the ZIP to a writable folder.
pause
exit /b 1
