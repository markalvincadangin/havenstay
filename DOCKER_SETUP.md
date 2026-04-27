# HavenStay Docker Guide 🐳

This guide focuses on the containerized development environment for HavenStay. For a comparison with manual or tunnel-based setups, see the **[Development Setup Guide](./docs/DEV_SETUP.md)**.

---

## 1. Hardened Architecture (CCR-002)

HavenStay uses a **Primary-Replica** database stack to satisfy academic and performance requirements:

- **`havenstay-db-primary`**: Authoritative source for all writes.
- **`havenstay-db-replica`**: Read-only instance for reporting.
- **Auto-Sync**: Replication is configured on first boot via `docker/primary-init.sql` and `docker/replica-init.sql`.

---

## 2. Quick Start

```bash
# 1. Start containers
docker compose up --build -d

# 2. Initialize database (First time only)
docker compose exec backend php artisan migrate:fresh --seed
```

---

## 3. Service Map

| Service | Host URL | Port | Internal |
| :--- | :--- | :--- | :--- |
| **Frontend** | [localhost:3000](http://localhost:3000) | 3000 | 3000 |
| **Backend API** | [localhost:8000](http://localhost:8000) | 8000 | 80 |
| **Primary DB** | `localhost:3306` | 3306 | 3306 |
| **Replica DB** | `localhost:3307` | 3307 | 3306 |

---

## 4. Port Forwarding / Tunneling

If you need to test HavenStay with **TestSprite** or **Vercel Previews**, you must expose your local Docker environment.

1. **Expose Backend**: `ngrok http 8000`.
2. **Expose Frontend**: `ngrok http 3000`.
3. Follow the **[Profile C: Port-Forwarding Guide](./docs/DEV_SETUP.md#profile-c--port-forwarding--tunnel)** to update your `.env` files.

---

## 5. Troubleshooting

- **Database Connection Refused**: Ensure `db-primary` is healthy (`docker compose ps`).
- **Replica Lag**: Check status with `docker exec -it havenstay-db-replica mysql -u root -proot -e "SHOW REPLICA STATUS\G"`.
- **Hot-Reload not working**: Ensure `WATCHPACK_POLLING=true` is set in `docker-compose.yml` (required for Windows/WSL2).

Detailed troubleshooting and manual setup can be found in **[docs/DEV_SETUP.md](./docs/DEV_SETUP.md)**.
