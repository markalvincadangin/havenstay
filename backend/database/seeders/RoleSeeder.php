<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Role::firstOrCreate(['role_name' => 'admin'], ['description' => 'Full system access']);
        Role::firstOrCreate(['role_name' => 'staff'], ['description' => 'Standard staff member']);
        Role::firstOrCreate(['role_name' => 'viewer'], ['description' => 'Read-only access']);
    }
}
