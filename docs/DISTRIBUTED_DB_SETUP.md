# HavenStay distributed database (CCR-002)

Primary **127.0.0.1:3306**, replica **127.0.0.1:3307**, GTID **ON**.

**Laravel:** keep **`DB_READ_PORT=3306`** until replication is green, then **`3307`**.

---

## Error 1236 — “source purged required binary logs”

The primary still **remembers** old GTIDs, but those events are **gone** from disk. A fresh replica (`gtid` empty) cannot catch up. **Local dev fix:** reset GTIDs + binlogs on the **primary** once, then re-seed and re-clone the replica (this **destroys** prior binlog history on the primary—only do this when you can lose it).

**1. Primary (root, port 3306)**

```sql
RESET BINARY LOGS AND GTIDS;
```

**2. Primary — recreate app DB + migrate + seed** (Laravel; **`DB_READ_PORT=3306`** in `.env`)

```bash
cd backend
php artisan migrate:fresh --seed
```

**3. Dump primary immediately** (replace `havenstay_db` with your `DB_DATABASE`)

```bash
mysqldump -h 127.0.0.1 -P 3306 -u root -p --single-transaction --routines --triggers --set-gtid-purged=ON --databases havenstay_db > %TEMP%\snapshot.sql
```

**4. Replica (3307)**

```sql
STOP REPLICA;
RESET REPLICA ALL;
RESET BINARY LOGS AND GTIDS;
```

```bash
mysql -h 127.0.0.1 -P 3307 -u root -p < %TEMP%\snapshot.sql
```

```sql
CHANGE REPLICATION SOURCE TO
  SOURCE_HOST = '127.0.0.1',
  SOURCE_PORT = 3306,
  SOURCE_USER = 'replica',
  SOURCE_PASSWORD = 'your_password',
  SOURCE_AUTO_POSITION = 1;
START REPLICA;
```

**5.** `SHOW REPLICA STATUS\G` — both threads **Yes**. Then set **`DB_READ_PORT=3307`** and `php artisan config:clear`.

On the primary, consider keeping binlogs longer so this happens less often: `SET PERSIST binlog_expire_logs_seconds = 604800;` (example: 7 days).

---

## Phase 1 — Primary only (Laravel)

1. In **`backend/.env`**, keep **`DB_READ_PORT=3306`** (same as the primary). Laravel sends **SELECT**s to the read host; if that is **3307** before the replica has your database, **`migrate`** fails with **1049**.
2. On **3306**, create the app database if needed:  
   `CREATE DATABASE … CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;` (name = **`DB_DATABASE`**).
3. Run **`php artisan migrate:fresh --seed`** (against the primary).

---

## Phase 2 — Fix the replica (MySQL only)

Use the **same database name** as **`DB_DATABASE`** in the dump (examples use `havenstay_db`).

**1. Dump the primary**

```bash
mysqldump -h 127.0.0.1 -P 3306 -u root -p --single-transaction --routines --triggers --set-gtid-purged=ON --databases havenstay_db > %TEMP%\snapshot.sql
```

**2. On the replica (3307)**

```sql
STOP REPLICA;
RESET REPLICA ALL;
RESET BINARY LOGS AND GTIDS;
```

**3. Import**

```bash
mysql -h 127.0.0.1 -P 3307 -u root -p < %TEMP%\snapshot.sql
```

**4. Attach and start**

```sql
CHANGE REPLICATION SOURCE TO
  SOURCE_HOST = '127.0.0.1',
  SOURCE_PORT = 3306,
  SOURCE_USER = 'replica',
  SOURCE_PASSWORD = 'your_replica_user_password',
  SOURCE_AUTO_POSITION = 1;
START REPLICA;
```

**5. Verify**

```sql
SHOW REPLICA STATUS\G
```

`Replica_IO_Running` and `Replica_SQL_Running` should be **Yes**.

Replication **1236** after primary changes: repeat Phase 2 (dump → reset replica → import → `CHANGE REPLICATION SOURCE` → `START REPLICA`).

---

## Phase 3 — Laravel reads from the replica

When Phase 2 is healthy, in **`backend/.env`** set **`DB_READ_PORT=3307`**, then:

```bash
php artisan config:clear
```

--- Standard database migrations are used for the primary instance. Application routing: [**SDD.md**](SDD.md).
