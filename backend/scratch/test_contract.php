<?php

use App\Models\User;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Kernel::class);

$request = Request::create('/api/contracts', 'POST', [
    'tenant_id' => 10,
    'bed_space_id' => 2,
    'move_in_date' => '2026-04-18',
    'expected_move_out' => '2026-04-25',
    'deposit_amount' => 4500,
    'monthly_rate' => 4500,
    'notes' => null,
]);
$request->headers->set('Accept', 'application/json');

$user = User::first();
$request->setUserResolver(function () use ($user) {
    return $user;
});

$response = $kernel->handle($request);
echo 'STATUS: '.$response->getStatusCode()."\n";
echo 'BODY: '.$response->getContent()."\n";
