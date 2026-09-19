@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   ===========================================
echo    basmat watan - local test server
echo   ===========================================
echo.
echo    Opening: http://localhost:8123
echo    Press CTRL+C here to stop the server.
echo.
start "" /b cmd /c "timeout /t 2 >nul & start http://localhost:8123"
python -m http.server 8123
