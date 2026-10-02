-- ============================================================
-- HavenStay MySQL Replica — Replication Source Setup
-- ============================================================
-- Connects to db-primary using GTID and caching_sha2_password over Docker network
STOP REPLICA;
CHANGE REPLICATION SOURCE TO
  SOURCE_HOST = 'db-primary',
  SOURCE_PORT = 3306,
  SOURCE_USER = 'replica_user',
  SOURCE_PASSWORD = 'replica_pass',
  SOURCE_AUTO_POSITION = 1,
  GET_SOURCE_PUBLIC_KEY = 1;
START REPLICA;
