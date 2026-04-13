<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Services\AuditService;
use App\Services\AuthorizationService;
use App\Services\ContractService;
use App\Support\PaginationResponse;
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

        $validated = $request->validate(array_merge([
            'tenant_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', 'max:32'],
            'q' => ['nullable', 'string', 'max:200'],
        ], PaginationResponse::queryRules()));

        $pageParams = PaginationResponse::normalizePageParams($validated);

        $query = Contract::with(['tenant', 'room', 'bedSpace', 'creator', 'latestBilling']);

        if (! empty($validated['tenant_id'])) {
            $query->where('tenant_id', (int) $validated['tenant_id']);
        }

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if (! empty($validated['q'])) {
            $needle = trim($validated['q']);
            $query->where(function ($w) use ($needle): void {
                $w->where('contracts.contract_id', 'like', "%{$needle}%")
                    ->orWhereHas('tenant', function ($t) use ($needle): void {
                        $t->where('first_name', 'like', "%{$needle}%")
                            ->orWhere('last_name', 'like', "%{$needle}%")
                            ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$needle}%"]);
                    })
                    ->orWhereHas('room', function ($r) use ($needle): void {
                        $r->where('room_code', 'like', "%{$needle}%");
                    });
            });
        }

        $paginator = $query->orderByDesc('contract_id')
            ->paginate($pageParams['per_page'], ['*'], 'page', $pageParams['page']);

        return PaginationResponse::fromPaginator($paginator);
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
            'expected_move_out' => ['required', 'date'],
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

    /**
     * Archive a contract (Soft Delete)
     */
    public function archive(Request $request, Contract $contract): JsonResponse
    {
        if (! AuthorizationService::canManageContracts($request->user())) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $contract->delete();

        return response()->json([
            'message' => 'Contract agreement archived for forensic retention.',
            'contract' => $contract,
        ]);
    }

    /**
     * Restore an archived contract
     */
    public function restore(Request $request, int $id): JsonResponse
    {
        if (! AuthorizationService::canManageContracts($request->user())) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $contract = Contract::withTrashed()->findOrFail($id);
        $contract->restore();

        return response()->json([
            'message' => 'Contract agreement restored to operational history.',
            'contract' => $contract,
        ]);
    }
}
