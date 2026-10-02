#!/bin/bash
set -e

# Ensure Laravel storage and bootstrap cache directories exist with writable permissions
mkdir -p /var/www/html/storage/framework/{sessions,views,cache} /var/www/html/storage/logs /var/www/html/bootstrap/cache
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache 2>/dev/null || true
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache 2>/dev/null || true

# If a custom CLI command was passed (e.g. php artisan test, composer, bash), execute it immediately
if [ "$#" -gt 0 ] && [ "$1" != "apache2-foreground" ]; then
    exec "$@"
fi

# ── APACHE SERVER BOOTSTRAP SEQUENCE ──
echo "[entrypoint] Preparing HavenStay backend environment..."

# ── CONFIGURATION & CACHE STATE ──
if [ "${APP_ENV}" = "production" ]; then
    echo "[entrypoint] Optimizing caches for production..."
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
else
    echo "[entrypoint] Resetting caches for local development..."
    php artisan config:clear
    php artisan route:clear
    php artisan cache:clear
    php artisan view:clear
fi

# ── DB CONNECTIVITY GUARD ──
echo "[entrypoint] Waiting for database connection..."
MAX_RETRIES=30
RETRY_COUNT=0

check_db() {
    php -r "
      try {
        require 'vendor/autoload.php';
        \$app = require_once 'bootstrap/app.php';
        \$kernel = \$app->make(Illuminate\Contracts\Console\Kernel::class);
        \$kernel->bootstrap();
        \DB::connection()->getPdo();
        exit(0);
      } catch (\Throwable \$e) {
        exit(1);
      }
    " >/dev/null 2>&1
}

until check_db; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "[entrypoint] ERROR: Database connection timed out after ${MAX_RETRIES} attempts."
        exit 1
    fi
    echo "[entrypoint] Database not ready yet (attempt ${RETRY_COUNT}/${MAX_RETRIES})... waiting 2s"
    sleep 2
done
echo "[entrypoint] Database connection established."

# ── DATABASE MIGRATIONS & SEEDING ──
# Temporarily pin DB_READ_HOST to write host during migration/seeding to avoid replica lag race conditions
READ_BYPASS_HOST="${DB_WRITE_HOST:-${DB_HOST:-db-primary}}"

if [ "${DB_FRESH}" = "true" ]; then
    echo "[entrypoint] DB_FRESH=true — running migrate:fresh --seed (destructive clean start)..."
    DB_READ_HOST="${READ_BYPASS_HOST}" php -d memory_limit=-1 artisan migrate:fresh --seed --force
    echo "[entrypoint] Database fresh reset and seeding complete."
elif [ "${DB_SEED}" = "true" ]; then
    echo "[entrypoint] DB_SEED=true — running safe migrate and checking seed status..."
    DB_READ_HOST="${READ_BYPASS_HOST}" php -d memory_limit=-1 artisan migrate --force
    SEEDED=$(php -r "
      require 'vendor/autoload.php';
      \$app = require_once 'bootstrap/app.php';
      \$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
      try {
        echo \DB::table('users')->count() > 0 ? '1' : '0';
      } catch (\Throwable \$e) {
        echo '0';
      }
    " 2>/dev/null || echo "0")
    if [ "$SEEDED" = "0" ]; then
        echo "[entrypoint] Database appears unseeded. Running db:seed..."
        DB_READ_HOST="${READ_BYPASS_HOST}" php -d memory_limit=-1 artisan db:seed --force
        echo "[entrypoint] Seeding complete."
    else
        echo "[entrypoint] Database already contains records. Skipping duplicate seeding to preserve integrity."
    fi
else
    echo "[entrypoint] Running safe database migrations (no data loss)..."
    DB_READ_HOST="${READ_BYPASS_HOST}" php artisan migrate --force
fi

echo "[entrypoint] Starting Apache web server..."
exec "$@"
