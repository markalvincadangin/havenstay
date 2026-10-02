-- ============================================================
-- HavenStay MySQL Primary — Replication User Setup
-- ============================================================
-- Creates the replication user with caching_sha2_password for MySQL 8.4+
CREATE USER IF NOT EXISTS 'replica_user'@'%' IDENTIFIED BY 'replica_pass';
ALTER USER 'replica_user'@'%' IDENTIFIED BY 'replica_pass';
GRANT REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO 'replica_user'@'%';
FLUSH PRIVILEGES;
