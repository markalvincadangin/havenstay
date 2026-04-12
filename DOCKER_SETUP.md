# HavenStay Docker Setup Guide 🐳

This guide helps you set up the full HavenStay development environment (Backend, Frontend, and Distributed Databases) using Docker. This setup mirrors the production environment on Render and Aiven.

---

## 1. Prerequisites
*   Install **Docker Desktop** (Required)
*   Ensure **Docker Desktop is running** (the icon in the tray should be Green)
*   (Windows only) Ensure **WSL2** is enabled and Docker is configured to use the WSL2 backend.

---

## 2. Initial Setup
Open your terminal in the project root folder and run:

```bash
# Start all containers in the background
docker compose up --build -d
```

This will spin up 4 containers:
1.  **`havenstay-db-primary`**: Main Database (Port 3306)
2.  **`havenstay-db-replica`**: Read-only Replica (Port 3307)
3.  **`havenstay-backend`**: Laravel API (Port 8000)
4.  **`havenstay-frontend`**: Next.js App (Port 3000)

---

## 3. Database Initialization (CCR-008 & CCR-003)
Once the containers are "Running", build your tables and seed the data:

```bash
docker compose exec backend php artisan migrate:fresh --seed
```

---

## 4. Replication Setup (CCR-002)
To link the Replica to the Primary (to satisfy the distributed requirement):

1.  **Access the Replica**:
    ```bash
    docker exec -it havenstay-db-replica mysql -u root -p
    ```
    *(Password is `root`)*

2.  **Run the link command**:
    ```sql
    STOP REPLICA;
    CHANGE REPLICATION SOURCE TO
      SOURCE_HOST = 'db-primary',
      SOURCE_PORT = 3306,
      SOURCE_USER = 'root',
      SOURCE_PASSWORD = 'root',
      SOURCE_AUTO_POSITION = 1;
    START REPLICA;
    ```

3.  **Verify**:
    ```sql
    SHOW REPLICA STATUS\G;
    ```
    *`Replica_IO_Running` and `Replica_SQL_Running` should both be **Yes**.*

---

## 5. Accessing the Applications
| Service | URL | Credentials |
| :--- | :--- | :--- |
| **Frontend** | [http://localhost:3000](http://localhost:3000) | `admin@havenstay.ph` / `HavenStay123!` |
| **Backend API** | [http://localhost:8000/api/health](http://localhost:8000/api/health) | - |
| **Primary DB** | `localhost:3306` | root / root |
| **Replica DB** | `localhost:3307` | root / root |

---

## 6. Common Commands
*   **Stop everything**: `docker compose stop`
*   **Start again**: `docker compose start`
*   **Destroy everything (Reset)**: `docker compose down -v` (This deletes the local data volumes too)
*   **View Logs**: `docker compose logs -f backend`
