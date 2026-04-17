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

if [ "${DB_SEED}" = "true" ]; then
    echo "[entrypoint] DB_SEED=true — running migrate:fresh --seed (all data will be wiped)"
    php artisan migrate:fresh --seed --force
    echo "[entrypoint] Seeding complete. IMPORTANT: Set DB_SEED=false and redeploy to prevent re-seeding on next restart."
else
    echo "[entrypoint] Running safe migration (no data loss)..."
    php artisan migrate --force
fi

echo "[entrypoint] Starting Apache..."
exec apache2-foreground
