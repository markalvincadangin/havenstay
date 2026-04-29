<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Billing\CommitUtilityBillingRequest;
use App\Http\Requests\Billing\IndexBillingRequest;
use App\Http\Requests\Billing\StoreBillingRequest;
use App\Http\Requests\Billing\UpdateBillingStatusRequest;
use App\Http\Requests\Billing\UtilityForecastRequest;
use App\Http\Resources\BillingResource;
use App\Models\Billing;
use App\Services\Core\AuthorizationService;
use App\Services\Operations\BillingService;
use App\Services\Operations\UtilityApportionmentService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * BillingController
 *
 * Orchestrates the billing generation lifecycle and authoritative status reconciliation.
 * Optimized for HavenStay Forensic v5.0 with API Resource serialization.
 */
class BillingController extends Controller
{
    /**
     * FR-031: List billing history with forensic filters.
     */
    public function index(IndexBillingRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $pageParams = Pagination::normalizePageParams($validated);

        $paginator = BillingService::listPaginated($validated, $pageParams['page'], $pageParams['per_page']);

        return $this->paginated($paginator, [], 'Billing records retrieved successfully.', BillingResource::class);
    }

    /**
     * FR-031a: Retrieve detailed billing forensic trace.
     */
    public function show(Request $request, Billing $billing): JsonResponse
    {
        AuthorizationService::ensureCanViewBilling($request->user());

        $loaded = BillingService::getById((int) $billing->billing_id);
        if (! $loaded) {
            return $this->error('Billing record not found.', 404);
        }

        return $this->success('Billing record retrieved successfully.', new BillingResource($loaded));
    }

    /**
     * FR-032: Generate a new billing cycle (Rent + Utilities).
     */
    public function store(StoreBillingRequest $request): JsonResponse
    {
        $data = $request->validated();

        // Middleware handles lock/replay. Pass key for DB constraint.
        $data['idempotency_key'] = $request->header('Idempotency-Key');

        $billing = BillingService::create($request->user(), $data);

        return $this->created('Billing record generated successfully.', new BillingResource($billing));
    }

    /**
     * FR-033: Update authoritative billing status (Paid/Overdue).
     */
    public function updateStatus(UpdateBillingStatusRequest $request, Billing $billing): JsonResponse
    {
        $updated = BillingService::syncBillingStatus($request->user(), $billing);

        return $this->success('Billing status synchronized.', new BillingResource($updated));
    }

    /**
     * Initialize billing for a new contract (Advance Rent).
     */
    public function initialize(Request $request, int $contractId): JsonResponse
    {
        AuthorizationService::ensureCanManageBilling($request->user());

        $idempotencyKey = $request->header('Idempotency-Key');

        $billing = BillingService::initializeContractBilling($request->user(), $contractId, $idempotencyKey);

        return $this->created('Initial contract billing generated.', new BillingResource($billing));
    }

    /**
     * Utility Wizard: Forecast consumption costs before committing.
     */
    public function forecastUtility(UtilityForecastRequest $request): JsonResponse
    {
        $forecast = UtilityApportionmentService::forecast($request->validated());

        return $this->success('Utility forecast calculated successfully.', $forecast);
    }

    /**
     * Utility Wizard: Atomic commit of utility charges across room occupants.
     */
    public function commitUtility(CommitUtilityBillingRequest $request): JsonResponse
    {
        $billings = UtilityApportionmentService::commit($request->user(), $request->validated());

        return $this->created('Utility charges committed successfully.', BillingResource::collection($billings));
    }
}
