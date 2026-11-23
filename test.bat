@echo off
title Frontdesk - Automated Test Suite
cd /d "%~dp0"
echo ============================================================
echo          FRONTDESK AUTOMATED VERIFICATION SUITE
echo ============================================================
echo.
cd backend
call npm test
echo.
echo ============================================================
echo   Test run complete. Press any key to exit.
echo ============================================================
pause
