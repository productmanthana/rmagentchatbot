@echo off
REM ============================================
REM RMOne AI - Auto-Pull Watcher for Windows VM
REM Checks GitHub for changes every 60 seconds
REM and automatically pulls + restarts the app
REM ============================================

REM ---- CONFIGURATION (Update these) ----
SET REPO_DIR=C:\UGIT\RMOneAgent\rmagentchatbot
SET GITHUB_URL=https://github.com/productmanthana/rmagentchatbot.git
SET BRANCH=main
SET CHECK_INTERVAL=60
SET LOG_FILE=C:\UGIT\RMOneAgent\auto-pull.log
SET GIT="C:\Program Files\Git\cmd\git.exe"
REM ---- END CONFIGURATION ----

REM Add Git and Node to PATH for SYSTEM account
SET PATH=%PATH%;C:\Program Files\Git\cmd;C:\Program Files\nodejs;C:\Program Files\Git\bin

echo ============================================
echo  RMOne AI - GitHub Auto-Pull Watcher
echo ============================================
echo  Repo:     %REPO_DIR%
echo  GitHub:   %GITHUB_URL%
echo  Branch:   %BRANCH%
echo  Interval: Every %CHECK_INTERVAL% seconds
echo ============================================
echo.

REM Check if repo directory exists
IF NOT EXIST "%REPO_DIR%\.git" (
    echo Repository not found at %REPO_DIR%
    echo Cloning from GitHub...
    git clone %GITHUB_URL% %REPO_DIR%
    IF %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to clone repository!
        echo Make sure the GitHub URL is correct and you have access.
        pause
        exit /b 1
    )
    echo Clone successful!
    cd /d %REPO_DIR%
    call npm install --production
    call npm run build
    call pm2 start npm --name "rmone-ai" -- run start
    echo Initial setup complete!
    echo.
)

cd /d %REPO_DIR%

REM Verify git remote matches the configured URL
echo Verifying git remote...
git remote set-url origin %GITHUB_URL% >nul 2>&1
echo Remote set to: %GITHUB_URL%
echo.
echo Watching for changes... (Press Ctrl+C to stop)
echo.

:LOOP
REM Get current date/time
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /format:list') do set DATETIME=%%I
set TIMESTAMP=%DATETIME:~0,4%-%DATETIME:~4,2%-%DATETIME:~6,2% %DATETIME:~8,2%:%DATETIME:~10,2%:%DATETIME:~12,2%

REM Navigate to repo directory
cd /d %REPO_DIR%

REM Step 1: Fetch latest commits from GitHub (does NOT change local files)
REM This asks GitHub: "What is the latest commit on the branch?"
git fetch origin %BRANCH% >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [%TIMESTAMP%] WARNING: Could not reach GitHub. Will retry...
    echo [%TIMESTAMP%] WARNING: Could not reach GitHub >> %LOG_FILE%
    goto WAIT
)

REM Step 2: Compare local code vs GitHub code
REM If they differ, it means new changes were pushed to GitHub
git diff HEAD origin/%BRANCH% --quiet >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [%TIMESTAMP%] =============================================
    echo [%TIMESTAMP%] CHANGES DETECTED on GitHub!
    echo [%TIMESTAMP%] =============================================
    echo [%TIMESTAMP%] Changes detected on GitHub >> %LOG_FILE%

    REM Show what changed
    echo [%TIMESTAMP%] Changed files:
    git diff HEAD origin/%BRANCH% --name-only
    echo.

    REM Step 3: Pull the new code (download + apply changes)
    git reset --hard origin/%BRANCH%
    echo [%TIMESTAMP%] Code updated to latest. Rebuilding...
    echo [%TIMESTAMP%] Code updated successfully >> %LOG_FILE%

    REM Step 4: Install any new dependencies
    call npm install --production

    REM Step 5: Rebuild the application
    call npm run build

    REM Step 6: Restart the running application
    call pm2 restart rmone-ai 2>nul
    IF %ERRORLEVEL% NEQ 0 (
        echo [%TIMESTAMP%] PM2 process not found. Starting fresh...
        call pm2 start npm --name "rmone-ai" -- run start
    )

    echo [%TIMESTAMP%] =============================================
    echo [%TIMESTAMP%] DEPLOYMENT COMPLETE!
    echo [%TIMESTAMP%] =============================================
    echo [%TIMESTAMP%] Deployment complete >> %LOG_FILE%
) ELSE (
    echo [%TIMESTAMP%] No changes. Next check in %CHECK_INTERVAL%s...
)

:WAIT
REM Wait before checking again
timeout /t %CHECK_INTERVAL% /nobreak >nul
goto LOOP
