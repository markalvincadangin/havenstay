# Stage 1: Base - Setup PHP 8.4 and Apache
FROM php:8.4-apache AS base

# Install system dependencies including SQLite library for local/CI test suites
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpng-dev \
    libxml2-dev \
    libzip-dev \
    libsqlite3-dev \
    zip \
    unzip \
    && docker-php-ext-install pdo_mysql pdo_sqlite bcmath gd zip opcache \
    && rm -rf /var/lib/apt/lists/*

# Configure Apache Document Root, mod_rewrite, and directory permissions
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN a2enmod rewrite headers && \
    sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/000-default.conf && \
    sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf && \
    printf '<Directory %s>\n\tOptions -Indexes +FollowSymLinks\n\tAllowOverride All\n\tRequire all granted\n</Directory>\n' "${APACHE_DOCUMENT_ROOT}" > /etc/apache2/conf-available/havenstay.conf && \
    a2enconf havenstay

# Production-grade OPcache defaults
RUN { \
    echo 'opcache.memory_consumption=128'; \
    echo 'opcache.interned_strings_buffer=16'; \
    echo 'opcache.max_accelerated_files=10000'; \
    echo 'opcache.revalidate_freq=2'; \
    echo 'opcache.fast_shutdown=1'; \
    echo 'opcache.enable_cli=1'; \
} > /usr/local/etc/php/conf.d/opcache-recommended.ini

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www/html

# Stage 2: Development - Includes dev dependencies & tools
FROM base AS development
ENV APP_ENV=local
ENV APP_DEBUG=true

COPY composer.json composer.lock ./
RUN composer install --no-scripts --no-autoloader

COPY . .
RUN composer dump-autoload

RUN chown -R www-data:www-data storage bootstrap/cache && \
    chmod -R 775 storage bootstrap/cache

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["apache2-foreground"]

# Stage 3: Production - Stripped dev dependencies & optimized autoloader
FROM base AS production
ENV APP_ENV=production
ENV APP_DEBUG=false

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --optimize-autoloader

COPY . .
RUN composer dump-autoload --optimize

RUN chown -R www-data:www-data storage bootstrap/cache && \
    chmod -R 775 storage bootstrap/cache

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["apache2-foreground"]
