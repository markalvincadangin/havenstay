<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

use App\Models\AddOn;
use Illuminate\Contracts\Console\Kernel;

try {
    $count = AddOn::count();
    $items = AddOn::all()->toArray();
    echo 'COUNT: '.$count."\n";
    echo 'ITEMS: '.json_encode($items, JSON_PRETTY_PRINT)."\n";
} catch (Exception $e) {
    echo 'ERROR: '.$e->getMessage()."\n";
}
