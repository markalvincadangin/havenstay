# HavenStay MySQL Evidence Run Setup

## Goal
Enable MySQL evidence run for HavenStay Batch 3 to validate CCR-007 (transaction_logs) and CCR-008 (triggers).

## Issue
Laravel feature tests fail during migration when attempting to CREATE/DROP PROCEDURE and CREATE/DROP TRIGGER because the database user lacks required permissions.

## Solution
Create a dedicated TEST MySQL user (`havenstay_test`) with limited, specific grants for procedure and trigger operations on a dedicated test database (`havenstay_test`). The MySQL PHPUnit config (`backend/phpunit.mysql.xml`) is set up to use this by default.

## Setup Steps

### 1. Create Test User (One-Time Setup)

**Option A: Using the provided batch script (Windows)**
```cmd
cd db
setup_test_user.bat
```

**Option B: Using the provided PowerShell script (Windows)**
```powershell
cd db
powershell -ExecutionPolicy Bypass -File setup_test_user.ps1
```

**Option C: Manual SQL (any platform)**
Run this as root or a privileged MySQL user:

```bash
mysql -u root -p < db/setup_test_user.sql
```

Or paste directly in MySQL CLI:
```sql
CREATE USER IF NOT EXISTS 'havenstay_test'@'127.0.0.1' IDENTIFIED BY 'test_password_12345';

CREATE DATABASE IF NOT EXISTS havenstay_test;

GRANT 
    CREATE, ALTER, DROP, INDEX, REFERENCES, 
    SELECT, INSERT, UPDATE, DELETE,
    CREATE ROUTINE, ALTER ROUTINE, EXECUTE, TRIGGER
ON havenstay_test.*
TO 'havenstay_test'@'127.0.0.1';

FLUSH PRIVILEGES;
```

### 2. Verify User Setup
```sql
-- Check user exists
SELECT user, host FROM mysql.user WHERE user='havenstay_test';

-- Verify grants
SHOW GRANTS FOR 'havenstay_test'@'127.0.0.1';
```

### 3. Run Evidence Test
The `backend/phpunit.mysql.xml` configuration is pre-configured to use `havenstay_test` credentials.

```bash
cd backend
vendor/bin/phpunit -c phpunit.mysql.xml tests/Feature/ContractManagementTest.php
```

## Troubleshooting

### Error: "Access denied for user 'havenstay_test'"
- Verify user was created: `SELECT user, host FROM mysql.user;`
- Verify password matches setup script or config
- Flush privileges: `FLUSH PRIVILEGES;`

### Error: "Access denied for 'havenstay_test'@'127.0.0.1' (using password: YES) ... to PROCEDURE"
- Verify grants: `SHOW GRANTS FOR 'havenstay_test'@'127.0.0.1';`
- Ensure grants include `CREATE ROUTINE, ALTER ROUTINE, EXECUTE, TRIGGER`
- Re-run grant command if needed

### Error: "Unsafe statement written to the binary log"
If MySQL binary logging blocks routine creation, enable trusted creators (as root):
```sql
SET GLOBAL log_bin_trust_function_creators = 1;
-- Optional: persist in my.cnf for permanent change
```

### Test Passes But No Transaction Logs
Check that:
1. Transaction log table exists: `SHOW TABLES LIKE 'transaction_logs';`
2. Triggers are created: `SHOW TRIGGERS LIKE 'trg_%';`
3. Sample data and transactions are executing: `SELECT COUNT(*) FROM transaction_logs;`

## Credentials Reference
- **User:** `havenstay_test`
- **Password:** `test_password_12345`
- **Host:** `127.0.0.1`
- **Database:** `havenstay_test` (defaults in `backend/phpunit.mysql.xml`)
- **Grants:** CREATE, ALTER, DROP, INDEX, REFERENCES, SELECT, INSERT, UPDATE, DELETE, CREATE ROUTINE, ALTER ROUTINE, EXECUTE, TRIGGER

## Security Notes
- This is a **test-only** user with minimal privileges scoped to the `havenstay` test database
- Password is intentionally simple for local test environment
- Change password if deploying to shared environments
- Consider using environment variable injection for production-like test environments
