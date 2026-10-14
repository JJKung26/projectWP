@echo off
rem Open the project folder
cd /d "%~dp0"
rem Install packages once if they are missing
if not exist node_modules (
  call npm.cmd ci --no-audit --no-fund
  if errorlevel 1 goto failed
)
rem Start the web server and Cloudflare
call npm.cmd run start:cloudflare
rem Keep the window open to read messages
:failed
pause
