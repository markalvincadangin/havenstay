#!/bin/bash
# HavenStay Backend Entrypoint
# Supports environment-variable-controlled seeding for Render Free Tier
# (no shell access available on free plans)
#
# Usage:
#   Normal deploy:      DB_SEED=false  → runs migrate (safe, no data loss)
#   Fresh clean start:  DB_SEED=true   → runs migrate:fresh --seed (WIPES DB)
set -e

echo "[entrypoint] Clearing config cache..."
php artisan config:clear

# ── DB CONNECTIVITY GUARD ──
echo "[entrypoint] Waiting for database connection..."
MAX_RETRIES=30
RETRY_COUNT=0

until php artisan db:monitor > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "[entrypoint] ERROR: Database connection timed out after ${MAX_RETRIES} attempts."
        exit 1
    fi
    echo "[entrypoint] Database not ready yet (attempt ${RETRY_COUNT}/${MAX_RETRIES})... waiting 2s"
    sleep 2
done
echo "[entrypoint] Database connection established."

if [ "${DB_SEED}" = "true" ]; then
    echo "[entrypoint] DB_SEED=true — running migrate:fresh (Step 1/2)"
    php -d memory_limit=-1 artisan migrate:fresh --force
    
    echo "[entrypoint] Cooling down (5s)..."
    sleep 5
    
    echo "[entrypoint] Running database seeder (Step 2/2)"
    php -d memory_limit=-1 artisan db:seed --force
    echo "[entrypoint] Seeding complete."
else
    echo "[entrypoint] Running safe migration (no data loss)..."
    php artisan migrate --force
fi

if [ "${APP_ENV}" = "production" ]; then
    echo "[entrypoint] Optimizing for production..."
    php artisan config:cache
    php artisan route:cache
else
    echo "[entrypoint] Clearing cache for local development..."
    php artisan config:clear
    php artisan route:clear
    php artisan cache:clear
fi

echo "[entrypoint] Starting Apache..."
exec apache2-foreground
