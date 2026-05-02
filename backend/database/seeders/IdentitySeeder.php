<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use App\Services\Core\AuditService;


class IdentitySeeder extends Seeder
{
    /**
     * Run the database seeds.
     * Provisions the authorized administrator identity from environment variables.
     */
    public function run(): void
    {
        AuditService::setSystemContext('identity');
        $adminEmail = env('SEED_ADMIN_EMAIL');

        if (!$adminEmail) {
            return;
        }

        $adminRole = Role::where('role_name', 'admin')->first();

        if (!$adminRole) {
            $this->command->error('Admin role not found. Please run RoleSeeder first.');
            return;
        }

        User::updateOrCreate(
            ['email' => $adminEmail],
            [
                'role_id' => $adminRole->role_id,
                'first_name' => env('SEED_ADMIN_FIRST_NAME', 'System'),
                'last_name' => env('SEED_ADMIN_LAST_NAME', 'Administrator'),
                'username' => env('SEED_ADMIN_USERNAME', 'admin'),
                'password_hash' => Hash::make(Str::random(32)),
                'is_active' => 1,
            ]
        );

        $this->command->info("Authorized identity seeded: {$adminEmail}");
    }
}
