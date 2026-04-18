<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Contract\MoveOutRequest;
use App\Http\Requests\Contract\StoreContractRequest;
use App\Http\Requests\Contract\UpdateContractRequest;
use App\Models\Contract;
use App\Services\Analytics\PiiMaskingService;
use App\Services\Identity\AuthorizationService;
use App\Services\Operations\ContractService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContractController extends Controller
{
    /**
     * List all contracts with deep filtering and pagination.
     * Authorized: Admin, Staff.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanViewContracts($request->user());

        $validated = $request->validate(array_merge([
            'tenant_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', 'max:32'],
            'q' => ['nullable', 'string', 'max:200'],
        ], Pagination::queryRules()));

        $pageParams = Pagination::normalizePageParams($validated);

        $paginator = ContractService::listPaginated($validated, $pageParams['page'], $pageParams['per_page']);

        $paginator->through(function (Contract $contract) use ($request) {
            $row = $contract->toArray();

            return PiiMaskingService::maskContractNestedTenant($request->user(), $row);
        });

        return Pagination::fromPaginator($paginator);
    }

    public function store(StoreContractRequest $request): JsonResponse
    {
        AuthorizationService::ensureCanManageContracts($request->user());

        $validated = $request->validated();

        $contract = ContractService::create($request->user(), $validated);

        return response()->json([
            'message' => 'Contract created successfully.',
            'data' => $contract,
        ], 201);
    }

    public function show(Request $request, Contract $contract): JsonResponse
    {
        AuthorizationService::ensureCanViewContracts($request->user());

        $loaded = ContractService::getById((int) $contract->contract_id);
        if (!$loaded) {
            return response()->json(['message' => 'Contract not found.'], 404);
        }

        $payload = PiiMaskingService::maskContractNestedTenant($request->user(), $loaded->toArray());

        return response()->json([
            'message' => 'Contract retrieved successfully.',
            'data' => $payload,
        ]);
    }

    public function moveOut(MoveOutRequest $request, Contract $contract): JsonResponse
    {
        AuthorizationService::ensureCanManageContracts($request->user());

        $validated = $request->validated();

        $updated = ContractService::moveOut($request->user(), $contract, $validated);

        return response()->json([
            'message' => 'Contract move-out processed successfully.',
            'data' => $updated,
        ]);
    }

    /**
     * Activate a contract (Post-payment verification)
     */
    public function activate(Request $request, Contract $contract): JsonResponse
    {
        AuthorizationService::ensureCanManageContracts($request->user());

        $contract = ContractService::activate($request->user(), $contract);

        return response()->json([
            'message' => 'Contract activated. Tenant bed space is now occupied.',
            'data' => $contract,
        ]);
    }

    public function update(UpdateContractRequest $request, Contract $contract): JsonResponse
    {
        AuthorizationService::ensureCanManageContracts($request->user());

        $validated = $request->validated();

        if ($contract->status === Contract::STATUS_ACTIVE) {
            if (array_key_exists('status', $validated) && $validated['status'] !== Contract::STATUS_ACTIVE) {
                return response()->json([
                    'message' => 'Active contracts cannot be transitioned via contract update. Process move-out first.',
                ], 422);
            }

            // Even if `status` is not changed, setting `actual_move_out_date` is part of completing a stay.
            if (array_key_exists('actual_move_out_date', $validated) && !empty($validated['actual_move_out_date'])) {
                return response()->json([
                    'message' => 'Active contracts cannot set actual move-out date via contract update. Process move-out first.',
                ], 422);
            }
        }

        $contract = ContractService::update($request->user(), $contract, $validated);

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
        AuthorizationService::ensureCanManageContracts($request->user());

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
        AuthorizationService::ensureCanManageContracts($request->user());

        $contract = ContractService::restore($request->user(), $id);

        return response()->json([
            'message' => 'Contract agreement restored to operational history.',
            'data' => $contract,
        ]);
    }
}
