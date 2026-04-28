<?php

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        env('FRONTEND_URL', 'http://localhost:3000'),
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ],

    'allowed_origins_patterns' => env('APP_ENV') === 'local' ? [
        '/^https:\/\/.*\.vercel\.app$/',
        '/^https:\/\/.*\.trycloudflare\.com$/',
        '/^https:\/\/.*\.ngrok-free\.app$/',
    ] : [
        '/^https:\/\/.*\.vercel\.app$/', // Note: Allowing all vercel.app domains in production is also a risk. Consider restricting to your specific project domains.
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
