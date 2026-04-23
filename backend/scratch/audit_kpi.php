<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Contract;

$active = Contract::where('status', 'active')->get();
$monthlySum = $active->sum(fn($c) => (float)$c->monthly_rate);
$depositSum = $active->sum(fn($c) => (float)$c->deposit_amount);

echo "Active Contracts: " . $active->count() . "\n";
echo "Monthly Rate Sum: " . $monthlySum . "\n";
echo "Deposit Sum: " . $depositSum . "\n";
