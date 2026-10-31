@echo off
rem Opens Scale Studio in your browser. Leave the black window open while you
rem practise; closing it stops the app.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 8777
pause
