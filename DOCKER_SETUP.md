# HavenStay Docker Setup Guide 🐳

This guide helps you set up the full HavenStay development environment (Backend, Frontend, and Distributed Databases) using Docker. This setup perfectly mirrors the production environment on Render and Aiven, satisfying **CCR-002**.

---

## 1. Prerequisites
*   Install **Docker Desktop** (Required)
*   Ensure **Docker Desktop is running** (the icon in the tray should be Green)
*   (Windows only) Ensure **WSL2** is enabled and Docker is configured to use the WSL2 backend.

---

## 2. Hardened Architecture (Release 1.3)
HavenStay now uses a **Primary-Replica** distributed database stack with automatic health checks and automated synchronization:
*   **Primary DB**: Authoritative source for all writes/transactions.
*   **Replica DB**: Read-only instance for reporting and dashboards.
*   **Auto-Healing**: If any container crashes, Docker automatically restarts it.
*   **Auto-Sync**: Replication is automatically configured on first boot via `docker-entrypoint-initdb.d` scripts.
*   **Traffic Splitting**: The backend automatically routes `SELECT` queries to the replica and `INSERT/UPDATE/DELETE` to the primary.

---

## 3. Initial Setup
Open your terminal in the project root folder and run:

```bash
# Start all containers in the background
docker compose up --build -d
```

This will spin up 4 specialized containers:
1.  **`havenstay-db-primary`**: Main Database (Internal: 3306 | External: 3306)
2.  **`havenstay-db-replica`**: Read-only Replica (Internal: 3306 | External: 3307)
3.  **`havenstay-backend`**: Laravel API (Port 8000)
4.  **`havenstay-frontend`**: Next.js App (Port 3000)

---

## 4. Database Initialization (CCR-008 & CCR-003)
The backend container is configured to run pending migrations automatically on startup without wiping data. For the **first-time setup**, you must manually seed the database:

```bash
# Run this once to build tables and populate demo data
docker compose exec backend php artisan migrate:fresh --seed
```

> [!WARNING]
> Only run `migrate:fresh` if you want to wipe all data. Subsequent restarts of the container will safely run `php artisan migrate` to apply new changes without data loss.

---

## 5. Replication Verification (CCR-002)
Replication is now **fully automated** during the first container boot. To verify the link:

1.  **Access the Replica**:
    ```bash
    docker exec -it havenstay-db-replica mysql -u root -proot
    ```

2.  **Check Status**:
    ```sql
    SHOW REPLICA STATUS\G;
    ```
    *`Replica_IO_Running` and `Replica_SQL_Running` should both be **Yes**.*

---

## 6. Accessing the Applications
The UI calls **same-origin** `/api/*` on port 3000; Next.js proxies those requests to the `backend` container. Set **`BACKEND_INTERNAL_URL`** in `docker-compose.yml` (frontend service) or at **image build** time (`frontend/Dockerfile` `ARG`) so rewrites target `http://backend`, not `127.0.0.1` (which would be wrong inside a container). You can still hit Laravel directly on port 8000 for health checks or debugging.

| Service | URL | Credentials |
| :--- | :--- | :--- |
| **Frontend** | [http://localhost:3000](http://localhost:3000) | `admin@havenstay.ph` / `HavenStay123!` |
| **Backend API** | [http://localhost:8000/api/health](http://localhost:8000/api/health) | - |
| **Primary DB** | `localhost:3306` | root / root |
| **Replica DB** | `localhost:3307` | root / root (Read-Only) |

---

## 7. Development Flow & Hot-Reloading
The environment is now optimized for professional development with **Hot-Reloading** enabled by default:
- **Frontend Changes**: Modifying files in `./frontend` will trigger an immediate update in the browser thanks to Next.js `dev` mode and Docker bind mounts.
- **Backend Changes**: Logic changes in `./backend` reflect on the next request.
- **Node Modules**: The container uses its own `node_modules` (cached in an anonymous volume) to ensure compatibility with the Alpine Linux environment.

### Production Build Simulation
To test the production behavior locally (where code is baked into the image and minified):
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

---

## 8. Common Commands
*   **Standard Dev Start**: `docker compose up -d`
*   **Rebuild after package.json changes**: `docker compose up --build -d`
*   **Stop everything**: `docker compose stop`
*   **Destroy everything (Reset)**: `docker compose down -v`
*   **View Logs**: `docker compose logs -f frontend`
*   **Reset Application Cache**: `docker exec havenstay-backend php artisan config:clear`
