@echo off
REM ============================================
REM RMOne AI - Auto-Pull Watcher for Windows VM
REM Checks GitHub for changes every 60 seconds
REM and automatically pulls + restarts the app
REM ============================================

SET REPO_DIR=C:\RMOneAI
SET CHECK_INTERVAL=60
SET LOG_FILE=C:\RMOneAI\auto-pull.log

echo ============================================
echo  RMOne AI - GitHub Auto-Pull Watcher
echo  Checking every %CHECK_INTERVAL% seconds...
echo ============================================
echo.

:LOOP
REM Get current date/time
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /format:list') do set DATETIME=%%I
set TIMESTAMP=%DATETIME:~0,4%-%DATETIME:~4,2%-%DATETIME:~6,2% %DATETIME:~8,2%:%DATETIME:~10,2%:%DATETIME:~12,2%

REM Navigate to repo directory
cd /d %REPO_DIR%

REM Fetch latest from GitHub (without merging)
git fetch origin main >nul 2>&1

REM Check if there are new changes
git diff HEAD origin/main --quiet >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [%TIMESTAMP%] Changes detected! Pulling latest code...
    echo [%TIMESTAMP%] Changes detected - pulling latest code >> %LOG_FILE%

    REM Pull the latest changes
    git pull origin main
    IF %ERRORLEVEL% EQU 0 (
        echo [%TIMESTAMP%] Pull successful. Installing dependencies...
        echo [%TIMESTAMP%] Pull successful >> %LOG_FILE%

        REM Install any new dependencies
        call npm install --production

        REM Build the application
        call npm run build

        REM Restart the application using PM2
        call pm2 restart rmone-ai 2>nul
        IF %ERRORLEVEL% NEQ 0 (
            echo [%TIMESTAMP%] PM2 process not found. Starting fresh...
            call pm2 start npm --name "rmone-ai" -- run start
        )

        echo [%TIMESTAMP%] Deployment complete!
        echo [%TIMESTAMP%] Deployment complete >> %LOG_FILE%
    ) ELSE (
        echo [%TIMESTAMP%] ERROR: Git pull failed!
        echo [%TIMESTAMP%] ERROR: Git pull failed >> %LOG_FILE%
    )
) ELSE (
    echo [%TIMESTAMP%] No changes detected.
)

REM Wait before checking again
timeout /t %CHECK_INTERVAL% /nobreak >nul
goto LOOP
