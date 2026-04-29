<?php

namespace App\Providers;

use App\Models\BedSpace;
use App\Models\Contract;
use App\Models\Payment;
use App\Observers\BedSpaceObserver;
use App\Observers\ContractObserver;
use App\Observers\PaymentObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Contract::observe(ContractObserver::class);
        BedSpace::observe(BedSpaceObserver::class);
        Payment::observe(PaymentObserver::class);
    }
}
