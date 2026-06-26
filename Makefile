.PHONY: up down build logs clean config test-backend test-frontend format analyse refresh share

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build --no-cache

logs:
	docker compose logs -f

clean:
	docker compose down -v
	docker system prune -f

config:
	docker compose config

test-backend:
	docker compose exec backend php artisan test

test-frontend:
	docker compose exec frontend npm test

format:
	docker compose run --rm backend composer format
	cd frontend && npm run format

analyse:
	docker compose run --rm backend composer analyse
	cd frontend && npm run lint

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
	cp backend/.env.docker backend/.env
	@echo "Backend environment set to Docker (MySQL Primary/Replica)"

env-native:
	cp backend/.env.example backend/.env
	@echo "Backend environment set to Native (SQLite)"

refresh:
	@chmod +x refresh.sh
	./refresh.sh

share:
	@chmod +x share.sh
	./share.sh

