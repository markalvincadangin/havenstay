<?php

/**
 * Router for PHP built-in server when `php artisan serve` cannot bind (e.g. some Windows setups).
 * Usage from backend/: php -S 127.0.0.1:8000 router.php
 */
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '');

if ($uri !== '/' && file_exists(__DIR__.'/public'.$uri)) {
    return false;
}

require_once __DIR__.'/public/index.php';
