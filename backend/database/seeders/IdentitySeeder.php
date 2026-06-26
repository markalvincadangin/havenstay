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

        $adminRole = Role::where('role_name', 'admin')->first();
        if (!$adminRole) {
            $this->command->error('Admin role not found. Please run RoleSeeder first.');
            return;
        }

        // 1. Seed System Admin from Environment
        $envAdminEmail = env('SEED_ADMIN_EMAIL');
        if ($envAdminEmail) {
            User::updateOrCreate(
                ['email' => $envAdminEmail],
                [
                    'role_id' => $adminRole->role_id,
                    'first_name' => env('SEED_ADMIN_FIRST_NAME'),
                    'last_name' => env('SEED_ADMIN_LAST_NAME'),
                    'username' => env('SEED_ADMIN_USERNAME'),
                    'password_hash' => Hash::make(env('SEED_ADMIN_PASSWORD')),
                    'is_active' => 1,
                ]
            );
            $this->command->info("System administrator seeded: {$envAdminEmail}");
        }

        // 2. Seed System Administrators
        $systemAdmins = [
            ['email' => 'alyannabianca.serra@wvsu.edu.ph', 'first' => 'Alyanna Bianca', 'last' => 'Serra', 'user' => 'alyannabianca'],
            ['email' => 'luisarose.brillantes@wvsu.edu.ph', 'first' => 'Luisa Rose', 'last' => 'Brillantes', 'user' => 'luisarose'],
            ['email' => 'elizamay.calisa@wvsu.edu.ph', 'first' => 'Eliza May', 'last' => 'Calisa', 'user' => 'elizamay'],
            ['email' => 'ellenmae.tacleon@wvsu.edu.ph', 'first' => 'Ellen Mae', 'last' => 'Tacleon', 'user' => 'ellenmae'],
            ['email' => 'christianpaul.delacruz@wvsu.edu.ph', 'first' => 'Christian Paul', 'last' => 'Dela Cruz', 'user' => 'christianpaul'],
        ];

        foreach ($systemAdmins as $adm) {
            User::updateOrCreate(
                ['email' => $adm['email']],
                [
                    'role_id' => $adminRole->role_id,
                    'first_name' => $adm['first'],
                    'last_name' => $adm['last'],
                    'username' => $adm['user'],
                    'password_hash' => Hash::make('HavenStayAdmin2026!'), // Standardized initial password
                    'is_active' => 1,
                ]
            );
            $this->command->info("System administrator seeded: {$adm['email']}");
        }
    }
}
