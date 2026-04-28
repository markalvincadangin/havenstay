<?php

namespace App\Providers;

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
        \App\Models\Contract::observe(\App\Observers\ContractObserver::class);
        \App\Models\BedSpace::observe(\App\Observers\BedSpaceObserver::class);
        \App\Models\Payment::observe(\App\Observers\PaymentObserver::class);
    }
}
