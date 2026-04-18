<?php

use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BillingController;
use App\Http\Controllers\Api\ComplianceController;
use App\Http\Controllers\Api\ContractController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RoomController;
use App\Http\Controllers\Api\TenantController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function (): void {
    Route::post('login', [AuthController::class, 'login']);
    Route::middleware(['auth:sanctum', 'auth.check'])->group(function (): void {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('logout', [AuthController::class, 'logout']);
    });
});

Route::middleware(['auth:sanctum', 'auth.check'])->get('/user', function (Request $request) {
    return $request->user();
});

// FR-005, FR-006: User management endpoints (Admin only)
Route::middleware(['auth:sanctum', 'auth.check'])->prefix('users')->group(function (): void {
    Route::get('/', [UserController::class, 'index']);
    Route::get('roles', [UserController::class, 'roles']);
    Route::post('/', [UserController::class, 'store']);
    Route::get('{user}', [UserController::class, 'show']);
    Route::put('{user}', [UserController::class, 'update']);
    Route::post('{user}/deactivate', [UserController::class, 'deactivate']);
    Route::post('{user}/reactivate', [UserController::class, 'reactivate']);
    Route::post('{user}/archive', [UserController::class, 'archive']);
    Route::post('{id}/restore', [UserController::class, 'restore']);
    Route::post('{user}/assign-role', [UserController::class, 'assignRole']);
});

// FR-008..FR-011: Tenant management endpoints (Admin/Staff)
Route::middleware(['auth:sanctum', 'auth.check'])->prefix('tenants')->group(function (): void {
    Route::get('/', [TenantController::class, 'index']);
    Route::get('summary', [TenantController::class, 'summary']);
    Route::post('/', [TenantController::class, 'store']);
    Route::get('search', [TenantController::class, 'search']);
    Route::get('{id}', [TenantController::class, 'show'])->whereNumber('id');
    Route::put('{tenant}', [TenantController::class, 'update']);
    Route::post('{tenant}/reactivate', [TenantController::class, 'reactivate']);
    Route::post('{tenant}/archive', [TenantController::class, 'archive']);
    Route::post('{id}/restore', [TenantController::class, 'restore']);
});

// FR-012..FR-015: Room and bed-space management endpoints (Admin/Staff)
Route::middleware(['auth:sanctum', 'auth.check'])->prefix('rooms')->group(function (): void {
    Route::get('/', [RoomController::class, 'index']);
    Route::get('stats', [RoomController::class, 'stats']);
    Route::post('/', [RoomController::class, 'store']);
    Route::get('availability', [RoomController::class, 'availability']);
    Route::get('{room}', [RoomController::class, 'show']);
    Route::put('{room}', [RoomController::class, 'update']);
    Route::post('{room}/archive', [RoomController::class, 'archive']);
    Route::post('{id}/restore', [RoomController::class, 'restore']);
    Route::post('{room}/bed-spaces', [RoomController::class, 'addBedSpace']);
    Route::post('bed-spaces/{bedSpace}/occupy', [RoomController::class, 'occupyBedSpace']);
});

// FR-016..FR-019: Contract management endpoints (Admin/Staff create + move-out, all roles view)
Route::middleware(['auth:sanctum', 'auth.check'])->prefix('contracts')->group(function (): void {
    Route::get('/', [ContractController::class, 'index']);
    Route::post('/', [ContractController::class, 'store']);
    Route::get('{contract}', [ContractController::class, 'show']);
    Route::put('{contract}', [ContractController::class, 'update']);
    Route::post('{contract}/archive', [ContractController::class, 'archive']);
    Route::post('{id}/restore', [ContractController::class, 'restore']);
    Route::post('{contract}/move-out', [ContractController::class, 'moveOut']);
    Route::post('{contract}/activate', [ContractController::class, 'activate']);
});

// FR-020..FR-023, FR-027: Billing endpoints (Admin/Staff create/update, all roles view)
Route::middleware(['auth:sanctum', 'auth.check'])->prefix('billing')->group(function (): void {
    Route::get('/', [BillingController::class, 'index']);
    Route::post('/', [BillingController::class, 'store']);
    Route::get('{billing}', [BillingController::class, 'show']);
    Route::patch('{billing}/status', [BillingController::class, 'updateStatus']);
    Route::post('initialize/{contractId}', [BillingController::class, 'initialize']);
});

// FR-024..FR-027: Payment endpoints (Admin/Staff create, all roles view history)
Route::middleware(['auth:sanctum', 'auth.check'])->prefix('payments')->group(function (): void {
    Route::get('/', [PaymentController::class, 'index']);
    Route::post('/', [PaymentController::class, 'store']);
    Route::get('{payment}', [PaymentController::class, 'show']);
    Route::delete('{payment}', [PaymentController::class, 'destroy']);
});

// FR-028..FR-032: Reporting and export endpoints (read-only for Admin/Staff/Viewer)
Route::middleware(['auth:sanctum', 'auth.check'])->prefix('reports')->group(function (): void {
    Route::get('occupancy-status', [ReportController::class, 'occupancyStatus']);
    Route::get('active-contracts', [ReportController::class, 'activeContracts']);
    Route::get('occupancy', [ReportController::class, 'occupancy']);
    Route::get('billing-summary', [ReportController::class, 'billingSummary']);
    Route::get('outstanding-balances', [ReportController::class, 'outstandingBalances']);
    Route::get('collections-performance', [ReportController::class, 'collectionsPerformance']);
    Route::get('tenant-ledger', [ReportController::class, 'tenantLedger']);
    Route::get('tenant-history', [ReportController::class, 'tenantHistory']);

    Route::get('occupancy-status/export', [ReportController::class, 'occupancyStatusExport']);
    Route::get('active-contracts/export', [ReportController::class, 'activeContractsExport']);
    Route::get('occupancy/export', [ReportController::class, 'occupancyExport']);
    Route::get('billing-summary/export', [ReportController::class, 'billingSummaryExport']);
    Route::get('outstanding-balances/export', [ReportController::class, 'outstandingBalancesExport']);
    Route::get('collections-performance/export', [ReportController::class, 'collectionsPerformanceExport']);
    Route::get('tenant-ledger/export', [ReportController::class, 'tenantLedgerExport']);
    Route::get('tenant-history/export', [ReportController::class, 'tenantHistoryExport']);
    Route::get('meter-coverage', [ReportController::class, 'meterCoverage']);
});

// FR-023: Philippine Compliance (Utility Sub-metering and Appliance Registry)
Route::middleware(['auth:sanctum', 'auth.check'])->group(function (): void {
    Route::get('appliances', [ComplianceController::class, 'index']);
    Route::get('appliances/stats', [ComplianceController::class, 'registryStats']);
    Route::get('add-ons', [ComplianceController::class, 'listAddOns']);
    Route::post('add-ons', [ComplianceController::class, 'storeAddOn']);
    Route::get('add-ons/{addOn}', [ComplianceController::class, 'show']);
    Route::put('add-ons/{addOn}', [ComplianceController::class, 'updateAddOn']);
    Route::patch('add-ons/{addOn}/status', [ComplianceController::class, 'updateAddOn']);

    Route::prefix('contracts/{contract}/add-ons')->group(function (): void {
        Route::post('/', [ComplianceController::class, 'attachAddOn']);
        Route::delete('{addOnId}', [ComplianceController::class, 'destroyContractAddOn']);
    });

    Route::prefix('rooms/{room}/meters')->group(function (): void {
        Route::get('/', [ComplianceController::class, 'listRoomMeters']);
        Route::post('/', [ComplianceController::class, 'storeMeterReading']);
    });
});

// FR-033, FR-034: Audit log inspection endpoints (Admin only)
Route::middleware(['auth:sanctum', 'auth.check'])->group(function (): void {
    Route::get('/audit-logs', [AuditLogController::class, 'index']);
    Route::get('/audit-logs/export', [AuditLogController::class, 'export']);
    Route::get('/transaction-logs', [TransactionController::class, 'index']);
});

Route::get('/health', function () {
    try {
        \DB::connection()->getPdo();
        return response()->json([
            'status' => 'ok',
            'database' => 'connected',
            'service' => 'havenstay-backend',
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'status' => 'error',
            'database' => 'disconnected',
            'message' => $e->getMessage(),
            'service' => 'havenstay-backend',
        ], 500);
    }
});
