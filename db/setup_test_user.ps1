# HavenStay MySQL Test User Setup Script
# This script creates a dedicated test user for evidence test runs
# Run with: powershell -ExecutionPolicy Bypass -File setup_test_user.ps1

Write-Host "=== HavenStay MySQL Test User Setup ===" -ForegroundColor Cyan
Write-Host ""

# Get MySQL root credentials
$rootUser = "root"
$rootPassword = Read-Host "Enter MySQL root password" -AsSecureString
$plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($rootPassword))

# Test credentials first
Write-Host "Testing MySQL root connection..." -ForegroundColor Yellow
$testCmd = "mysql -u $rootUser -p'$plainPassword' -h 127.0.0.1 -e 'SELECT 1;' 2>&1"
$testResult = Invoke-Expression $testCmd 2>&1

if ($testResult -like "*ERROR*") {
    Write-Host "❌ Failed to connect to MySQL with provided credentials" -ForegroundColor Red
    Write-Host "Error: $testResult" -ForegroundColor Red
    exit 1
}

Write-Host "✓ MySQL root connection successful" -ForegroundColor Green
Write-Host ""

# SQL commands to setup the test user
$sqlCommands = @"
-- Create dedicated test user for evidence runs
CREATE USER IF NOT EXISTS 'havenstay_test'@'127.0.0.1' IDENTIFIED BY 'test_password_12345';

-- Ensure test database exists (tests can freely drop/recreate tables here)
CREATE DATABASE IF NOT EXISTS havenstay_test;

-- Grant permissions for test database
GRANT 
    CREATE, ALTER, DROP, INDEX, REFERENCES, 
    SELECT, INSERT, UPDATE, DELETE,
    CREATE ROUTINE, ALTER ROUTINE, EXECUTE, TRIGGER
ON havenstay_test.*
TO 'havenstay_test'@'127.0.0.1';

-- Flush privileges
FLUSH PRIVILEGES;

-- Verify user was created
SELECT CONCAT('✓ User created: ', user, '@', host) 
FROM mysql.user 
WHERE user='havenstay_test' AND host='127.0.0.1';
"@

Write-Host "Creating havenstay_test user..." -ForegroundColor Yellow
$tempSqlFile = [System.IO.Path]::GetTempFileName()
$sqlCommands | Out-File -FilePath $tempSqlFile -Encoding UTF8 -NoNewline

$mysqlCmd = "mysql -u $rootUser -p'$plainPassword' -h 127.0.0.1 -e `"$(Get-Content $tempSqlFile)`" 2>&1"
$result = Invoke-Expression $mysqlCmd 2>&1

Remove-Item $tempSqlFile

if ($result -like "*ERROR*") {
    Write-Host "❌ Failed to create test user" -ForegroundColor Red
    Write-Host "Error: $result" -ForegroundColor Red
    exit 1
}

Write-Host $result
Write-Host ""

# Verify grants
Write-Host "Verifying grants..." -ForegroundColor Yellow
$verifyCmd = "mysql -u $rootUser -p'$plainPassword' -h 127.0.0.1 -e `"SHOW GRANTS FOR 'havenstay_test'@'127.0.0.1';`" 2>&1"
$grants = Invoke-Expression $verifyCmd 2>&1
Write-Host $grants
Write-Host ""

# Check binary logging setting
Write-Host "Checking MySQL binary logging configuration..." -ForegroundColor Yellow
$binlogCmd = "mysql -u $rootUser -p'$plainPassword' -h 127.0.0.1 -e `"SHOW VARIABLES LIKE 'log_bin_trust_function_creators';`" 2>&1"
$binlogResult = Invoke-Expression $binlogCmd 2>&1

if ($binlogResult -like "*OFF*") {
    Write-Host "⚠ Binary logging may block routine/trigger creation" -ForegroundColor Yellow
    Write-Host "To enable trusted creators, run (as root):" -ForegroundColor Yellow
    Write-Host "  SET GLOBAL log_bin_trust_function_creators = 1;" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "✓ Setup complete! Test user 'havenstay_test' is ready." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Run evidence test: vendor\bin\phpunit.bat -c phpunit.mysql.xml tests/Feature/ContractManagementTest.php" -ForegroundColor White
Write-Host "2. If test passes, promote CCR-007 and CCR-008 to Verified status" -ForegroundColor White
