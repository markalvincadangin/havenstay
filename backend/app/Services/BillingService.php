<?php

namespace App\Services;

use App\Services\Concerns\ManagesWorkflows;
use App\Models\Billing;
use App\Models\BillingLineItem;
use App\Models\Contract;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BillingService
{
    use ManagesWorkflows;

    public static function create(User $actor, array $data): Billing
    {
        self::validateCreateInput($data);

        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'GENERATE_BILLING',
            txnReference: self::buildTxnReference('BIL'),
            payload: ['contract_id' => $data['contract_id']],
            operation: function () use ($data): Billing {
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
            },
            resultDetails: function (Billing $result): array {
                return [
                    'billing_id' => $result->billing_id,
                    'contract_id' => $result->contract_id,
                    'amount_due' => (float) $result->lineItems()->sum('amount'),
                ];
            }
        );
    }

    /**
     * List billing records with filters (query builder for pagination).
     *
     * @param  array{contract_id?: int, tenant_id?: int, q?: string, status?: string, receivable_state?: string}  $filters
     * @return Builder<Billing>
     */
    public static function listQuery(array $filters = []): Builder
    {
        $query = Billing::with(['contract.tenant', 'contract.room', 'contract.bedSpace', 'lineItems', 'payments']);

        if (! empty($filters['contract_id'])) {
            $query->where('contract_id', (int) $filters['contract_id']);
        }

        if (! empty($filters['tenant_id'])) {
            $query->whereHas('contract', function ($q) use ($filters): void {
                $q->where('tenant_id', (int) $filters['tenant_id']);
            });
        }

        if (! empty($filters['due_date'])) {
            $query->whereDate('due_date', $filters['due_date']);
        }

        if (! empty($filters['receivable_state'])) {
            if ($filters['receivable_state'] === 'past_due') {
                $query->whereDate('due_date', '<', now()->toDateString())
                    ->whereRaw(
                        '((
                            SELECT COALESCE(SUM(billing_line_items.amount), 0) FROM billing_line_items WHERE billing_line_items.billing_id = billing.billing_id
                        ) - (
                            SELECT COALESCE(SUM(payments.amount_paid), 0) FROM payments WHERE payments.billing_id = billing.billing_id AND payments.voided_at IS NULL
                        )) > 0'
                    );
            } elseif ($filters['receivable_state'] === 'current') {
                $query->whereDate('due_date', '>=', now()->toDateString())
                    ->whereRaw(
                        '((
                            SELECT COALESCE(SUM(billing_line_items.amount), 0) FROM billing_line_items WHERE billing_line_items.billing_id = billing.billing_id
                        ) - (
                            SELECT COALESCE(SUM(payments.amount_paid), 0) FROM payments WHERE payments.billing_id = billing.billing_id AND payments.voided_at IS NULL
                        )) > 0'
                    );
            }
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['q'])) {
            $needle = trim($filters['q']);
            $query->where(function ($w) use ($needle): void {
                $w->where('billing_id', 'like', "%{$needle}%")
                    ->orWhereHas('contract.tenant', function ($t) use ($needle): void {
                        $t->where('first_name', 'like', "%{$needle}%")
                            ->orWhere('last_name', 'like', "%{$needle}%")
                            ->orWhere('contact_number', 'like', "%{$needle}%");
                    });
                if (ctype_digit($needle)) {
                    $w->orWhere('billing_id', (int) $needle)
                        ->orWhereHas('contract', function ($c) use ($needle): void {
                            $c->where('tenant_id', (int) $needle);
                        });
                }
            });
        }

        $query->orderByDesc('billing_id');

        return $query;
    }

    /**
     * List billing records with filters and precomputed sums.
     * Used by the controller to keep `BillingController` free of DB facade imports.
     *
     * @return Builder<Billing>
     */
    public static function listQueryWithSums(array $filters = []): Builder
    {
        $query = self::listQuery($filters);

        $query->withSum(['lineItems as total_amount' => function ($q): void {
            $q->select(DB::raw('COALESCE(SUM(amount), 0)'));
        }], 'amount');

        $query->withSum(['payments as total_paid' => function ($q): void {
            $q->select(DB::raw('COALESCE(SUM(amount_paid), 0)'))->whereNull('voided_at');
        }], 'amount_paid');

        return $query;
    }


    /**
     * Find a billing record by ID with relations.
     */
    public static function getById(int $billingId): ?Billing
    {
        $billing = Billing::with(['contract.tenant', 'contract.room', 'contract.bedSpace', 'lineItems', 'payments.processor'])
            ->withSum(['lineItems as total_amount' => function ($q): void {
                $q->select(DB::raw('COALESCE(SUM(amount), 0)'));
            }], 'amount')
            ->withSum(['payments as total_paid' => function ($q): void {
                $q->select(DB::raw('COALESCE(SUM(amount_paid), 0)'))->whereNull('voided_at');
            }], 'amount_paid')
            ->find($billingId);

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

        // Compute from relations
        $amountDue = (float) $billing->lineItems()->sum('amount');
        $amountPaid = (float) $billing->payments()->whereNull('voided_at')->sum('amount_paid');

        $dueDate = $billing->due_date;
        $today = now()->toDateString();

        if ($amountPaid >= $amountDue) {
            $newStatus = 'paid';
        } elseif ($dueDate < $today && $amountPaid < $amountDue) {
            $newStatus = 'overdue';
        } elseif ($amountPaid > 0) {
            $newStatus = 'partial';
        } else {
            $newStatus = 'unpaid';
        }

        if ($oldStatus !== $newStatus) {
            $billing->update(['status' => $newStatus]);
        }

        return $billing;
    }

    /**
     * Optimized status check that uses pre-loaded sums if available
     * and avoids DB writes if the status is already correct.
     */
    public static function quietAutoUpdateStatus(Billing $billing): void
    {
        // Use pre-computed sums if available from the collection/query
        $amountDue = (float) ($billing->total_amount ?? $billing->lineItems()->sum('amount'));
        $amountPaid = (float) ($billing->total_paid ?? $billing->payments()->whereNull('voided_at')->sum('amount_paid'));

        $dueDate = $billing->due_date;
        $today = now()->toDateString();

        if ($amountPaid >= $amountDue) {
            $newStatus = 'paid';
        } elseif ($dueDate < $today && $amountPaid < $amountDue) {
            $newStatus = 'overdue';
        } elseif ($amountPaid > 0) {
            $newStatus = 'partial';
        } else {
            $newStatus = 'unpaid';
        }

        if ($billing->status !== $newStatus) {
            $billing->update(['status' => $newStatus]);
        }
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

            if (empty($item['item_description'])) {
                throw ValidationException::withMessages([
                    "line_items.$index.item_description" => ['Line item description is required.'],
                ]);
            }

            $totalAmount += $amount;
        }
        if ($totalAmount < 0) {
            throw ValidationException::withMessages([
                'line_items' => ['The total billing amount cannot be negative.'],
            ]);
        }
    }
}
