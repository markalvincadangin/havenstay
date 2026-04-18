-- Create dedicated replication user with legacy compatibility for non-SSL Docker links
-- Note: --mysql-native-password=ON must be set in the mysqld command section
CREATE USER IF NOT EXISTS 'replica_user'@'%' 
  IDENTIFIED WITH mysql_native_password BY 'replica_pass';
GRANT REPLICATION SLAVE ON *.* TO 'replica_user'@'%';
FLUSH PRIVILEGES;
