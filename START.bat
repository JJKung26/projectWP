@echo off
rem Check programs, install missing packages, and start the website.
setlocal DisableDelayedExpansion
chcp 65001 >nul
title Moo Krata - Restaurant
pushd "%~dp0"
if errorlevel 1 goto failed

rem Check Node.js and npm.
where node >nul 2>&1
if errorlevel 1 goto node_required
where npm.cmd >nul 2>&1
if errorlevel 1 goto node_required

rem Install packages if they cannot load.
node -e "for (const name of Object.keys(require('./package.json').dependencies)) require('./node_modules/' + name)" >nul 2>&1
if errorlevel 1 (
    echo Installing packages. Please wait...
    call npm.cmd ci --no-audit --no-fund
    if errorlevel 1 goto failed
    node -e "for (const name of Object.keys(require('./package.json').dependencies)) require('./node_modules/' + name)"
    if errorlevel 1 goto failed
)

rem Start the website with Cloudflare.
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
