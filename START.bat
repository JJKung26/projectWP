@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
pushd "%~dp0"
if errorlevel 1 exit /b 1

node -e "if (process.arch !== 'x64' || process.versions.node.split('.')[0] !== '24') process.exit(1)" >nul 2>&1
if errorlevel 1 goto node_required

node -e "for (const name of Object.keys(require('./package.json').dependencies)) require('./node_modules/' + name)" >nul 2>&1
if errorlevel 1 (
    echo Installing packages. Please wait...
    call npm.cmd ci --no-audit --no-fund
    if errorlevel 1 goto failed
)

echo Starting the website. Keep this window open. Press Ctrl+C to stop.
node scripts\start-cloudflare.js
if errorlevel 1 goto failed
popd
exit /b 0

:node_required
echo Install Node.js 24 for Windows x64: https://nodejs.org/en/download
:failed
echo Cannot start. Read the error above, then try again.
pause
popd
exit /b 1
