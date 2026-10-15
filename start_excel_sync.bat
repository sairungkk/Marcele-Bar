@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found on PATH.
  echo         Install it from https://nodejs.org then try again.
  pause
  exit /b 1
)

echo Opening Bar Stock Control and starting the Excel auto-save server...
echo (this window must stay open while you use the app)
echo.

start "" "%~dp0Bar_Stock_Control.html"
node "%~dp0auto_excel_server.js"

echo.
echo Server stopped. Closing...
timeout /t 2 >nul
endlocal
