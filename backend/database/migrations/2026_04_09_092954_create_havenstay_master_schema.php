<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Master DDL Initialization
     * Loads havenstay_schema.sql for MySQL environments.
     * Provides fallback schema for SQLite (testing).
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            $sql = file_get_contents(database_path('sql/havenstay_schema.sql'));
            
            // Clean up DELIMITER statements which are not supported by the PDO driver
            // Handles $$, //, or other custom delimiters
            $sql = preg_replace('/DELIMITER\s+\S+/i', '', $sql);
            
            // Replace trigger/procedure delimiters with standard semicolons
            $sql = str_replace('$$', ';', $sql);
            $sql = str_replace('//', ';', $sql);

            DB::unprepared($sql);

            try {
                DB::statement('SET GLOBAL log_bin_trust_function_creators = 1');
            } catch (\Throwable) {
                // Ignore if not permitted
            }
            


            DB::statement("DROP VIEW IF EXISTS vw_billing_summary");
            DB::statement("CREATE VIEW vw_billing_summary AS
                SELECT 
                    b.billing_id,
                    b.contract_id,
                    b.billing_period_from,
                    b.billing_period_to,
                    b.due_date,
                    b.status AS billing_status,
                    t.tenant_id,
                    CONCAT(t.last_name, ', ', t.first_name) AS tenant_name,
                    r.room_code,
                    bs.bed_label,
                    (SELECT COALESCE(SUM(amount), 0) FROM billing_line_items WHERE billing_id = b.billing_id) AS total_amount,
                    (SELECT COALESCE(SUM(amount_paid), 0) FROM payments WHERE billing_id = b.billing_id AND voided_at IS NULL AND payment_category = 'billing') AS total_paid
                FROM billing b
                JOIN contracts  c  ON b.contract_id  = c.contract_id
                JOIN tenants    t  ON c.tenant_id    = t.tenant_id
                JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
                JOIN rooms      r  ON bs.room_id      = r.room_id");

            return;
        }

        $this->createTables();
        $this->createViews();
    }

    private function createTables(): void
    {
        // ── SECTION 1: CORE OPERATIONAL ENTITIES (14 TABLES) ──

        Schema::create('roles', function (Blueprint $table) {
            $table->increments('role_id');
            $table->string('role_name', 50)->unique();
            $table->string('description')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('user_id');
            $table->unsignedInteger('role_id');
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('username', 100);
            $table->string('email', 150);
            $table->string('password_hash');
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_login_at')->nullable();
            $table->string('active_username', 100)->nullable()->unique();
            $table->string('active_email', 150)->nullable()->unique();
            $table->timestamps();
            $table->softDeletes();
            $table->foreign('role_id')->references('role_id')->on('roles');
        });

        Schema::create('tenants', function (Blueprint $table) {
            $table->increments('tenant_id');
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('contact_number', 20);
            $table->string('email', 150);
            $table->string('emergency_contact_name', 200);
            $table->string('emergency_contact_number', 20);
            $table->text('address');
            $table->enum('status', ['active', 'moved_out', 'archived'])->default('active');
            $table->string('active_email', 150)->nullable()->unique();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('rooms', function (Blueprint $table) {
            $table->increments('room_id');
            $table->string('room_code', 20)->unique();
            $table->enum('room_type', ['private', 'shared'])->default('private');
            $table->integer('capacity')->default(1);
            $table->decimal('monthly_rate', 10, 2);
            $table->enum('status', ['available', 'unavailable', 'maintenance'])->default('available');
            $table->text('amenities')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_metered')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('bed_spaces', function (Blueprint $table) {
            $table->increments('bed_space_id');
            $table->unsignedInteger('room_id');
            $table->string('bed_label', 20);
            $table->enum('status', ['vacant', 'occupied', 'maintenance'])->default('vacant');
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['room_id', 'bed_label']);
            $table->foreign('room_id')->references('room_id')->on('rooms')->onDelete('restrict');
        });

        Schema::create('contracts', function (Blueprint $table) {
            $table->increments('contract_id');
            $table->unsignedInteger('tenant_id');
            $table->unsignedInteger('bed_space_id');
            $table->unsignedInteger('created_by');
            $table->enum('contract_type', ['fixed_term', 'month_to_month']);
            $table->date('move_in_date');
            $table->date('expected_move_out_date')->nullable();
            $table->date('actual_move_out_date')->nullable();
            $table->decimal('monthly_rate', 10, 2);
            $table->decimal('monthly_rate_override', 10, 2)->nullable();
            $table->decimal('deposit_amount', 10, 2)->default(0.00);
            $table->boolean('is_cleared')->default(false);
            $table->enum('status', ['pending_payment', 'active', 'completed', 'terminated', 'voided'])->default('pending_payment');
            $table->text('notes')->nullable();
            $table->string('idempotency_key', 36)->nullable()->unique('uq_contracts_idempotency');
            $table->timestamps();
            $table->softDeletes();
            $table->foreign('tenant_id')->references('tenant_id')->on('tenants');
            $table->foreign('bed_space_id')->references('bed_space_id')->on('bed_spaces');
            $table->foreign('created_by')->references('user_id')->on('users');
        });

        Schema::create('utilities', function (Blueprint $table) {
            $table->increments('utility_id');
            $table->string('name', 100);
            $table->string('unit_of_measurement', 20);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('meters', function (Blueprint $table) {
            $table->increments('meter_id');
            $table->unsignedInteger('utility_id');
            $table->string('serial_number', 100)->unique();
            $table->enum('status', ['active', 'maintenance', 'replaced'])->default('active');
            $table->timestamps();
            $table->foreign('utility_id')->references('utility_id')->on('utilities');
        });

        Schema::create('meter_assignments', function (Blueprint $table) {
            $table->increments('assignment_id');
            $table->unsignedInteger('meter_id');
            $table->unsignedInteger('room_id');
            $table->date('valid_from');
            $table->date('valid_to')->nullable();
            $table->timestamps();
            $table->foreign('meter_id')->references('meter_id')->on('meters');
            $table->foreign('room_id')->references('room_id')->on('rooms');
        });

        Schema::create('meter_readings', function (Blueprint $table) {
            $table->increments('reading_id');
            $table->unsignedInteger('meter_id');
            $table->date('reading_date');
            $table->decimal('reading_value', 12, 4);
            $table->boolean('is_rollover')->default(false);
            $table->unsignedInteger('recorded_by');
            $table->timestamps();
            $table->unique(['meter_id', 'reading_date', 'reading_value'], 'uk_meter_reading_forensic');
            $table->foreign('meter_id')->references('meter_id')->on('meters');
            $table->foreign('recorded_by')->references('user_id')->on('users');
        });

        Schema::create('utility_rates', function (Blueprint $table) {
            $table->increments('rate_id');
            $table->unsignedInteger('utility_id');
            $table->decimal('base_rate', 10, 2);
            $table->date('effective_from');
            $table->timestamps();
            $table->unique(['utility_id', 'effective_from']);
            $table->foreign('utility_id')->references('utility_id')->on('utilities');
        });

        Schema::create('billing', function (Blueprint $table) {
            $table->increments('billing_id');
            $table->unsignedInteger('contract_id');
            $table->date('billing_period_from');
            $table->date('billing_period_to');
            $table->date('due_date');
            $table->enum('status', ['unpaid', 'partial', 'paid', 'overdue'])->default('unpaid');
            $table->string('idempotency_key', 36)->nullable()->unique('uq_billing_idempotency');
            $table->timestamps();
            $table->unique(['contract_id', 'billing_period_from', 'billing_period_to'], 'uq_billing_cycle');
            $table->foreign('contract_id')->references('contract_id')->on('contracts');
        });

        Schema::create('billing_line_items', function (Blueprint $table) {
            $table->increments('line_item_id');
            $table->unsignedInteger('billing_id');
            $table->unsignedInteger('utility_id')->nullable();
            $table->unsignedInteger('reading_id')->nullable();
            $table->enum('item_type', ['base_rent', 'utility', 'penalty', 'adjustment']);
            $table->string('item_description', 255);
            $table->decimal('amount', 10, 2);
            $table->timestamps();
            $table->foreign('billing_id')->references('billing_id')->on('billing');
            $table->foreign('utility_id')->references('utility_id')->on('utilities');
            $table->foreign('reading_id')->references('reading_id')->on('meter_readings');
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->increments('payment_id');
            $table->unsignedInteger('billing_id')->nullable();
            $table->unsignedInteger('contract_id')->nullable();
            $table->enum('payment_category', ['billing', 'deposit', 'refund', 'rollover'])->default('billing');
            $table->decimal('amount_paid', 10, 2);
            $table->date('payment_date');
            $table->enum('payment_method', ['cash', 'gcash', 'bank_transfer', 'other']);
            $table->string('reference_number', 100)->nullable();
            $table->unsignedInteger('processed_by');
            $table->timestamp('voided_at')->nullable();
            $table->unsignedInteger('voided_by')->nullable();
            $table->string('void_reason', 255)->nullable();
            $table->string('idempotency_key', 36)->nullable()->unique('uq_payments_idempotency');
            $table->timestamp('created_at')->useCurrent();
            $table->foreign('billing_id')->references('billing_id')->on('billing');
            $table->foreign('contract_id')->references('contract_id')->on('contracts');
            $table->foreign('processed_by')->references('user_id')->on('users');
            $table->foreign('voided_by')->references('user_id')->on('users');
        });

        // ── SECTION 2: FORENSIC TABLES (2 TABLES) ──

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('action', 32);
            $table->string('target_table', 64);
            $table->unsignedBigInteger('record_id');
            $table->json('old_value')->nullable();
            $table->json('new_value')->nullable();
            $table->unsignedInteger('changed_by')->nullable();
            $table->string('correlation_id', 64)->nullable();
            $table->timestamp('changed_at')->useCurrent();

            // Performance Hardening
            $table->index('changed_at', 'idx_audit_timestamp');
            $table->index(['target_table', 'record_id'], 'idx_audit_resource');
            $table->index('action', 'idx_audit_action');
            $table->index('correlation_id', 'idx_audit_correlation');
        });

        // Removed: transaction_logs (Consolidated into audit_logs per CCR-007 retirement)
    }

    private function createViews(): void
    {
        DB::statement("DROP VIEW IF EXISTS vw_billing_summary");
        DB::statement("CREATE VIEW vw_billing_summary AS
            SELECT
                b.billing_id,
                c.contract_id,
                b.billing_period_from,
                b.billing_period_to,
                b.due_date,
                b.status AS billing_status,
                t.tenant_id,
                CONCAT(t.last_name, ', ', t.first_name) AS tenant_name,
                r.room_code,
                bs.bed_label,
                (SELECT COALESCE(SUM(amount), 0) FROM billing_line_items WHERE billing_id = b.billing_id) AS total_amount,
                (SELECT COALESCE(SUM(amount_paid), 0) FROM payments WHERE billing_id = b.billing_id AND voided_at IS NULL AND payment_category = 'billing') AS total_paid
            FROM billing b
            JOIN contracts  c  ON b.contract_id  = c.contract_id
            JOIN tenants    t  ON c.tenant_id    = t.tenant_id
            JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
            JOIN rooms      r  ON bs.room_id      = r.room_id");

        DB::statement("DROP VIEW IF EXISTS vw_active_contracts");
        DB::statement("CREATE VIEW vw_active_contracts AS
            SELECT
                c.contract_id,
                t.tenant_id,
                CONCAT(t.last_name, ', ', t.first_name) AS tenant_name,
                t.contact_number,
                t.email,
                r.room_id,
                r.room_code,
                c.monthly_rate,
                c.deposit_amount,
                bs.bed_space_id,
                bs.bed_label,
                bs.status AS bed_status,
                c.status AS contract_status,
                c.move_in_date,
                c.expected_move_out_date
            FROM contracts c
            JOIN tenants    t  ON c.tenant_id    = t.tenant_id
            JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
            JOIN rooms      r  ON bs.room_id      = r.room_id
            WHERE c.status     IN ('active', 'pending_payment') 
              AND c.deleted_at IS NULL");

        DB::statement("DROP VIEW IF EXISTS vw_room_occupancy");
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
            WHERE r.deleted_at IS NULL
            GROUP BY r.room_id, r.room_code, r.capacity, r.room_type, r.status");

        DB::statement("DROP VIEW IF EXISTS vw_occupancy_status");
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
            WHERE r.deleted_at IS NULL");

        DB::statement("DROP VIEW IF EXISTS vw_collections_summary");
        DB::statement("CREATE VIEW vw_collections_summary AS
            SELECT
                p.payment_id,
                p.payment_date,
                p.amount_paid,
                p.payment_method,
                p.payment_category,
                p.reference_number,
                t.tenant_id,
                CONCAT(t.last_name, ', ', t.first_name) AS tenant_name,
                r.room_code,
                r.room_type,
                b.billing_id
            FROM payments p
            LEFT JOIN billing    b ON p.billing_id  = b.billing_id
            LEFT JOIN contracts  c ON (p.billing_id = b.billing_id AND b.contract_id = c.contract_id) OR (p.contract_id = c.contract_id)
            LEFT JOIN tenants    t ON c.tenant_id   = t.tenant_id
            JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
            JOIN rooms      r ON bs.room_id     = r.room_id
            WHERE p.voided_at IS NULL");

        DB::statement("DROP VIEW IF EXISTS vw_tenant_contract_history");
        DB::statement("CREATE VIEW vw_tenant_contract_history AS
            SELECT
                c.contract_id,
                t.tenant_id,
                t.email,
                CONCAT(t.last_name, ', ', t.first_name) AS tenant_name,
                c.move_in_date,
                c.actual_move_out_date AS move_out_date,
                c.status AS status,
                c.is_cleared,
                r.room_id,
                r.room_code AS room_label,
                bs.bed_space_id,
                bs.bed_label
            FROM contracts c
            JOIN tenants t ON c.tenant_id = t.tenant_id
            JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
            JOIN rooms r ON bs.room_id = r.room_id");
    }

    public function down(): void
    {
        DB::statement('DROP VIEW IF EXISTS vw_tenant_contract_history');
        DB::statement('DROP VIEW IF EXISTS vw_collections_summary');
        DB::statement('DROP VIEW IF EXISTS vw_occupancy_status');
        DB::statement('DROP VIEW IF EXISTS vw_room_occupancy');
        DB::statement('DROP VIEW IF EXISTS vw_active_contracts');
        DB::statement('DROP VIEW IF EXISTS vw_billing_summary');

        Schema::dropIfExists('transaction_logs');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('billing_line_items');
        Schema::dropIfExists('billing');
        Schema::dropIfExists('utility_rates');
        Schema::dropIfExists('meter_readings');
        Schema::dropIfExists('meter_assignments');
        Schema::dropIfExists('meters');
        Schema::dropIfExists('utilities');
        Schema::dropIfExists('contracts');
        Schema::dropIfExists('bed_spaces');
        Schema::dropIfExists('rooms');
        Schema::dropIfExists('tenants');
        Schema::dropIfExists('users');
        Schema::dropIfExists('roles');
    }
};
