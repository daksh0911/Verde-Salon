@echo off
title Verde Salon Web Service
echo Starting Verde Salon Web Service...
cd /d "%~dp0"
echo.
echo Checking database & dependencies...
if not exist "server\.env" (
    echo Error: server\.env not found!
    pause
    exit /b 1
)

echo Starting Node.js + Express backend service...
echo The web service will run at: http://localhost:5000
echo.
echo Press Ctrl+C anytime to stop the server.
echo.
node server/server.js
pause
