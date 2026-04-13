<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * **Master DDL (MySQL):** `database/sql/havenstay_schema.sql` — edit that file first, then keep the repo-root
     * mirror `db/havenstay_schema.sql` byte-identical (project canonical for docs/tests).
     *
     * **SQLite (tests):** `createTables()` / `createViews()` below mirror the same structure (no MySQL triggers).
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            $sql = file_get_contents(database_path('sql/havenstay_schema.sql'));
            // Local MySQL with binary logging often rejects CREATE TRIGGER without SUPER (error 1419).
            // Try the common fix; if the DB user lacks SUPER, this is a no-op and my.cnf must be set — see docs/MYSQL_LOCAL_MIGRATIONS.md
            try {
                DB::statement('SET GLOBAL log_bin_trust_function_creators = 1');
            } catch (Throwable) {
                // ignore — user may need to set in [mysqld] or skip-log-bin
            }
            try {
                DB::unprepared($sql);
            } catch (QueryException $e) {
                $msg = $e->getMessage();
                if (str_contains($msg, '1419') || str_contains($msg, 'SUPER privilege') || str_contains($msg, 'log_bin_trust_function_creators')) {
                    throw new RuntimeException(
                        'MySQL migration failed while applying havenstay_schema.sql (triggers + binlog). '.
                        'Fix: add under [mysqld] `skip-log-bin` or `log_bin_trust_function_creators=1`, restart MySQL, then run migrate:fresh again. '.
                        'Details: docs/MYSQL_LOCAL_MIGRATIONS.md. Original: '.$msg,
                        0,
                        $e
                    );
                }
                throw $e;
            }

            return;
        }

        // --- SQLite Compatibility Path (For Automated Tests) ---

        $this->createTables();
        $this->createViews();
    }

    private function createTables(): void
    {
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
            $table->string('username', 100)->unique();
            $table->string('email', 150)->nullable(false);
            $table->string('password_hash');
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_login_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->foreign('role_id')->references('role_id')->on('roles');
            $table->index('role_id', 'idx_users_role');
            $table->index(['last_name', 'first_name'], 'idx_users_name');
        });

        Schema::create('tenants', function (Blueprint $table) {
            $table->increments('tenant_id');
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('contact_number', 20);
            $table->string('email', 150)->nullable(false);
            $table->string('emergency_contact_name', 200)->nullable(false);
            $table->string('emergency_contact_number', 20)->nullable(false);
            $table->text('address');
            $table->string('status', 20)->default('active');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['last_name', 'first_name'], 'idx_tenants_name');
            $table->index('status', 'idx_tenants_status');
        });

        Schema::create('rooms', function (Blueprint $table) {
            $table->increments('room_id');
            $table->string('room_code', 20)->unique();
            $table->string('room_type', 20)->default('solo');
            $table->integer('capacity')->default(1);
            $table->decimal('monthly_rate', 10, 2);
            $table->string('status', 20)->default('available');
            $table->text('amenities')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index('status', 'idx_rooms_status');
        });

        Schema::create('bed_spaces', function (Blueprint $table) {
            $table->increments('bed_space_id');
            $table->unsignedInteger('room_id');
            $table->string('bed_label', 20);
            $table->string('status', 20)->default('vacant');
            $table->timestamps();
            $table->unique(['room_id', 'bed_label'], 'uq_bed_space_per_room');
            $table->foreign('room_id')->references('room_id')->on('rooms');
            $table->index(['room_id', 'status'], 'idx_bed_spaces_room_status');
        });

        Schema::create('contracts', function (Blueprint $table) {
            $table->increments('contract_id');
            $table->unsignedInteger('tenant_id');
            $table->unsignedInteger('bed_space_id');
            $table->unsignedInteger('created_by');
            $table->date('move_in_date');
            $table->date('expected_move_out_date')->nullable(false);
            $table->date('actual_move_out_date')->nullable();
            $table->decimal('deposit_amount', 10, 2)->default(0.00);
            $table->decimal('monthly_rate', 10, 2)->default(0.00);
            $table->string('status', 20)->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->foreign('tenant_id')->references('tenant_id')->on('tenants');
            $table->foreign('bed_space_id')->references('bed_space_id')->on('bed_spaces');
            $table->foreign('created_by')->references('user_id')->on('users');
            $table->index(['tenant_id', 'status'], 'idx_contracts_tenant_status');
            $table->index(['bed_space_id', 'status'], 'idx_contracts_bed_status');
        });

        Schema::create('billing', function (Blueprint $table) {
            $table->increments('billing_id');
            $table->unsignedInteger('contract_id');
            $table->date('billing_period_from');
            $table->date('billing_period_to');
            $table->date('due_date');
            $table->string('status', 20)->default('unpaid');
            $table->timestamps();
            $table->foreign('contract_id')->references('contract_id')->on('contracts');
            $table->unique(['contract_id', 'billing_period_from', 'billing_period_to'], 'uq_billing_cycle');
            $table->index(['contract_id', 'status'], 'idx_billing_contract_status');
            $table->index('due_date', 'idx_billing_due_date');
        });

        Schema::create('billing_line_items', function (Blueprint $table) {
            $table->increments('billing_line_item_id');
            $table->unsignedInteger('billing_id');
            $table->string('item_type', 50);
            $table->string('item_description');
            $table->decimal('amount', 10, 2);
            $table->timestamps();
            $table->foreign('billing_id')->references('billing_id')->on('billing');
            $table->index('billing_id', 'idx_line_items_billing');
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->increments('payment_id');
            $table->unsignedInteger('billing_id');
            $table->unsignedInteger('processed_by');
            $table->decimal('amount_paid', 10, 2);
            $table->date('payment_date');
            $table->string('payment_method', 50)->default('cash');
            $table->string('reference_number', 100)->nullable();
            $table->text('remarks')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->unsignedInteger('voided_by')->nullable();
            $table->string('void_reason', 255)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->foreign('billing_id')->references('billing_id')->on('billing');
            $table->foreign('processed_by')->references('user_id')->on('users');
            $table->foreign('voided_by')->references('user_id')->on('users')->nullOnDelete();
            $table->index(['billing_id', 'payment_date'], 'idx_payments_billing_date');
            $table->index('processed_by', 'idx_payments_processed_by');
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->bigIncrements('audit_log_id');
            $table->unsignedInteger('user_id')->nullable();
            $table->string('entity_name', 100);
            $table->string('entity_id', 100);
            $table->string('action', 50);
            $table->json('old_values_json')->nullable();
            $table->json('new_values_json')->nullable();
            $table->string('correlation_id', 36)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->foreign('user_id')->references('user_id')->on('users')->nullOnDelete();
            $table->index(['entity_name', 'entity_id'], 'idx_audit_entity');
            $table->index('created_at', 'idx_audit_timestamp');
            $table->index('correlation_id', 'idx_audit_correlation');
        });

        Schema::create('transaction_logs', function (Blueprint $table) {
            $table->bigIncrements('tx_log_id');
            $table->string('tx_name', 150);
            $table->dateTime('started_at');
            $table->timestamp('completed_at')->nullable();
            $table->string('status', 20)->default('started');
            $table->unsignedInteger('initiated_by')->nullable();
            $table->string('reference_entity', 100)->nullable();
            $table->string('reference_id', 100)->nullable();
            $table->json('details_json')->nullable();
            $table->string('correlation_id', 36)->nullable();
            $table->foreign('initiated_by')->references('user_id')->on('users')->nullOnDelete();
            $table->index(['status', 'started_at'], 'idx_tx_status_started');
            $table->index('correlation_id', 'idx_tx_correlation');
        });
    }

    private function createViews(): void
    {
        DB::statement("
            CREATE VIEW vw_billing_summary AS
            SELECT 
                b.billing_id,
                b.billing_period_from,
                b.billing_period_to,
                b.due_date,
                b.status AS billing_status,
                c.contract_id,
                t.tenant_id,
                t.last_name || ', ' || t.first_name AS tenant_name,
                t.email,
                r.room_id,
                r.room_code,
                bs.bed_space_id,
                bs.bed_label,
                COALESCE((SELECT SUM(amount) FROM billing_line_items WHERE billing_id = b.billing_id), 0.00) AS total_amount,
                COALESCE((SELECT SUM(amount_paid) FROM payments WHERE billing_id = b.billing_id AND voided_at IS NULL), 0.00) AS total_paid
            FROM billing b
            INNER JOIN contracts c ON b.contract_id = c.contract_id
            INNER JOIN tenants t ON c.tenant_id = t.tenant_id
            INNER JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
            INNER JOIN rooms r ON bs.room_id = r.room_id
        ");

        DB::statement("
            CREATE VIEW vw_active_contracts AS
            SELECT 
                c.contract_id,
                c.move_in_date,
                t.tenant_id,
                t.last_name || ', ' || t.first_name AS tenant_name,
                t.contact_number,
                t.email,
                r.room_id,
                r.room_code,
                COALESCE(c.monthly_rate, r.monthly_rate) as monthly_rate,
                bs.bed_space_id,
                bs.bed_label,
                bs.status AS bed_status
            FROM contracts c
            INNER JOIN tenants t ON c.tenant_id = t.tenant_id
            INNER JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
            INNER JOIN rooms r ON bs.room_id = r.room_id
            WHERE c.status = 'active'
              AND c.deleted_at IS NULL
        ");

        DB::statement("
            CREATE VIEW vw_room_occupancy AS
            SELECT 
                r.room_id,
                r.room_code,
                r.room_type,
                r.monthly_rate,
                r.status AS room_status,
                r.capacity,
                (SELECT COUNT(*) FROM bed_spaces bs WHERE bs.room_id = r.room_id) as total_beds,
                (SELECT COUNT(*) FROM bed_spaces bs WHERE bs.room_id = r.room_id AND bs.status = 'occupied') as occupied_beds,
                (SELECT COUNT(*) FROM bed_spaces bs WHERE bs.room_id = r.room_id AND bs.status = 'vacant' AND r.status = 'available' AND r.deleted_at IS NULL) as vacant_beds
            FROM rooms r
            WHERE r.deleted_at IS NULL
        ");

        DB::statement("
            CREATE VIEW vw_occupancy_status AS
            SELECT 
                bs.bed_space_id,
                bs.bed_label,
                bs.status AS bed_status,
                r.room_id,
                r.room_code,
                t.tenant_id,
                t.last_name || ', ' || t.first_name as tenant_name,
                c.contract_id
            FROM bed_spaces bs
            INNER JOIN rooms r ON bs.room_id = r.room_id
            LEFT JOIN contracts c ON bs.bed_space_id = c.bed_space_id AND c.status = 'active' AND c.deleted_at IS NULL
            LEFT JOIN tenants t ON c.tenant_id = t.tenant_id
        ");

        DB::statement("
            CREATE VIEW vw_collections_summary AS
            SELECT 
                p.payment_id,
                p.payment_date,
                p.amount_paid,
                p.payment_method,
                p.reference_number,
                t.tenant_id,
                t.last_name || ', ' || t.first_name AS tenant_name,
                b.billing_id,
                r.room_code
            FROM payments p
            INNER JOIN billing b ON p.billing_id = b.billing_id
            INNER JOIN contracts c ON b.contract_id = c.contract_id
            INNER JOIN tenants t ON c.tenant_id = t.tenant_id
            INNER JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
            INNER JOIN rooms r ON bs.room_id = r.room_id
            WHERE p.voided_at IS NULL
        ");

        DB::statement("
            CREATE VIEW vw_tenant_contract_history AS
            SELECT
                c.contract_id,
                c.tenant_id,
                t.last_name || ', ' || t.first_name AS tenant_name,
                t.email,
                c.move_in_date,
                c.expected_move_out_date,
                c.actual_move_out_date,
                c.status AS contract_status,
                r.room_code,
                bs.bed_label
            FROM contracts c
            INNER JOIN tenants t ON c.tenant_id = t.tenant_id
            INNER JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
            INNER JOIN rooms r ON bs.room_id = r.room_id
        ");
    }

    public function down(): void
    {
        DB::statement('DROP VIEW IF EXISTS vw_billing_summary');
        DB::statement('DROP VIEW IF EXISTS vw_active_contracts');
        DB::statement('DROP VIEW IF EXISTS vw_room_occupancy');
        DB::statement('DROP VIEW IF EXISTS vw_occupancy_status');
        DB::statement('DROP VIEW IF EXISTS vw_collections_summary');
        DB::statement('DROP VIEW IF EXISTS vw_tenant_contract_history');

        Schema::dropIfExists('transaction_logs');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('billing_line_items');
        Schema::dropIfExists('billing');
        Schema::dropIfExists('contracts');
        Schema::dropIfExists('bed_spaces');
        Schema::dropIfExists('rooms');
        Schema::dropIfExists('tenants');
        Schema::dropIfExists('users');
        Schema::dropIfExists('roles');
    }
};
