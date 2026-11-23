@echo off
title Frontdesk - Arvo Systems Support Desk
echo ============================================================
echo           FRONTDESK - ARVO SYSTEMS SUPPORT DESK
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking backend dependencies...
if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend && call npm install && cd ..
)

echo [2/3] Checking frontend build...
if not exist "frontend\dist" (
    echo Building frontend production assets...
    if not exist "frontend\node_modules" (
        cd frontend && call npm install && cd ..
    )
    cd frontend && call npm run build && cd ..
)

echo [3/3] Launching Frontdesk Server...
echo.
echo ============================================================
echo   Frontdesk is running at: http://localhost:3000
echo   Opening your browser automatically...
echo   Press Ctrl+C to stop the server at any time.
echo ============================================================
echo.

start "" http://localhost:3000

cd backend
node src/server.js
pause
