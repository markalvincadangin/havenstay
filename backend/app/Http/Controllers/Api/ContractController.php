<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Services\AuditService;
use App\Services\AuthorizationService;
use App\Services\ContractService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContractController extends Controller
{
    /**
     * FR-016: List all contracts with tenant, room, bed space relations.
     */
    public function index(Request $request): JsonResponse
    {
        if (! AuthorizationService::canViewContracts($request->user())) {
            AuditService::logAccessDenied($request->user(), 'contracts.list');

            return response()->json([
                'message' => 'Unauthorized: you do not have permission to view contracts.',
            ], 403);
        }

        $query = Contract::with(['tenant', 'room', 'bedSpace', 'creator', 'latestBilling']);

        if ($request->filled('tenant_id')) {
            $query->where('tenant_id', (int) $request->query('tenant_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $contracts = $query->orderByDesc('contract_id')->get();

        return response()->json($contracts);
    }

    /**
     * FR-016..FR-018, TC-CONTRACT-001: Create contract.
     */
    public function store(Request $request): JsonResponse
    {
        if (! AuthorizationService::canManageContracts($request->user())) {
            AuditService::logAccessDenied($request->user(), 'contracts.create');

            return response()->json([
                'message' => 'Unauthorized: only Admin or Staff can create contracts.',
            ], 403);
        }

        $validated = $request->validate([
            'tenant_id' => ['required', 'integer', 'exists:tenants,tenant_id'],
            'room_id' => ['required', 'integer', 'exists:rooms,room_id'],
            'bed_space_id' => ['nullable', 'integer', 'exists:bed_spaces,bed_space_id'],
            'move_in_date' => ['required', 'date'],
            'expected_move_out' => ['nullable', 'date'],
            'deposit_amount' => ['nullable', 'numeric', 'min:0'],
            'monthly_rate' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);

        $contract = ContractService::create($request->user(), $validated);

        return response()->json([
            'message' => 'Contract created successfully.',
            'contract' => $contract,
        ], 201);
    }

    /**
     * FR-018: Show contract details.
     */
    public function show(Request $request, Contract $contract): JsonResponse
    {
        if (! AuthorizationService::canViewContracts($request->user())) {
            AuditService::logAccessDenied($request->user(), 'contracts.view');

            return response()->json([
                'message' => 'Unauthorized: you do not have permission to view contracts.',
            ], 403);
        }

        $loaded = ContractService::getById((int) $contract->contract_id);

        return response()->json($loaded);
    }

    /**
     * FR-019, TC-CONTRACT-003, TC-TX-004..006: Move out contract.
     */
    public function moveOut(Request $request, Contract $contract): JsonResponse
    {
        if (! AuthorizationService::canManageContracts($request->user())) {
            AuditService::logAccessDenied($request->user(), 'contracts.move_out');

            return response()->json([
                'message' => 'Unauthorized: only Admin or Staff can process move-out.',
            ], 403);
        }

        $validated = $request->validate([
            'actual_move_out' => ['required', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $updated = ContractService::moveOut($contract, $validated);

        return response()->json([
            'message' => 'Contract move-out processed successfully.',
            'contract' => $updated,
        ]);
    }

    /**
     * FR-017, TC-CONTRACT-002: Update an existing contract.
     */
    public function update(Request $request, Contract $contract): JsonResponse
    {
        if (! AuthorizationService::canManageContracts($request->user())) {
            AuditService::logAccessDenied($request->user(), 'contracts.update');

            return response()->json([
                'message' => 'Unauthorized: only Admin or Staff can update contracts.',
            ], 403);
        }

        $validated = $request->validate([
            'expected_move_out' => ['sometimes', 'nullable', 'date'],
            'actual_move_out' => ['sometimes', 'nullable', 'date'],
            'deposit_amount' => ['sometimes', 'numeric', 'min:0'],
            'monthly_rate' => ['sometimes', 'numeric', 'min:0'],
            'status' => ['sometimes', 'in:active,completed,terminated'],
            'notes' => ['sometimes', 'nullable', 'string'],
        ]);

        $contract = ContractService::update($request->user(), $contract, $validated);

        return response()->json([
            'message' => 'Contract updated successfully.',
            'contract' => $contract,
        ]);
    }
}
