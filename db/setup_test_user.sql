-- ================================================================
-- HavenStay Test User Setup
-- Purpose: Create dedicated TEST user for MySQL evidence runs 
--          (CCR-007, CCR-008 validation)
-- ================================================================

-- 1. Create the dedicated test user (limited to localhost)
CREATE USER IF NOT EXISTS 'havenstay_test'@'127.0.0.1' IDENTIFIED BY 'test_password_12345';

-- Ensure test database exists (tests can freely drop/recreate tables here)
CREATE DATABASE IF NOT EXISTS havenstay_test;

-- 2. Grant necessary permissions for procedure/trigger creation + testing
GRANT 
    CREATE, 
    ALTER, 
    DROP, 
    INDEX, 
    REFERENCES, 
    SELECT, 
    INSERT, 
    UPDATE, 
    DELETE,
    CREATE ROUTINE, 
    ALTER ROUTINE, 
    EXECUTE, 
    TRIGGER
ON havenstay_test.*
TO 'havenstay_test'@'127.0.0.1';

-- 3. Flush privileges to apply immediately
FLUSH PRIVILEGES;

-- 4. (Optional) If MySQL binary logging blocks routine/trigger creation,
--    enable trusted routine/trigger creators. This should be run by root/admin:
--    SET GLOBAL log_bin_trust_function_creators = 1;

-- Verification query (run as root or havenstay_test):
-- SELECT user, host FROM mysql.user WHERE user='havenstay_test';
-- SHOW GRANTS FOR 'havenstay_test'@'127.0.0.1';
