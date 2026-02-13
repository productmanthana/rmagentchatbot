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
SET GIT_EXE=C:\Program Files\Git\cmd\git.exe
SET NPM_EXE=C:\nvm4w\nodejs\npm.cmd
SET PM2_EXE=C:\nvm4w\nodejs\pm2.cmd
REM ---- END CONFIGURATION ----

REM Force PATH to include Git and Node for SYSTEM account
SET "PATH=C:\Program Files\Git\cmd;C:\Program Files\Git\bin;C:\nvm4w\nodejs;C:\nvm4w;C:\Windows\System32;C:\Windows;%PATH%"

REM Fix for SYSTEM account: Set HOME and disable SSL verify
SET "HOME=C:\UGIT\RMOneAgent"
SET "GIT_SSL_NO_VERIFY=true"
SET "GIT_TERMINAL_PROMPT=0"

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
    "%GIT_EXE%" clone %GITHUB_URL% %REPO_DIR%
    IF %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to clone repository!
        echo Make sure the GitHub URL is correct and you have access.
        pause
        exit /b 1
    )
    echo Clone successful!
    cd /d %REPO_DIR%
    call "%NPM_EXE%" install --production
    call "%NPM_EXE%" run build
    call "%PM2_EXE%" start npm --name "rmone-ai" -- run start
    echo Initial setup complete!
    echo.
)

cd /d %REPO_DIR%

REM Verify git remote matches the configured URL
echo Verifying git remote...
"%GIT_EXE%" remote set-url origin %GITHUB_URL% >nul 2>&1
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
"%GIT_EXE%" fetch origin %BRANCH% 2>"%REPO_DIR%\fetch-error.log"
IF %ERRORLEVEL% NEQ 0 (
    SET /P FETCH_ERR=<"%REPO_DIR%\fetch-error.log"
    echo [%TIMESTAMP%] WARNING: Could not reach GitHub. Error: %FETCH_ERR%
    echo [%TIMESTAMP%] WARNING: Could not reach GitHub. Error: %FETCH_ERR% >> "%LOG_FILE%"
    goto WAIT
)

REM Step 2: Compare local code vs GitHub code
"%GIT_EXE%" diff HEAD origin/%BRANCH% --quiet >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [%TIMESTAMP%] =============================================
    echo [%TIMESTAMP%] CHANGES DETECTED on GitHub!
    echo [%TIMESTAMP%] =============================================
    echo [%TIMESTAMP%] Changes detected on GitHub >> "%LOG_FILE%"

    REM Show what changed
    echo [%TIMESTAMP%] Changed files:
    "%GIT_EXE%" diff HEAD origin/%BRANCH% --name-only
    echo.

    REM Step 3: Update the code
    "%GIT_EXE%" reset --hard origin/%BRANCH%
    echo [%TIMESTAMP%] Code updated to latest. Rebuilding...
    echo [%TIMESTAMP%] Code updated successfully >> "%LOG_FILE%"

    REM Step 4: Install any new dependencies
    call "%NPM_EXE%" install --production

    REM Step 5: Rebuild the application
    call "%NPM_EXE%" run build

    REM Step 6: Restart the running application
    call "%PM2_EXE%" restart rmone-ai 2>nul
    IF %ERRORLEVEL% NEQ 0 (
        echo [%TIMESTAMP%] PM2 process not found. Starting fresh...
        call "%PM2_EXE%" start npm --name "rmone-ai" -- run start
    )

    echo [%TIMESTAMP%] =============================================
    echo [%TIMESTAMP%] DEPLOYMENT COMPLETE!
    echo [%TIMESTAMP%] =============================================
    echo [%TIMESTAMP%] Deployment complete >> "%LOG_FILE%"
) ELSE (
    echo [%TIMESTAMP%] No changes. Next check in %CHECK_INTERVAL%s...
)

:WAIT
REM Wait before checking again
timeout /t %CHECK_INTERVAL% /nobreak >nul
goto LOOP
