# HavenStay BHMS — Production Deployment & Architecture Guide

**Platform Engineering & Deployment Reference**  
*Optimized for Zero-Cost Cloud Hosting, High Availability, and Portfolio Demonstration*

---

## Table of Contents

1. [Architectural Overview & Topology](#1-architectural-overview--topology)
2. [Free-Tier Deployment Strategies Comparison](#2-free-tier-deployment-strategies-comparison)
3. [Strategy 1: Decoupled PaaS (Vercel + Render + Aiven)](#3-strategy-1-decoupled-paas-vercel--render--aiven)
4. [Strategy 2: Always-On Free Cloud VPS (Oracle Cloud Always Free)](#4-strategy-2-always-on-free-cloud-vps-oracle-cloud-always-free)
5. [Strategy 3: On-Demand Live Portfolio Showcase (Cloudflare Tunnel)](#5-strategy-3-on-demand-live-portfolio-showcase-cloudflare-tunnel)
6. [Cold-Start Mitigation for Free PaaS](#6-cold-start-mitigation-for-free-paas)
7. [Database Constraint: MySQL 8.4 & 45 Forensic Triggers](#7-database-constraint-mysql-84--45-forensic-triggers)
8. [First-Deploy Execution Sequence](#8-first-deploy-execution-sequence)
9. [Automated Verification & Smoke Testing](#9-automated-verification--smoke-testing)
10. [Portfolio Presentation & Resume Playbook](#10-portfolio-presentation--resume-playbook)

---

## 1. Architectural Overview & Topology

HavenStay BHMS is designed as an enterprise decoupled multi-tier web application:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 CLIENT LAYER                                    │
│   Web Browser (Global HTTPS)                                                    │
└────────────────────────┬────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                FRONTEND TIER                                    │
│   Next.js 16 App Router (React 19, Tailwind v4, Lucide Icons, Standalone Node)  │
│   • Edge caching & SSR                                                          │
│   • Same-origin server-side rewrite: /api/:path* ──► Backend API                │
└────────────────────────┬────────────────────────────────────────────────────────┘
                         │ (Internal Server-to-Server REST + Bearer Token)
                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 BACKEND TIER                                    │
│   Laravel 13 API (PHP 8.4+, Apache mod_rewrite, OPcache Enabled)                │
│   • Form request validation & domain services                                   │
│   • AuditService correlation context injection                                  │
│   • Read/Write Connection Routing (DB_WRITE_HOST vs DB_READ_HOST)               │
└──────────────┬──────────────────────────────────────────┬───────────────────────┘
               │ (Mutations & Writes)                     │ (Read-Heavy Queries)
               ▼                                          ▼
┌──────────────────────────────────────┐  GTID    ┌───────────────────────────────┐
│       MySQL 8.4 Primary Node         ├─────────►│     MySQL 8.4 Read Replica    │
│   • 45 Database Forensic Triggers    │  Replic. │   • Analytics & Reporting     │
│   • audit_logs before/after diffs    │          │   • Read-only enforcement     │
│   • ACID Transactional Consistency   │          │   • Reduced primary locks     │
└──────────────────────────────────────┘          └───────────────────────────────┘
```

---

## 2. Free-Tier Deployment Strategies Comparison

HavenStay can be deployed 100% free using multiple architectures depending on your portfolio goals:

| Strategy | Frontend | Backend | Database | Best For | Pros | Considerations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Strategy 1: Decoupled PaaS** | **Vercel** (Hobby) | **Render** (Free Web Service) | **Aiven** / **Railway** (MySQL) | Quick portfolio link, zero server maintenance | • Automatic Git CI/CD<br/>• Global edge CDN on UI<br/>• Zero server maintenance | • Render sleeps after 15m inactivity (~30s cold start)<br/>• Read replica requires Aiven multi-node |
| **Strategy 2: Always-On Free VPS** | **Docker** (Container) | **Docker** (Container) | **Docker** (Primary + Replica) | **Senior DevOps portfolio flex**, realistic production cluster | • **Zero cold starts** (runs 24/7)<br/>• Live MySQL read replica with GTID replication<br/>• Full Docker parity (`docker-compose.prod.yml`) | • Requires 1-time setup of Oracle Cloud VM or $4/mo VPS |
| **Strategy 3: On-Demand Tunnel** | Local Next.js | Local Laravel | Local Primary/Replica | Live technical interview / client demo | • Zero cloud setup<br/>• 100% fidelity<br/>• Instant 1-command startup (`make share`) | • Only online while laptop/PC is running |

---

## 3. Strategy 1: Decoupled PaaS (Vercel + Render + Aiven)

### 3.1 Database: Aiven Managed MySQL 8
1. Register at [Aiven Console](https://console.aiven.io).
2. Create service: **MySQL** -> Select region `asia-southeast1` (Singapore) to match Render Singapore.
3. Collect credentials from Overview tab:
   - Host (`DB_WRITE_HOST` / `DB_READ_HOST`)
   - Port (default `3306`)
   - User (`DB_USERNAME`)
   - Password (`DB_PASSWORD`)
   - Database name (`DB_DATABASE`)

### 3.2 Backend: Render Docker Web Service
Render uses the repository root `render.yaml` blueprint or manual setup:
- **Environment**: Docker
- **Root Directory**: `backend`
- **Dockerfile Path**: `Dockerfile`
- **Docker Target**: `production`
- **Health Check Path**: `/api/health`

**Render Environment Variables:**
```dotenv
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:hWXurcwNFyI1ySTdsK8mAxcYUn7VyB3P3fbcNXA8iQw=
APP_URL=https://havenstay-backend.onrender.com
FRONTEND_URL=https://havenstay.vercel.app

DB_CONNECTION=mysql
DB_HOST=<aiven-mysql-host>
DB_PORT=<aiven-mysql-port>
DB_DATABASE=havenstay_db
DB_USERNAME=<aiven-mysql-user>
DB_PASSWORD=<aiven-mysql-password>
DB_WRITE_HOST=<aiven-mysql-host>
DB_READ_HOST=<aiven-mysql-host>
DB_STICKY=true

LOG_CHANNEL=errorlog
SESSION_DRIVER=database
CACHE_STORE=database

# First deploy only: set to true to seed demo accounts, then change to false
DB_SEED=false
```

### 3.3 Frontend: Vercel Next.js Deployment
1. Import repository at [vercel.com/new](https://vercel.com/new).
2. Set Root Directory to `frontend`.
3. Set Environment Variable in Vercel Dashboard:
   - `BACKEND_INTERNAL_URL`: `https://havenstay-backend.onrender.com`
   - `NEXT_PUBLIC_API_BASE_URL`: `""` (empty string for same-origin proxying)
4. Deploy. Vercel automatically builds the Next.js App Router standalone build.

---

## 4. Strategy 2: Always-On Free Cloud VPS (Oracle Cloud Always Free) — Recommended

For a portfolio that stands out to senior engineering leads and platform architects, running the entire stack via `docker-compose.prod.yml` on an **Oracle Cloud Always Free Ampere A1 VM** provides an always-on, cold-start-free production demonstration.

### 4.1 Oracle Cloud Free Tier Specs
- **4 OCPU ARM Ampere A1 Compute cores**
- **24 GB RAM**
- **200 GB NVMe Storage**
- **Free Public IPv4 Address**
- **Cost**: $0.00 / month forever (No expiration or credit card drain)

### 4.2 Step 1: Provision the Free Instance on OCI
1. Register at [Oracle Cloud Infrastructure (OCI)](https://www.oracle.com/cloud/free/).
2. Navigate to **Compute** -> **Instances** -> **Create Instance**:
   - **Image**: Ubuntu 24.04 LTS (Minimal or Server)
   - **Shape**: Change Shape -> **Ampere** -> `VM.Standard.A1.Flex` -> 2 to 4 OCPU, 12 to 24 GB RAM (Always Free Eligible).
   - **Networking**: Select a public subnet and ensure **Assign a public IPv4 address** is checked.
   - **SSH Keys**: Download your private key or upload your local public key (`~/.ssh/id_rsa.pub`).
3. Click **Create** and copy the **Public IP Address**.

### 4.3 Step 2: Open Ingress Ports in Oracle Cloud VCN
Oracle Cloud blocks incoming ports 80 and 443 at the cloud virtual network layer by default:
1. In the OCI Console, go to **Virtual Cloud Networks** -> Click your VCN -> Click your **Public Subnet** -> Click **Default Security List**.
2. Click **Add Ingress Rules**:
   - **Source CIDR**: `0.0.0.0/0`
   - **IP Protocol**: TCP
   - **Destination Port Range**: `80,443`
   - **Description**: Allow HTTP and HTTPS web traffic

### 4.4 Step 3: (Optional) Point a Domain or Free DuckDNS Subdomain
For automated Let's Encrypt SSL:
- **Custom Domain**: Create an `A` record pointing `havenstay.yourdomain.com` -> `<your-vps-ip>`.
- **Free Subdomain**: Use [DuckDNS](https://www.duckdns.org/) to create a free domain `havenstay-portfolio.duckdns.org` pointing to `<your-vps-ip>`.
- If you don't have a domain yet, Caddy will serve the site directly via your VPS IP on port 80.

### 4.5 Step 4: Automated 1-Command Deployment on VPS
1. SSH into the VM:
   ```bash
   ssh -i /path/to/key.pem ubuntu@<your-vps-ip>
   ```
2. Clone repository:
   ```bash
   git clone https://github.com/markalvincadangin/havenstay.git
   cd havenstay
   ```
3. Run the automated VPS deployment script:
   ```bash
   ./scripts/deploy-vps.sh
   # Or via Makefile:
   # make deploy
   ```
   *What this script does automatically:*
   - Checks/installs Docker and Docker Compose v2.
   - Configures the host firewall (`iptables` and `ufw` for ports 80, 443, 22).
   - Auto-generates cryptographically strong database passwords and Laravel `APP_KEY`.
   - Prompts for your domain (or defaults to port 80 HTTP).
   - Launches Caddy, Next.js 16 standalone, Laravel 13, and MySQL 8.4 primary-replica cluster.
   - Runs healthchecks and outputs your live portfolio URL.

### 4.6 Step 5: Automated CI/CD via GitHub Actions
To automatically deploy new commits from `main`:
1. In your GitHub repository, go to **Settings** -> **Secrets and variables** -> **Actions**.
2. Add the following repository secrets:
   - `VPS_HOST`: `<your-vps-ip>`
   - `VPS_USER`: `ubuntu`
   - `VPS_SSH_KEY`: Content of your private SSH key (`id_rsa` or downloaded `.pem`)
3. Every push to `main` will automatically trigger `.github/workflows/deploy-vps.yml` to test, pull changes, and rebuild containers with zero downtime.

### 4.7 Production Operational Commands
```bash
# View live aggregated production logs
make prod-logs

# Check container health and GTID replication status
make prod-ps
./scripts/smoke-test.sh

# Restart production cluster
docker compose -f docker-compose.prod.yml restart

# Stop production cluster
make prod-down
```

---

## 5. Strategy 3: On-Demand Live Portfolio Showcase (Cloudflare Tunnel)

If you are demoing HavenStay live during an interview or presentation:

1. Start your local cluster:
   ```bash
   make up
   ```
2. Start the Cloudflare Tunnel:
   ```bash
   make share
   ```
3. A public, secure HTTPS URL is automatically generated (e.g. `https://random-word.trycloudflare.com`).
4. Share the URL with interviewers. The tunnel auto-configures Next.js hot-reloading and routes all API calls to your local MySQL primary and read replica!

---

## 6. Cold-Start Mitigation for Free PaaS

If you deploy using **Render Free Tier**, the web service spins down after 15 minutes of inactivity. When a reviewer visits your portfolio, the first request may take ~30 seconds to spin up.

### Automated Keep-Alive Heartbeat
To keep your Render backend warm during job application cycles:
1. Register a free account at [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com).
2. Create a monitor to ping:
   ```
   GET https://havenstay-backend.onrender.com/api/health
   ```
3. Interval: Every 14 minutes.
4. Result: Zero cold starts. The API stays warm 24/7 without incurring charges.

---

## 7. Database Constraint: MySQL 8.4 & 45 Forensic Triggers

HavenStay enforces forensic data integrity via **45 MySQL database triggers**:
- 13 standard operational tables × 3 AFTER triggers (INSERT/UPDATE/DELETE) = 39 triggers
- 1 meter assignments table × 4 triggers (3 AFTER + 1 BEFORE INSERT invariant guard) = 4 triggers
- 1 audit logs table × 2 BEFORE triggers (UPDATE/DELETE immutability prevention) = 2 triggers
- **Total Forensic Engine: 45 triggers**

> [!WARNING]
> Do NOT use Postgres, SQLite, or serverless MySQL abstractions (such as PlanetScale) that prohibit triggers or foreign key cascades. The database must run authentic MySQL 8.0 or 8.4 with InnoDB.

---

## 8. First-Deploy Execution Sequence

Follow this sequence for the initial deployment:

1. **Deploy Database**: Provision MySQL 8 on Aiven or start `db-primary` and `db-replica` in Docker.
2. **Deploy Backend**:
   - Set environment variables.
   - For the **first boot**, set `DB_SEED=true` to automatically execute `php artisan migrate --force` and `php artisan db:seed --force`.
   - Verify `/api/health` returns `{"status":"ok","database":"connected"}`.
   - Update `DB_SEED=false` for ongoing deploys to prevent re-seeding.
3. **Deploy Frontend**:
   - Connect GitHub repository to Vercel.
   - Configure `BACKEND_INTERNAL_URL` pointing to backend.
   - Test login with seeded admin credentials.

---

## 9. Automated Verification & Smoke Testing

Run the automated smoke test script after any deployment:

```bash
make smoke-test
```

**Verification Checklist:**
- [x] Backend direct health check (`GET :8000/api/health` -> 200 OK)
- [x] Frontend Next.js server (`GET :3000` -> 200 OK)
- [x] Next.js API rewrite proxy (`GET :3000/api/health` -> proxied)
- [x] MySQL Primary ping & write connection
- [x] MySQL Read Replica ping
- [x] GTID Replication status (`Replica_IO_Running: Yes`, `Replica_SQL_Running: Yes`, `Seconds_Behind_Source: 0`)

---

## 10. Portfolio Presentation & Resume Playbook

When featuring HavenStay on your developer portfolio or CV:

### Resume Bullet Points
- **Architected Decoupled Full-Stack System**: Built an enterprise boarding house management platform with Laravel 13 REST API and Next.js 16 App Router using Docker Compose multi-stage builds.
- **Engineered Zero-Trust Forensic Audit Layer**: Designed 45 database triggers capturing row-level before/after JSON diffs independently of application code with MySQL 8.4 primary-replica GTID replication.
- **Containerized DevOps Pipeline**: Standardized isolated development and production Docker environments with automated healthchecks, non-root security contexts, and sub-2-second test execution.

### Live Demo Presentation
- **Live URL**: `https://havenstay.vercel.app` (or custom domain)
- **Demo Credentials**:
  - **Admin**: `havenstay.admin@havenstay.com` / `HavenStay123!`
  - **Staff**: `havenstay.staff@havenstay.com` / `HavenStay123!`
  - **Viewer**: `viewer@havenstay.com` / `HavenStay123!`
- **Key Flow to Show Recruiters**:
  1. Login as Admin.
  2. Navigate to **Audit Logs** -> show real-time trigger-generated diffs.
  3. Perform a room status update -> inspect the immediate before/after snapshot.
  4. Show read-replica KPI queries on the main dashboard.
