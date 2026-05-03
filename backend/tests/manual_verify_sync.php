<?php
use App\Models\Tenant;
use App\Models\Contract;
use App\Enums\TenantStatus;
use App\Enums\ContractStatus;
use App\Services\Operations\TenantService;

// Mock test for syncStatus
function testSyncStatus() {
    // 1. Create Onboarded Tenant
    $tenant = Tenant::create([
        'first_name' => 'Test',
        'last_name' => 'User',
        'email' => 'test@example.com',
        'contact_number' => '09123456789',
        'emergency_contact_name' => 'N/A',
        'emergency_contact_number' => '09123456789',
        'address' => 'N/A'
    ]);
    echo "Initial Status: " . $tenant->status->value . " (Expected: onboarded)\n";

    // 2. Add Pending Contract
    $contract = Contract::create([
        'tenant_id' => $tenant->tenant_id,
        'status' => ContractStatus::PENDING_PAYMENT,
        // ... other fields
    ]);
    TenantService::syncStatus($tenant->tenant_id);
    $tenant->refresh();
    echo "After Contract: " . $tenant->status->value . " (Expected: active)\n";

    // 3. Void Contract
    $contract->update(['status' => ContractStatus::VOIDED]);
    TenantService::syncStatus($tenant->tenant_id);
    $tenant->refresh();
    echo "After Void: " . $tenant->status->value . " (Expected: onboarded)\n";
    
    // 4. Complete a real contract
    $contract->update(['status' => ContractStatus::COMPLETED]);
    TenantService::syncStatus($tenant->tenant_id);
    $tenant->refresh();
    echo "After Completed: " . $tenant->status->value . " (Expected: moved_out)\n";
    
    // Cleanup
    $contract->delete();
    $tenant->forceDelete();
}

testSyncStatus();
