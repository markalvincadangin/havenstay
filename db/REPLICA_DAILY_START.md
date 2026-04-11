# Replica Daily Start Automation

Use this script each fresh start to verify and repair MySQL replica state.

## Script
- File: db/replica_daily_start.ps1
- Default topology: source 127.0.0.1:3306, replica 127.0.0.1:3307

## Recommended Daily Command
From repository root:

powershell -ExecutionPolicy Bypass -File db/replica_daily_start.ps1 -AutoRepair

Or use the batch launcher:

db\\replica_daily_start.bat

## Use .env Credentials (Recommended)
1. Copy template:

copy db\\replica_daily_start.env.example db\\replica_daily_start.env

2. Fill credentials in `db/replica_daily_start.env`:
- `REPLICA_ADMIN_PASSWORD`
- `REPL_PASSWORD`

Default credential behavior:
- `REPLICA_ADMIN_USER` defaults to `root`
- `REPLICA_ADMIN_PASSWORD` is required for admin operations on replica (`SHOW/STOP/RESET/START REPLICA`)
- `REPL_USER` and `REPL_PASSWORD` are used for `CHANGE REPLICATION SOURCE TO`

3. Run script normally (it auto-loads env file):

powershell -ExecutionPolicy Bypass -File db/replica_daily_start.ps1 -AutoRepair

or

db\\replica_daily_start.bat

What it does:
1. Starts replica `mysqld` automatically when replica port is down.
1. Confirms source is reachable.
2. Reads SHOW REPLICA STATUS on replica.
3. If no channel exists yet, initializes a fresh GTID replication channel during repair flow.
3. If unhealthy, attempts:
   - IO thread restart first.
   - Full channel reset for GTID (auto-position) if needed.
   - Optional auto-reseed flow for fatal 1236 when explicitly enabled.
4. Prints final replication health.

`CHANGE REPLICATION SOURCE TO` always uses env replication credentials:
- `REPL_USER`
- `REPL_PASSWORD`

## Force Full Channel Reset
Use this when you know channel metadata is stale:

powershell -ExecutionPolicy Bypass -File db/replica_daily_start.ps1 -AutoRepair -ForceChannelReset

## Optional Parameters
- -EnvFile "db/replica_daily_start.env"
- -MysqlExe "C:/laragon/bin/mysql/mysql-8.4.3-winx64/bin/mysql.exe"
- -MysqldumpExe "C:/laragon/bin/mysql/mysql-8.4.3-winx64/bin/mysqldump.exe"
- -MysqldExe "C:/laragon/bin/mysql/mysql-8.4.3-winx64/bin/mysqld.exe"
- -ReplicaDefaultsFile "C:/laragon/bin/mysql/mysql-8.4.3-winx64/my-replica.ini"
- -StartReplicaIfDown $true
- -ReplicaStartWaitSeconds 20
- -AutoReseedOn1236
- -ReseedDatabases "havenstay"
- -ReseedDumpFile "C:/laragon/tmp/havenstay_reseed.sql"
- -SourceHost, -SourcePort
- -ReplicaHost, -ReplicaPort
- -ReplicaAdminUser (default: root)
- -ReplUser

Passwords are prompted securely when not supplied.

## Exit Codes
- 0: healthy or repaired
- 2: unhealthy and AutoRepair not enabled
- 3: repair attempted but still unhealthy (usually requires fresh reseed)

## Notes
- Script assumes GTID replication setup using SOURCE_AUTO_POSITION = 1.
- By default, script attempts to start replica server if port is not listening.
- If recovery still fails after reset, follow reseed steps in docs/DISTRIBUTED_DB_SETUP.md.
