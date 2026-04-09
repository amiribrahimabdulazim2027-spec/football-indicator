@echo off
title Double Chance Analyst Pro
echo.
echo ══════════════════════════════════════════
echo   🎯 Double Chance Analyst Pro
echo   Starting server...
echo ══════════════════════════════════════════
echo.

cd /d "G:\المؤشر"

:: Start browser after 3 seconds
start "" cmd /c "timeout /t 3 >nul & start http://localhost:3000"

:: Start server
node server.js
