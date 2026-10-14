@echo off
rem Open the project folder
cd /d "%~dp0"
rem Install missing files and start the web
call npm.cmd start
rem Keep the window open to read messages
pause
