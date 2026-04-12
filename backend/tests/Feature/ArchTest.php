<?php

/** Static architecture constraints — CLAUDE.md §6 (no DB in controllers, no Gate). */
test('globals')
    ->expect(['dd', 'dump', 'ray'])
    ->not->toBeUsed();

test('controllers')
    ->expect('App\Http\Controllers')
    ->not->toUse('Illuminate\Support\Facades\DB');

test('models')
    ->expect('App\Models')
    ->toOnlyUse([
        'App\Models',
        'Illuminate\Database\Eloquent',
        'Illuminate\Foundation\Auth', // Allow Authenticatable User
        'Laravel\Sanctum', // Allow HasApiTokens
        'Illuminate\Notifications',
        'Illuminate\Contracts',
        'Illuminate\Support',
        'now',
    ]);

test('services')
    ->expect('App\Services')
    ->toOnlyUse([
        'App\Models',
        'App\Services',
        'Illuminate\Support',
        'Illuminate\Support\Facades\Auth',
        'auth',
        'Illuminate\Validation',
        'Illuminate\Database',
        'Illuminate\Contracts\Pagination\LengthAwarePaginator',
        'Symfony\Component\HttpFoundation',
        'now',
        'collect', // Allow collect() helper
    ]);
