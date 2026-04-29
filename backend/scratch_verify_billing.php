<?php

use App\Models\Contract;
use App\Models\Room;
use App\Models\Utility;

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo '--- UTILITY RATES ---'.PHP_EOL;
foreach (Utility::all() as $u) {
    $rate = $u->rates()->latest('effective_from')->first();
    echo $u->name.' (ID: '.$u->utility_id.'): '.($rate ? $rate->base_rate : 'No Rate').PHP_EOL;
}

echo PHP_EOL.'--- ROOM & CONTRACT INFO ---'.PHP_EOL;
$room = Room::where('room_code', 'UNIT-101')->first();
if ($room) {
    echo 'Room: '.$room->room_code.' (Rate: '.$room->monthly_rate.')'.PHP_EOL;
    $contracts = Contract::whereHas('bedSpace', function ($q) use ($room) {
        $q->where('room_id', $room->room_id);
    })->where('status', 'active')->get();

    foreach ($contracts as $c) {
        echo 'Contract: '.$c->contract_id.' - '.$c->tenant->first_name.' '.$c->tenant->last_name.' (Rate: '.$c->monthly_rate.')'.PHP_EOL;
    }
} else {
    echo 'Room UNIT-101 not found.'.PHP_EOL;
}
