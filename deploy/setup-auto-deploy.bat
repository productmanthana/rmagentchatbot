@echo off
REM ============================================
REM RMOne AI - Setup Auto-Deploy as Windows Task
REM Run this ONCE as Administrator to register
REM the auto-pull watcher as a scheduled task
REM that runs even when no user is logged in
REM ============================================

SET REPO_DIR=C:\UGIT\RMOneAgent\rmagentchatbot
SET TASK_NAME=RMOneAI-AutoDeploy

echo ============================================
echo  RMOne AI - Auto-Deploy Setup
echo ============================================
echo.

REM Check if running as Administrator
net session >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: Please run this script as Administrator!
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

REM Copy the watcher script to the repo directory
copy /Y "%~dp0auto-pull-watcher.bat" "%REPO_DIR%\auto-pull-watcher.bat"

REM Delete existing task if it exists
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

REM Store Git credentials for SYSTEM account so it can access GitHub
echo.
echo Setting up Git credentials for background service...
echo Copying your Git credentials to the system profile...

REM Copy current user's git config and credentials to system profile
if exist "%USERPROFILE%\.gitconfig" (
    copy /Y "%USERPROFILE%\.gitconfig" "C:\Windows\System32\config\systemprofile\.gitconfig" >nul 2>&1
)
if exist "%LOCALAPPDATA%\GitCredentialManager" (
    xcopy /E /I /Y "%LOCALAPPDATA%\GitCredentialManager" "C:\Windows\System32\config\systemprofile\AppData\Local\GitCredentialManager" >nul 2>&1
)

REM Set git credential helper for system account
git config --system credential.helper manager

REM Pre-cache the GitHub credentials by doing a test fetch as current user
cd /d %REPO_DIR%
git fetch origin main >nul 2>&1

REM Create a scheduled task that runs at system startup as SYSTEM (runs even when logged out)
schtasks /create /tn "%TASK_NAME%" /tr "\"%REPO_DIR%\auto-pull-watcher.bat\"" /sc onstart /ru SYSTEM /rl HIGHEST /f

IF %ERRORLEVEL% EQU 0 (
    echo.
    echo SUCCESS! Auto-deploy task created.
    echo.
    echo The watcher will:
    echo  - Run even when no user is logged in
    echo  - Start automatically when the VM boots
    echo  - Check GitHub for changes every 60 seconds
    echo  - Pull, build, and restart the app automatically
    echo.
    echo To start it right now without rebooting:
    echo   schtasks /run /tn "%TASK_NAME%"
    echo.
    echo To stop it:
    echo   schtasks /end /tn "%TASK_NAME%"
    echo.
    echo To remove it:
    echo   schtasks /delete /tn "%TASK_NAME%" /f
    echo.
    echo Logs are saved to: C:\UGIT\RMOneAgent\auto-pull.log
) ELSE (
    echo ERROR: Failed to create scheduled task!
)

pause
