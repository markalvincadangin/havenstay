#!/usr/bin/env bash
set -e

echo -e "\n\033[1;36m[ACTION] Refreshing HavenStay Database...\033[0m"

# Check if Docker containers are running (dev or prod)
COMPOSE_FILE=""
if docker compose ps --services --filter "status=running" 2>/dev/null | grep -q "backend"; then
    COMPOSE_FILE="docker compose"
elif docker compose -f docker-compose.prod.yml ps --services --filter "status=running" 2>/dev/null | grep -q "backend"; then
    COMPOSE_FILE="docker compose -f docker-compose.prod.yml"
fi

if [ -n "$COMPOSE_FILE" ]; then
    echo -e "\033[1;33m[INFO] Detected running Docker environment ($COMPOSE_FILE). Executing inside backend container...\033[0m"
    
    echo -e "\033[1;30m[ACTION] Wiping and seeding database (using primary read-host bypass)...\033[0m"
    $COMPOSE_FILE exec -T -e DB_READ_HOST=db-primary backend php -d memory_limit=-1 artisan migrate:fresh --seed --force
    
    echo -e "\033[1;30m[ACTION] Purging backend cache...\033[0m"
    $COMPOSE_FILE exec -T backend php artisan config:clear
    $COMPOSE_FILE exec -T backend php artisan route:clear
    $COMPOSE_FILE exec -T backend php artisan cache:clear
    
    echo -e "\033[1;30m[ACTION] Resetting log files...\033[0m"
    $COMPOSE_FILE exec -T backend sh -c 'rm -f storage/logs/*.log 2>/dev/null || true'
else
    echo -e "\033[1;33m[INFO] No Docker container detected. Executing local PHP environment...\033[0m"
    
    if command -v php >/dev/null 2>&1; then
        cd backend
        echo -e "\033[1;30m[ACTION] Wiping and seeding database...\033[0m"
        php -d memory_limit=-1 artisan migrate:fresh --seed --force
        
        echo -e "\033[1;30m[ACTION] Purging backend cache...\033[0m"
        php artisan config:clear
        php artisan route:clear
        php artisan cache:clear
        
        echo -e "\033[1;30m[ACTION] Clearing old logs...\033[0m"
        rm -f storage/logs/*.log 2>/dev/null || true
        cd ..
    else
        echo -e "\033[1;31m[ERROR] PHP is not installed or not in your PATH. Cannot refresh database.\033[0m"
        exit 1
    fi
fi

echo -e "\n\033[1;32m[SUCCESS] Database successfully wiped and seeded with demo data!\033[0m"
