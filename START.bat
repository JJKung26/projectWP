@echo off
rem ตรวจโปรแกรม ติดตั้งแพ็กเกจที่ขาด แล้วเปิดเว็บพร้อม Cloudflare
setlocal DisableDelayedExpansion
chcp 65001 >nul
title Moo Krata - Restaurant
pushd "%~sdp0"
if errorlevel 1 goto failed

rem ตรวจว่าติดตั้ง Node.js และ npm แล้ว
where node >nul 2>&1
if errorlevel 1 goto node_required
where npm.cmd >nul 2>&1
if errorlevel 1 goto node_required

rem ติดตั้งแพ็กเกจเมื่อยังไม่มีหรือมีไม่ครบ
call npm.cmd ls --omit=dev --depth=0 >nul 2>&1
if errorlevel 1 (
    echo Installing packages. Please wait...
    call npm.cmd ci --no-audit --no-fund
    if errorlevel 1 goto failed
)

rem เปิดเว็บพร้อม Cloudflare ถ้าเว็บเปิดอยู่แล้วจะเปิดหน้าแคชเชียร์
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
