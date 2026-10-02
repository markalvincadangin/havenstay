<?php

use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BillingController;
use App\Http\Controllers\Api\ContractController;
use App\Http\Controllers\Api\MeterController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RoomController;
use App\Http\Controllers\Api\TenantController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\UtilityController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function (): void {
    Route::post('login', [AuthController::class, 'login']);

    // OAuth: External Identity Verification
    Route::get('google/redirect', [\App\Http\Controllers\Api\OAuthController::class, 'redirectToGoogle']);
    Route::get('google/callback', [\App\Http\Controllers\Api\OAuthController::class, 'handleGoogleCallback']);

    Route::middleware(['auth:sanctum', 'auth.check', 'audit.context'])->group(function (): void {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('logout', [AuthController::class, 'logout']);
    });
});

Route::middleware(['auth:sanctum', 'auth.check', 'audit.context'])->get('/user', function (Request $request) {
    return $request->user();
});

// FR-005, FR-006: User management endpoints (Admin only)
Route::middleware(['auth:sanctum', 'auth.check', 'audit.context'])->prefix('users')->group(function (): void {
    Route::get('/', [UserController::class, 'index']);
    Route::get('roles', [UserController::class, 'roles']);
    Route::get('summary', [UserController::class, 'summary']);
    Route::post('/', [UserController::class, 'store']);
    Route::get('{user}', [UserController::class, 'show'])->withTrashed();
    Route::put('{user}', [UserController::class, 'update']);
    Route::post('{user}/deactivate', [UserController::class, 'deactivate']);
    Route::post('{user}/reactivate', [UserController::class, 'reactivate']);
    Route::post('{user}/archive', [UserController::class, 'archive']);
    Route::post('{id}/restore', [UserController::class, 'restore']);
    Route::post('{user}/assign-role', [UserController::class, 'assignRole']);
});

// FR-008..FR-011: Tenant management endpoints (Admin/Staff)
Route::middleware(['auth:sanctum', 'auth.check', 'audit.context'])->prefix('tenants')->group(function (): void {
    Route::get('/', [TenantController::class, 'index']);
    Route::get('summary', [TenantController::class, 'summary']);
    Route::post('/', [TenantController::class, 'store']);
    Route::get('search', [TenantController::class, 'search']);
    Route::post('existence-check', [TenantController::class, 'existenceCheck']);
    Route::get('{tenant}', [TenantController::class, 'show'])->withTrashed();
    Route::put('{tenant}', [TenantController::class, 'update'])->withTrashed();
    Route::post('{tenant}/archive', [TenantController::class, 'archive'])->withTrashed();
    Route::post('{id}/restore', [TenantController::class, 'restore']);
});

// FR-012..FR-015: Room and bed-space management endpoints (Admin/Staff)
Route::middleware(['auth:sanctum', 'auth.check', 'audit.context'])->prefix('rooms')->group(function (): void {
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
    Route::get('{room}/meters', [MeterController::class, 'roomMeters']);
});

// FR-016..FR-019: Contract management endpoints (Admin/Staff create + move-out, all roles view)
Route::middleware(['auth:sanctum', 'auth.check', 'audit.context'])->prefix('contracts')->group(function (): void {
    Route::get('/', [ContractController::class, 'index']);
    Route::post('/', [ContractController::class, 'store']);
    Route::get('{contract}', [ContractController::class, 'show'])->withTrashed();
    Route::put('{contract}', [ContractController::class, 'update']);
    Route::post('{contract}/archive', [ContractController::class, 'archive']);
    Route::post('{id}/restore', [ContractController::class, 'restore']);
    Route::post('{contract}/move-out', [ContractController::class, 'moveOut']);
    Route::post('{contract}/activate', [ContractController::class, 'activate']);
    Route::post('{contract}/void', [ContractController::class, 'void']);
});

// FR-020..FR-023, FR-027: Billing endpoints (Admin/Staff create/update, all roles view)
Route::middleware(['auth:sanctum', 'auth.check', 'audit.context'])->prefix('billing')->group(function (): void {
    Route::get('/', [BillingController::class, 'index']);
    Route::post('/', [BillingController::class, 'store']);
    Route::get('{billing}', [BillingController::class, 'show']);
    Route::patch('{billing}/status', [BillingController::class, 'updateStatus']);
    Route::post('initialize/{contractId}', [BillingController::class, 'initialize']);

    // Wizard endpoints
    Route::post('forecast', [BillingController::class, 'forecastUtility']);
    Route::post('commit-utility', [BillingController::class, 'commitUtility']);
});

// FR-024..FR-027: Payment endpoints (Admin/Staff create, all roles view history)
Route::middleware(['auth:sanctum', 'auth.check', 'audit.context'])->prefix('payments')->group(function (): void {
    Route::get('/', [PaymentController::class, 'index']);
    Route::post('/', [PaymentController::class, 'store']);
    Route::post('composite', [PaymentController::class, 'storeComposite']);
    Route::get('{payment}', [PaymentController::class, 'show']);
    Route::post('{payment}/void', [PaymentController::class, 'void']);
});

// FR-028..FR-032: Reporting and export endpoints (Admin only)
Route::middleware(['auth:sanctum', 'auth.check', 'audit.context'])->prefix('reports')->group(function (): void {
    Route::get('occupancy-status', [ReportController::class, 'occupancyStatus']);
    Route::get('active-contracts', [ReportController::class, 'activeContracts']);
    Route::get('occupancy', [ReportController::class, 'occupancy']);
    Route::get('billing-summary', [ReportController::class, 'billingSummary']);
    Route::get('outstanding-balances', [ReportController::class, 'outstandingBalances']);
    Route::get('collections-performance', [ReportController::class, 'collectionsPerformance']);
    Route::get('tenant-ledger', [ReportController::class, 'tenantLedger']);
    Route::get('tenant-history', [ReportController::class, 'tenantHistory']);

    Route::get('meter-summary', [ReportController::class, 'meterCoverage']);
    Route::get('security-pulse', [ReportController::class, 'securityPulse']);
    Route::get('user-summary', [ReportController::class, 'userSummary']);

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

// FR-023: Meter Asset Management & Metrology
Route::middleware(['auth:sanctum', 'auth.check', 'audit.context'])->prefix('meters')->group(function (): void {
    Route::get('/', [MeterController::class, 'index']);
    Route::get('{meter}', [MeterController::class, 'show']);
    Route::post('{meter}/assign', [MeterController::class, 'assign']);

    // Meter Readings
    Route::get('{meter}/readings', [MeterController::class, 'listReadings']);
    Route::get('{meter}/last-billed', [MeterController::class, 'lastBilled']);
    Route::post('{meter}/readings', [MeterController::class, 'recordReading']);
});

// Utilities and Utility Rates (Registry)
Route::middleware(['auth:sanctum', 'auth.check', 'audit.context'])->prefix('utilities')->group(function (): void {
    Route::get('/', [UtilityController::class, 'index']);
    Route::get('{utility}', [UtilityController::class, 'show']);
    Route::post('/', [UtilityController::class, 'store']);
    Route::put('{utility}', [UtilityController::class, 'update']);
    Route::post('{utility}/archive', [UtilityController::class, 'archive']);
    Route::post('rates', [UtilityController::class, 'storeRate']);
});

// FR-033, FR-034: Audit log inspection endpoints (Admin only)
Route::middleware(['auth:sanctum', 'auth.check', 'audit.context'])->group(function (): void {
    Route::get('/audit-logs', [AuditLogController::class, 'index']);
    Route::get('/audit-logs/export', [AuditLogController::class, 'export']);
});

Route::get('/health', function () {
    try {
        DB::connection()->getPdo();

        return response()->json([
            'status' => 'ok',
            'database' => 'connected',
            'service' => 'havenstay-backend',
        ]);
    } catch (Exception $e) {
        return response()->json([
            'status' => 'error',
            'database' => 'disconnected',
            'message' => $e->getMessage(),
            'service' => 'havenstay-backend',
        ], 500);
    }
});

// Lightweight ping for keep-alive services
Route::get('/ping', function () {
    return response()->json(['status' => 'pong', 'timestamp' => now()]);
});
