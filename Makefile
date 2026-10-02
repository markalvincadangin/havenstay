.PHONY: help setup up down restart build logs ps clean config prod-up prod-down prod-logs prod-build test test-backend test-frontend format lint analyse refresh share db-up db-down dev-backend dev-frontend env-docker env-native

# Default target: display helpful command list
help:
	@echo "\n\033[1;36m🏢 HavenStay BHMS — Engineering Command Reference\033[0m\n"
	@echo "\033[1;33mSetup & Initialization:\033[0m"
	@echo "  \033[32mmake setup\033[0m          Initialize .env and backend/.env from docker templates"
	@echo "  \033[32mmake refresh\033[0m        Wipe, re-migrate, and seed demo records (via primary bypass)"
	@echo ""
	@echo "\033[1;33mDevelopment Cluster (Docker Compose):\033[0m"
	@echo "  \033[32mmake up\033[0m             Start all services in detached mode (Next.js, Laravel, DBs)"
	@echo "  \033[32mmake down\033[0m           Stop and remove all development containers"
	@echo "  \033[32mmake restart\033[0m        Restart all development containers"
	@echo "  \033[32mmake build\033[0m          Rebuild all container images from scratch"
	@echo "  \033[32mmake logs\033[0m           Follow aggregated real-time logs from all services"
	@echo "  \033[32mmake ps\033[0m             List running containers and their health statuses"
	@echo "  \033[32mmake clean\033[0m          Stop containers, purge named volumes, and prune docker system"
	@echo "  \033[32mmake config\033[0m         Validate and render the merged docker compose configuration"
	@echo ""
	@echo "\033[1;33mProduction Deployment (Standalone docker-compose.prod.yml):\033[0m"
	@echo "  \033[32mmake prod-up\033[0m        Build and launch isolated production stack (no bind mounts)"
	@echo "  \033[32mmake prod-down\033[0m      Stop and tear down the production stack"
	@echo "  \033[32mmake prod-logs\033[0m      Follow production logs"
	@echo ""
	@echo "\033[1;33mTesting & Code Quality:\033[0m"
	@echo "  \033[32mmake smoke-test\033[0m      Verify all endpoints, proxies, and MySQL replication"
	@echo "  \033[32mmake test\033[0m           Run full test suite (both backend and frontend) in Docker"
	@echo "  \033[32mmake test-backend\033[0m   Run PHPUnit / Pest tests inside backend container"
	@echo "  \033[32mmake test-frontend\033[0m  Run Vitest test suite inside frontend container"
	@echo "  \033[32mmake format\033[0m         Format code using Laravel Pint and Prettier inside containers"
	@echo "  \033[32mmake lint\033[0m           Run PHPStan static analysis and ESLint inside containers"
	@echo ""
	@echo "\033[1;33mRemote Sharing & Hybrid Mode:\033[0m"
	@echo "  \033[32mmake share\033[0m          Start secure Cloudflare tunnel to expose frontend (port 3000)"
	@echo "  \033[32mmake db-up\033[0m          Launch only MySQL primary and replica in Docker"
	@echo "  \033[32mmake db-down\033[0m        Stop and remove database containers"
	@echo ""

# --- SETUP ---
setup:
	@if [ ! -f .env ]; then cp .env.example .env && echo "Created .env from .env.example"; fi
	@if [ ! -f backend/.env ]; then cp backend/.env.docker backend/.env && echo "Created backend/.env from backend/.env.docker"; fi
	@echo "\033[1;32mHavenStay environment configured for Docker development.\033[0m"

# --- DEVELOPMENT CLUSTER ---
up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

build:
	docker compose build --no-cache

logs:
	docker compose logs -f

ps:
	docker compose ps

clean:
	docker compose down -v
	docker system prune -f

config:
	docker compose config

# --- PRODUCTION DEPLOYMENT ---
prod-up:
	docker compose -f docker-compose.prod.yml up -d --build

prod-down:
	docker compose -f docker-compose.prod.yml down

prod-logs:
	docker compose -f docker-compose.prod.yml logs -f

prod-ps:
	docker compose -f docker-compose.prod.yml ps

prod-smoke:
	@chmod +x scripts/smoke-test.sh
	./scripts/smoke-test.sh

deploy:
	@chmod +x scripts/deploy-vps.sh
	./scripts/deploy-vps.sh

# --- TESTING & QUALITY ---
test: test-backend test-frontend

test-backend:
	docker compose exec backend php artisan test

test-frontend:
	docker compose exec frontend npm test

format:
	docker compose exec backend composer format
	docker compose exec frontend npm run format

lint:
	docker compose exec backend composer analyse
	docker compose exec frontend npm run lint

analyse: lint

# --- HYBRID DEV MODE ---
db-up:
	docker compose up -d db-primary db-replica

db-down:
	docker compose rm -s -v -f db-primary db-replica

dev-backend:
	cd backend && php artisan serve

dev-frontend:
	cd frontend && npm run dev

# --- ENVIRONMENT SWITCHERS ---
env-docker:
	@if [ ! -f .env ]; then cp .env.example .env; fi
	cp backend/.env.docker backend/.env
	@echo "Backend environment set to Docker (MySQL Primary/Replica)"

env-native:
	cp backend/.env.example backend/.env
	@echo "Backend environment set to Native (SQLite / Local)"

smoke-test:
	@chmod +x scripts/smoke-test.sh
	./scripts/smoke-test.sh

refresh:
	@chmod +x scripts/refresh.sh
	./scripts/refresh.sh

share:
	@chmod +x scripts/share.sh
	./scripts/share.sh
