@echo off
echo ==============================================
echo       Starting TeamFlow Application
echo ==============================================
echo.

REM Start PostgreSQL if not already running on port 5433
netstat -ano | findstr :5433 >nul
if %errorlevel% neq 0 (
    echo Starting PostgreSQL on port 5433...
    start /b "" "C:\Users\Asus\AppData\Local\pgsql\bin\postgres.exe" -D "C:\Users\Asus\AppData\Local\pgsql\data" -p 5433 >nul 2>&1
    timeout /t 2 /nobreak >nul
) else (
    echo PostgreSQL is already running on port 5433.
)

echo.
echo Starting Backend API (port 5000) and Frontend Client (port 3000)...
echo Press Ctrl+C anytime to stop.
echo.
npm run dev
