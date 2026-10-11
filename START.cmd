@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
    echo Install Node.js 24 LTS before starting this project.
    pause
    exit /b 1
)
if not exist node_modules (
    call npm ci
    if errorlevel 1 (
        pause
        exit /b 1
    )
)
node scripts/prepare-env.js
if errorlevel 1 exit /b 1
call npm start
pause
