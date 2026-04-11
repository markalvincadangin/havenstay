# HavenStay Distributed Database Setup (MySQL 8.4+)

## Purpose
This guide configures Source-Replica replication for HavenStay on Windows using Laragon. This satisfies the **CCR-002** course requirement for a distributed database.

---

## 1. Executive Summary
- **GTID-based replication**: The default path for MySQL 8.4+.
- **Snapshot Integrity**: Use consistent dumps for initialization.
- **Security**: Lease-privilege replication users and TLS transport.

---

## 3. Topology

| Parameter | Source (Primary) | Replica |
| :--- | :--- | :--- |
| **Address** | `127.0.0.1:3306` | `127.0.0.1:3307` |
| **User** | `root` | `replica` |
| **GTID Mode** | `ON` | `ON` |

---

## 6. Validation (CCR-002)

On the **Replica** (3307), run the following command to verify health:

```sql
SHOW REPLICA STATUS;
```

> [!NOTE]
> For a successful deployment, `Replica_IO_Running` and `Replica_SQL_Running` must both report `Yes`.

---

*For application-side routing details, refer to [**SDD.md**](SDD.md).*
