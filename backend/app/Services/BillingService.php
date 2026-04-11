<?php

namespace App\Services;

use App\Models\Billing;
use App\Models\BillingLineItem;
use App\Models\Contract;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BillingService
{
    /**
     * Create a new billing record with line items within a transaction.
     *
     * @param  array{contract_id: int, billing_period_from: string, billing_period_to: string, due_date: string, line_items: array[]}  $data
     *
     * @throws ValidationException
     */
    public static function create(array $data): Billing
    {
        self::validateCreateInput($data);

        // CCR-007: Transaction log entry
        $txLogId = TransactionService::logStarted(
            'billing_generation',
            auth()->id() ?? 0,
            'contracts',
            (string) $data['contract_id']
        );

        try {
            // CCR-006: Explicit transaction — START TRANSACTION / COMMIT / ROLLBACK
            $result = DB::transaction(function () use ($data): Billing {
                // CCR-003: INSERT operations
                $billing = Billing::create([
                    'contract_id' => (int) $data['contract_id'],
                    'billing_period_from' => $data['billing_period_from'],
                    'billing_period_to' => $data['billing_period_to'],
                    'due_date' => $data['due_date'],
                    'status' => 'unpaid',
                ]);

                foreach ($data['line_items'] as $item) {
                    BillingLineItem::create([
                        'billing_id' => $billing->billing_id,
                        'item_type' => $item['item_type'],
                        'item_description' => Arr::get($item, 'item_description'),
                        'amount' => $item['amount'],
                    ]);
                }

                return self::getById((int) $billing->billing_id);
            });

            TransactionService::logCommitted($txLogId, [
                'billing_id' => $result->billing_id,
                'contract_id' => $result->contract_id,
                'amount_due' => (float) $result->lineItems()->sum('amount'),
            ]);

            return $result;
        } catch (\Exception $e) {
            TransactionService::logRolledBack($txLogId, $e->getMessage());
            throw $e;
        }
    }

    /**
     * List billing records with filters.
     *
     * @param  array{contract_id?: int, tenant_id?: int}  $filters
     * @return Collection<Billing>
     */
    public static function list(array $filters = []): Collection
    {
        // CCR-003: SELECT query with filters
        $query = Billing::with(['contract.tenant', 'contract.room', 'lineItems', 'payments']);

        if (! empty($filters['contract_id'])) {
            $query->where('contract_id', (int) $filters['contract_id']);
        }

        if (! empty($filters['tenant_id'])) {
            $query->whereHas('contract', function ($q) use ($filters): void {
                $q->where('tenant_id', (int) $filters['tenant_id']);
            });
        }

        $billings = $query->orderByDesc('billing_id')->get();

        // BR-008: Status must track calendar (e.g. unpaid → overdue after due_date) even when no payment posted.
        foreach ($billings as $billing) {
            /** @var Billing $billing */
            if ($billing instanceof Billing) {
                self::autoUpdateStatus($billing);
            }
        }

        return $billings;
    }

    /**
     * Find a billing record by ID with relations.
     */
    public static function getById(int $billingId): ?Billing
    {
        $billing = Billing::with(['contract.tenant', 'contract.room', 'lineItems', 'payments.processor'])->find($billingId);

        if ($billing) {
            self::autoUpdateStatus($billing);
        }

        return $billing;
    }

    /**
     * Synchronize billing status based on amount paid vs amount due.
     * Totals are computed from relations to ensure data integrity.
     */
    public static function autoUpdateStatus(Billing $billing): Billing
    {
        $oldStatus = $billing->status;

        // Compute from relations since columns were removed in hardening
        $amountDue = (float) $billing->lineItems()->sum('amount');
        // FR-026a: Exclude voided payments from balance computations
        $amountPaid = (float) $billing->payments()->whereNull('voided_at')->sum('amount_paid');

        $dueDate = $billing->due_date;
        $today = now()->toDateString();

        if ($amountPaid >= $amountDue && $amountDue > 0) {
            $newStatus = 'paid';
        } elseif ($amountPaid > 0) {
            $newStatus = 'partial';
        } else {
            $newStatus = ($dueDate < $today) ? 'overdue' : 'unpaid';
        }

        if ($oldStatus !== $newStatus) {
            // CCR-003: UPDATE billing status
            $billing->update(['status' => $newStatus]);
        }

        return $billing;
    }

    private static function validateCreateInput(array $data): void
    {
        $contract = Contract::find((int) $data['contract_id']);

        if (! $contract || $contract->status !== 'active') {
            throw ValidationException::withMessages([
                'contract_id' => ['Contract must exist and be active for billing generation.'],
            ]);
        }

        if ($data['billing_period_to'] < $data['billing_period_from']) {
            throw ValidationException::withMessages([
                'billing_period_to' => ['Billing period end must be on or after billing period start.'],
            ]);
        }

        $hasDuplicateCycle = Billing::where('contract_id', (int) $data['contract_id'])
            ->whereDate('billing_period_from', $data['billing_period_from'])
            ->whereDate('billing_period_to', $data['billing_period_to'])
            ->exists();

        if ($hasDuplicateCycle) {
            throw ValidationException::withMessages([
                'billing_period_from' => ['Billing cycle already exists for this contract.'],
            ]);
        }

        if (! isset($data['line_items']) || ! is_array($data['line_items']) || count($data['line_items']) === 0) {
            throw ValidationException::withMessages([
                'line_items' => ['At least one billing line item is required.'],
            ]);
        }

        $totalAmount = 0;
        foreach ($data['line_items'] as $index => $item) {
            $amount = (float) $item['amount'];
            if ($amount === 0.0) {
                throw ValidationException::withMessages([
                    "line_items.$index.amount" => ['Line item amount cannot be zero.'],
                ]);
            }
            $totalAmount += $amount;
        }

        // FR-021b: Calculated total amount for a billing record MUST NOT be negative.
        if ($totalAmount < 0) {
            throw ValidationException::withMessages([
                'line_items' => ['The total billing amount cannot be negative.'],
            ]);
        }
    }
}
