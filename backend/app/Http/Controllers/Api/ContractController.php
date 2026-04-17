<?php

namespace App\Http\Controllers\Api;

use App\Http\Concerns\HandlesAuthorization;
use App\Http\Controllers\Controller;
use App\Http\Requests\Contract\MoveOutRequest;
use App\Http\Requests\Contract\StoreContractRequest;
use App\Http\Requests\Contract\UpdateContractRequest;
use App\Models\Contract;
use App\Services\AuthorizationService;
use App\Services\ContractService;
use App\Services\PiiMaskingService;
use App\Support\PaginationResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContractController extends Controller
{
    use HandlesAuthorization;

    /**
     */
    public function index(Request $request): JsonResponse
    {
        if (! AuthorizationService::canViewContracts($request->user())) {
            return $this->forbidden($request, 'contracts.list', 'Unauthorized: you do not have permission to view contracts.');
        }

        $validated = $request->validate(array_merge([
            'tenant_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', 'max:32'],
            'q' => ['nullable', 'string', 'max:200'],
        ], PaginationResponse::queryRules()));

        $pageParams = PaginationResponse::normalizePageParams($validated);

        $paginator = ContractService::listPaginated($validated, $pageParams['page'], $pageParams['per_page']);

        $paginator->through(function (Contract $contract) use ($request) {
            $row = $contract->toArray();

            return PiiMaskingService::maskContractNestedTenant($request->user(), $row);
        });

        return PaginationResponse::fromPaginator($paginator);
    }

    /**
     */
    public function store(StoreContractRequest $request): JsonResponse
    {
        if (! AuthorizationService::canManageContracts($request->user())) {
            return $this->forbidden($request, 'contracts.create', 'Unauthorized: only Admin or Staff can create contracts.');
        }

        $validated = $request->validated();

        $contract = ContractService::create($request->user(), $validated);

        return response()->json([
            'message' => 'Contract created successfully.',
            'data' => $contract,
        ], 201);
    }

    /**
     */
    public function show(Request $request, Contract $contract): JsonResponse
    {
        if (! AuthorizationService::canViewContracts($request->user())) {
            return $this->forbidden($request, 'contracts.view', 'Unauthorized: you do not have permission to view contracts.');
        }

        $loaded = ContractService::getById((int) $contract->contract_id);
        if (! $loaded) {
            return response()->json(['message' => 'Contract not found.'], 404);
        }

        $payload = PiiMaskingService::maskContractNestedTenant($request->user(), $loaded->toArray());

        return response()->json([
            'message' => 'Contract retrieved successfully.',
            'data' => $payload,
        ]);
    }

    /**
     */
    public function moveOut(MoveOutRequest $request, Contract $contract): JsonResponse
    {
        if (! AuthorizationService::canManageContracts($request->user())) {
            return $this->forbidden($request, 'contracts.move_out', 'Unauthorized: only Admin or Staff can process move-out.');
        }

        $validated = $request->validated();

        $updated = ContractService::moveOut($request->user(), $contract, $validated);

        return response()->json([
            'message' => 'Contract move-out processed successfully.',
            'data' => $updated,
        ]);
    }

    /**
     */
    public function update(UpdateContractRequest $request, Contract $contract): JsonResponse
    {
        if (! AuthorizationService::canManageContracts($request->user())) {
            return $this->forbidden($request, 'contracts.update', 'Unauthorized: only Admin or Staff can update contracts.');
        }

        $validated = $request->validated();

        // Active contracts must be completed via the dedicated move-out workflow.
        // This prevents bypassing bed/vacancy synchronization and weakens audit traceability.
        if ((string) $contract->status === 'active') {
            if (array_key_exists('status', $validated) && $validated['status'] !== 'active') {
                return response()->json([
                    'message' => 'Active contracts cannot be transitioned via contract update. Process move-out first.',
                ], 422);
            }

            // Even if `status` is not changed, setting `actual_move_out` is part of completing a stay.
            if (array_key_exists('actual_move_out', $validated) && ! empty($validated['actual_move_out'])) {
                return response()->json([
                    'message' => 'Active contracts cannot set actual move-out date via contract update. Process move-out first.',
                ], 422);
            }
        }

        $mapped = $validated;
        if (array_key_exists('expected_move_out', $mapped)) {
            $mapped['expected_move_out_date'] = $mapped['expected_move_out'];
            unset($mapped['expected_move_out']);
        }
        if (array_key_exists('actual_move_out', $mapped)) {
            $mapped['actual_move_out_date'] = $mapped['actual_move_out'];
            unset($mapped['actual_move_out']);
        }
        if (array_key_exists('monthly_rate', $mapped) && ! array_key_exists('monthly_rate_override', $mapped)) {
            $mapped['monthly_rate_override'] = $mapped['monthly_rate'];
        }
        unset($mapped['monthly_rate']);

        $contract = ContractService::update($request->user(), $contract, $mapped);

        return response()->json([
            'message' => 'Contract updated successfully.',
            'data' => $contract,
        ]);
    }

    /**
     * Archive a contract (Soft Delete)
     */
    public function archive(Request $request, Contract $contract): JsonResponse
    {
        if (! AuthorizationService::canManageContracts($request->user())) {
            return $this->forbidden($request, 'contracts.archive', 'Unauthorized: only Admin or Staff can archive contracts.');
        }

        $contract = ContractService::archive($request->user(), $contract);

        return response()->json([
            'message' => 'Contract agreement archived for forensic retention.',
            'data' => $contract,
        ]);
    }

    /**
     * Restore an archived contract
     */
    public function restore(Request $request, int $id): JsonResponse
    {
        if (! AuthorizationService::canManageContracts($request->user())) {
            return $this->forbidden($request, 'contracts.restore', 'Unauthorized: only Admin or Staff can restore contracts.');
        }

        $contract = ContractService::restore($request->user(), $id);

        return response()->json([
            'message' => 'Contract agreement restored to operational history.',
            'data' => $contract,
        ]);
    }
}
