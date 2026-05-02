<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Modify the ENUM column (MySQL)
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE rooms MODIFY COLUMN status ENUM('available', 'unavailable', 'maintenance', 'decommissioned') DEFAULT 'available'");
        }

        // 2. Data Migration: Recover soft-deleted rooms and set them to decommissioned
        DB::table('rooms')
            ->whereNotNull('deleted_at')
            ->update([
                'status' => 'decommissioned',
                'deleted_at' => null,
            ]);

        // 3. Recreate Views to include the new status filter
        $this->recreateViews();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            // Revert decommissioned rooms to soft-deleted available rooms (best effort reversal)
            DB::table('rooms')
                ->where('status', 'decommissioned')
                ->update([
                    'status' => 'available',
                    'deleted_at' => now(),
                ]);

            DB::statement("ALTER TABLE rooms MODIFY COLUMN status ENUM('available', 'unavailable', 'maintenance') DEFAULT 'available'");
        }
        
        $this->recreateViews(true);
    }

    private function recreateViews(bool $revert = false): void
    {
        $statusFilter = $revert ? "" : " AND r.status != 'decommissioned'";

        DB::statement('DROP VIEW IF EXISTS vw_room_occupancy');
        DB::statement("CREATE VIEW vw_room_occupancy AS
            SELECT
                r.room_id,
                r.room_code,
                r.capacity,
                r.room_type,
                r.status AS room_status,
                COUNT(bs.bed_space_id) AS total_beds,
                SUM(CASE WHEN bs.status = 'occupied' THEN 1 ELSE 0 END) AS occupied_beds,
                SUM(CASE WHEN bs.status = 'vacant' THEN 1 ELSE 0 END) AS vacant_beds
            FROM rooms r
            LEFT JOIN bed_spaces bs ON r.room_id = bs.room_id
            WHERE r.deleted_at IS NULL {$statusFilter}
            GROUP BY r.room_id, r.room_code, r.capacity, r.room_type, r.status");

        DB::statement('DROP VIEW IF EXISTS vw_occupancy_status');
        DB::statement("CREATE VIEW vw_occupancy_status AS
            SELECT
                bs.bed_space_id,
                bs.bed_label,
                bs.status AS bed_status,
                r.room_id,
                r.room_code,
                t.tenant_id,
                CONCAT(t.last_name, ', ', t.first_name) AS tenant_name,
                c.contract_id,
                c.deposit_amount
            FROM bed_spaces bs
            JOIN rooms r ON bs.room_id = r.room_id
            LEFT JOIN contracts c ON bs.bed_space_id = c.bed_space_id AND c.status IN ('active', 'pending_payment')
            LEFT JOIN tenants t ON c.tenant_id = t.tenant_id
            WHERE r.deleted_at IS NULL {$statusFilter}");
    }
};
