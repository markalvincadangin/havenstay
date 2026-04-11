@echo off
REM HavenStay MySQL Test User Setup Script (Batch)
REM Run this script with administrator privileges
REM Usage: setup_test_user.bat

echo.
echo === HavenStay MySQL Test User Setup ===
echo.
echo This script will create a dedicated test user for evidence test runs
echo.
echo Prerequisites:
echo - MySQL must be running
echo - You must have MySQL root access
echo.

setlocal enabledelayedexpansion

set /p rootuser="Enter MySQL root username (default: root): " || set rootuser=root
set /p rootpass="Enter MySQL root password: "
set /p mysqlhost="Enter MySQL host (default: 127.0.0.1): " || set mysqlhost=127.0.0.1

echo.
echo Testing MySQL connection...
mysql -u %rootuser% -p%rootpass% -h %mysqlhost% -e "SELECT 1;" >nul 2>&1
if errorlevel 1 (
    echo ERROR: Could not connect to MySQL. Check your credentials.
    pause
    exit /b 1
)

echo OK - Connected to MySQL
echo.
echo Creating test user 'havenstay_test'...
mysql -u %rootuser% -p%rootpass% -h %mysqlhost% -e "CREATE USER IF NOT EXISTS 'havenstay_test'@'127.0.0.1' IDENTIFIED BY 'test_password_12345'; CREATE DATABASE IF NOT EXISTS havenstay_test; GRANT CREATE, ALTER, DROP, INDEX, REFERENCES, SELECT, INSERT, UPDATE, DELETE, CREATE ROUTINE, ALTER ROUTINE, EXECUTE, TRIGGER ON havenstay_test.* TO 'havenstay_test'@'127.0.0.1'; FLUSH PRIVILEGES; SELECT CONCAT('User created: ', user, '@', host) FROM mysql.user WHERE user='havenstay_test' AND host='127.0.0.1';"

if errorlevel 1 (
    echo ERROR: Failed to create test user. Check MySQL configuration.
    pause
    exit /b 1
)

echo.
echo Verifying grants...
mysql -u %rootuser% -p%rootpass% -h %mysqlhost% -e "SHOW GRANTS FOR 'havenstay_test'@'127.0.0.1';"

echo.
echo Checking binary logging...
mysql -u %rootuser% -p%rootpass% -h %mysqlhost% -e "SHOW VARIABLES LIKE 'log_bin_trust_function_creators';" | find "OFF" >nul
if not errorlevel 1 (
    echo.
    echo WARNING: Binary logging may block routine/trigger creation
    echo To enable trusted creators, run:
    echo   SET GLOBAL log_bin_trust_function_creators = 1;
)

echo.
echo OK - Test user setup complete!
echo.
echo Next steps:
echo   1. Run: vendor\bin\phpunit.bat -c phpunit.mysql.xml tests/Feature/ContractManagementTest.php
echo   2. If passes, update CCR-007 and CCR-008 to Verified
echo.
pause
