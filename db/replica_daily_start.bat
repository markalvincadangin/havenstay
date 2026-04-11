@echo off
setlocal

set SCRIPT_DIR=%~dp0
set PS_SCRIPT=%SCRIPT_DIR%replica_daily_start.ps1

if not exist "%PS_SCRIPT%" (
  echo [ERROR] Could not find %PS_SCRIPT%
  exit /b 1
)

powershell -ExecutionPolicy Bypass -File "%PS_SCRIPT%" -AutoRepair %*
exit /b %ERRORLEVEL%
