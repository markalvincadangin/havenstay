# HavenStay Boarding House Management System (BHMS)
## Distributed Database Setup: Primary-Replica Topology

**Version:** 1.2  
**Last Updated:** May 02, 2026  
**Status:** Stable - Technical Infrastructure Guide

---

## Table of Contents

1. [Overview](#1-overview)
2. [Topology Configuration](#2-topology-configuration)
3. [Phase 1: Primary Setup](#3-phase-1-primary-setup)
4. [Phase 2: Replica Provisioning](#4-phase-2-replica-provisioning)
5. [Phase 3: Laravel Integration](#5-phase-3-laravel-integration)
6. [Troubleshooting: Error 1236](#6-troubleshooting-error-1236)
7. [Revision History](#7-revision-history)

---

## 1. Overview

HavenStay utilizes a Primary-Replica topology. The Primary instance handles all write operations (`INSERT`, `UPDATE`, `DELETE`), while the Replica instance handles intensive read operations (`SELECT` for reports and dashboard views).

## 2. Topology Configuration

| Component | Host | Port | Role |
| :--- | :--- | :--- | :--- |
| **Primary** | `127.0.0.1` | `3306` | Source of Truth (RW) |
| **Replica** | `127.0.0.1` | `3307` | Reporting Node (RO) |

- **GTID Mode**: Enabled (`ON`)
- **Binary Logging**: Enabled on Primary

## 3. Phase 1: Primary Setup (Laravel)

> [!IMPORTANT]
> **Replication Ordering Dependency:** The scripts in `docker/` (`primary-init.sql`, `replica-init.sql`) only configure the replication users; they do *not* source the schema. The schema is applied by Laravel's migration runner. Therefore, MySQL replication must be **actively running** (`SHOW REPLICA STATUS` returning `Yes` for both IO and SQL threads) **before** executing `migrate:fresh`. If migrations run before replication is established, `db-replica` will silently miss the tables and all 45 forensic triggers.

1. In **`backend/.env`**, set **`DB_READ_PORT=3306`** (identical to primary) to allow migrations to run.
2. Confirm replication is active:
   ```bash
   docker compose exec db-replica mysql -uroot -p -e "SHOW REPLICA STATUS\G"
   # Verify Slave_IO_Running and Slave_SQL_Running are both 'Yes'
   ```
3. Initialize the database schema and triggers:
   ```bash
   cd backend
   php artisan migrate:fresh --seed
   ```

## 4. Phase 2: Replica Provisioning

1. **Dump the Primary**:
   ```bash
   mysqldump -h 127.0.0.1 -P 3306 -u root -p --single-transaction --routines --triggers --set-gtid-purged=ON --databases havenstay_db > %TEMP%\snapshot.sql
   ```
2. **Prepare the Replica (3307)**:
   ```sql
   STOP REPLICA;
   RESET REPLICA ALL;
   RESET BINARY LOGS AND GTIDS;
   ```
3. **Import Snapshot**:
   ```bash
   mysql -h 127.0.0.1 -P 3307 -u root -p < %TEMP%\snapshot.sql
   ```
4. **Initiate Replication**:
   ```sql
   CHANGE REPLICATION SOURCE TO
     SOURCE_HOST = '127.0.0.1',
     SOURCE_PORT = 3306,
     SOURCE_USER = 'replica',
     SOURCE_PASSWORD = 'your_replica_user_password',
     SOURCE_AUTO_POSITION = 1;
   START REPLICA;
   ```

## 5. Phase 3: Laravel Integration

Once replication is healthy (`Replica_IO_Running: Yes`), update the application to utilize the distributed architecture:

1. Update **`backend/.env`**:
   ```env
   DB_READ_PORT=3307
   ```
2. Clear configuration cache:
   ```bash
   php artisan config:clear
   ```

## 6. Troubleshooting: Error 1236

**Problem**: "Source purged required binary logs." Happens when the Primary has deleted binary logs the Replica still needs.

**Local Solution**: Perform a fresh re-seed:
1. Reset Primary: `RESET BINARY LOGS AND GTIDS;`
2. Re-run Phase 2 (Dump and Import).

---

## 7. Revision History

| Version | Date | Changes |
| :--- | :--- | :--- |
| v1.0 | 2026-04-10 | Initial setup guide. |
| v1.1 | 2026-04-25 | Added Error 1236 troubleshooting section. |
| **v1.2** | **2026-05-02** | **Standardized formatting and aligned with HavenStay Documentation Standard.** |

---

*Document Author: HavenStay Database Engineering*
