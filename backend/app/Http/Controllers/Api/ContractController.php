<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Contract\IndexContractRequest;
use App\Http\Requests\Contract\ManageContractRequest;
use App\Http\Requests\Contract\MoveOutRequest;
use App\Http\Requests\Contract\StoreContractRequest;
use App\Http\Requests\Contract\UpdateContractRequest;
use App\Http\Resources\ContractResource;
use App\Models\Contract;
use App\Services\Core\AuthorizationService;
use App\Services\Operations\ContractService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ContractController
 *
 * Manages the lifecycle of lease agreements (check-in, activation, move-out).
 * Optimized for HavenStay Forensic v5.0 with API Resource serialization.
 */
class ContractController extends Controller
{
    /**
     * FR-021: List all tenant contracts with filtering.
     */
    public function index(IndexContractRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $pageParams = Pagination::normalizePageParams($validated);

        $paginator = ContractService::listPaginated($validated, $pageParams['page'], $pageParams['per_page']);

        return $this->paginated($paginator, [], 'Contracts retrieved successfully.', ContractResource::class);
    }

    /**
     * FR-021a: Retrieve detailed contract forensic record.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        AuthorizationService::ensureCanViewContracts($request->user());

        $loaded = ContractService::getById((int) $id);
        if (! $loaded) {
            return $this->error('Contract not found.', 404);
        }

        return $this->success('Contract retrieved successfully.', new ContractResource($loaded));
    }

    /**
     * FR-022: Initial check-in and contract creation.
     */
    public function store(StoreContractRequest $request): JsonResponse
    {
        $data = $request->validated();

        // Middleware handles the lock/replay. We just pass the key to the service.
        $data['idempotency_key'] = $request->header('Idempotency-Key');

        $contract = ContractService::create($request->user(), $data);

        return $this->created('Contract created successfully.', new ContractResource($contract));
    }

    /**
     * FR-023: Update contract metadata.
     */
    public function update(UpdateContractRequest $request, Contract $contract): JsonResponse
    {
        $updated = ContractService::update($request->user(), $contract, $request->validated());

        return $this->success('Contract updated successfully.', new ContractResource($updated));
    }

    /**
     * FR-024: Tenant move-out workflow.
     */
    public function moveOut(MoveOutRequest $request, Contract $contract): JsonResponse
    {
        $updated = ContractService::moveOut($request->user(), $contract, $request->validated());

        return $this->success('Move-out processed successfully. Room status synced.', new ContractResource($updated));
    }

    /**
     * FR-025: Activate lease after settlement.
     */
    public function activate(ManageContractRequest $request, Contract $contract): JsonResponse
    {
        $updated = ContractService::activate($request->user(), $contract);

        return $this->success('Contract activated successfully.', new ContractResource($updated));
    }

    /**
     * FR-022v: Void a contract created in error.
     */
    public function void(ManageContractRequest $request, Contract $contract): JsonResponse
    {
        $reason = $request->input('reason', 'Contract created in error');
        $voided = ContractService::void($request->user(), $contract, $reason);

        return $this->success('Contract voided successfully.', new ContractResource($voided));
    }

    /**
     * Archive a contract (Soft Delete).
     */
    public function archive(ManageContractRequest $request, Contract $contract): JsonResponse
    {
        $archived = ContractService::archive($request->user(), $contract);

        return $this->success('Contract archived successfully.', new ContractResource($archived));
    }

    /**
     * Restore an archived contract.
     */
    public function restore(ManageContractRequest $request, int $id): JsonResponse
    {
        $restored = ContractService::restore($request->user(), $id);

        return $this->success('Contract restored successfully.', new ContractResource($restored));
    }
}
