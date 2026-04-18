-- Configure replication using the dedicated user
-- GET_SOURCE_PUBLIC_KEY=1 is added for caching_sha2_password compatibility over non-SSL

CHANGE REPLICATION SOURCE TO
  SOURCE_HOST = 'db-primary',
  SOURCE_PORT = 3306,
  SOURCE_USER = 'replica_user',
  SOURCE_PASSWORD = 'replica_pass',
  SOURCE_AUTO_POSITION = 1,
  GET_SOURCE_PUBLIC_KEY = 1;

START REPLICA;
