<?php

namespace App\Services\Analytics;

use App\Enums\RoleEnum;
use App\Models\User;

/**
 * Data privacy service. Handles masking of PII (names, emails, phones)
 * based on viewer role and domain context.
 */
class PiiMaskingService
{
    public static function shouldMaskTenantPii(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        $role = $user->role?->role_name;

        return $role === RoleEnum::VIEWER->value;
    }

    /**
     * @param  array<string, mixed>  $tenant
     * @return array<string, mixed>
     */
    public static function maskTenantArray(array $tenant): array
    {
        $out = $tenant;
        $out['contact_number'] = self::maskPhone($tenant['contact_number'] ?? null);
        $out['email'] = self::maskEmail($tenant['email'] ?? null);
        $out['emergency_contact_name'] = 'Access Restricted';
        $out['emergency_contact_number'] = '••••••••';
        $out['address'] = 'Access Restricted';

        return $out;
    }

    /**
     * @param  array<string, mixed>  $tenant
     * @return array<string, mixed>
     */
    public static function maybeMaskTenantArray(?User $user, array $tenant): array
    {
        if (! self::shouldMaskTenantPii($user)) {
            return $tenant;
        }

        return self::maskTenantArray($tenant);
    }

    /**
     * Directory-style label for reports when full name must not be shown.
     */
    public static function maskedTenantDirectoryLabel(int $tenantId): string
    {
        return 'Tenant #'.$tenantId;
    }

    public static function maskPhone(?string $value): string
    {
        if ($value === null || $value === '') {
            return '••••';
        }

        $digits = preg_replace('/\D+/', '', $value) ?? '';
        if (strlen($digits) >= 4) {
            return '••••-••••-'.substr($digits, -4);
        }

        return '••••••••';
    }

    public static function maskEmail(?string $value): string
    {
        if ($value === null || $value === '') {
            return '••••';
        }

        $parts = explode('@', $value, 2);
        if (count($parts) !== 2) {
            return '••••@restricted';
        }

        $local = $parts[0];
        $first = $local !== '' ? $local[0] : 'x';

        return $first.'••••@'.$parts[1];
    }

    /**
     * @param  array<string, mixed>  $report
     * @return array<string, mixed>
     */
    public static function maskReportForViewer(?User $user, string $reportKey, array $report): array
    {
        if (! self::shouldMaskTenantPii($user)) {
            return $report;
        }

        return match ($reportKey) {
            'billing_summary' => self::maskRowsWithTenantName($report),
            'outstanding_balances' => self::maskRowsWithTenantName($report),
            'active_contracts' => self::maskActiveContractsReport($report),
            'collections_performance' => self::maskCollectionsReport($report),
            'tenant_history' => self::maskTenantHistoryReport($report),
            'tenant_ledger' => self::maskTenantLedgerReport($report),
            'occupancy_status' => self::maskOccupancyStatusReport($report),
            default => $report,
        };
    }

    /**
     * @param  array<string, mixed>  $billing
     * @return array<string, mixed>
     */
    public static function maskBillingNestedTenant(?User $user, array $billing): array
    {
        if (! self::shouldMaskTenantPii($user)) {
            return $billing;
        }

        if (isset($billing['contract']['tenant']) && is_array($billing['contract']['tenant'])) {
            $billing['contract']['tenant'] = self::maskTenantArray($billing['contract']['tenant']);
        }

        return $billing;
    }

    /**
     * @param  array<string, mixed>  $payment
     * @return array<string, mixed>
     */
    public static function maskPaymentNestedTenant(?User $user, array $payment): array
    {
        if (! self::shouldMaskTenantPii($user)) {
            return $payment;
        }

        if (isset($payment['billing']['contract']['tenant']) && is_array($payment['billing']['contract']['tenant'])) {
            $payment['billing']['contract']['tenant'] = self::maskTenantArray($payment['billing']['contract']['tenant']);
        }

        return $payment;
    }

    /**
     * @param  array<string, mixed>  $contract
     * @return array<string, mixed>
     */
    public static function maskContractNestedTenant(?User $user, array $contract): array
    {
        if (! self::shouldMaskTenantPii($user)) {
            return $contract;
        }

        if (isset($contract['tenant']) && is_array($contract['tenant'])) {
            $contract['tenant'] = self::maskTenantArray($contract['tenant']);
        }

        return $contract;
    }

    /**
     * @param  array<string, mixed>  $report
     * @return array<string, mixed>
     */
    private static function maskRowsWithTenantName(array $report): array
    {
        if (! isset($report['rows']) || ! is_iterable($report['rows'])) {
            return $report;
        }

        $rows = [];
        foreach ($report['rows'] as $row) {
            if (! is_array($row)) {
                $rows[] = $row;

                continue;
            }
            $tid = isset($row['tenant_id']) ? (int) $row['tenant_id'] : null;
            if ($tid !== null) {
                $row['tenant_name'] = self::maskedTenantDirectoryLabel($tid);
            }
            $rows[] = $row;
        }
        $report['rows'] = $rows;

        return $report;
    }

    /**
     * @param  array<string, mixed>  $report
     * @return array<string, mixed>
     */
    private static function maskActiveContractsReport(array $report): array
    {
        if (! isset($report['rows']) || ! is_iterable($report['rows'])) {
            return $report;
        }

        $rows = [];
        foreach ($report['rows'] as $row) {
            if (! is_array($row)) {
                $rows[] = $row;

                continue;
            }
            $tid = isset($row['tenant_id']) ? (int) $row['tenant_id'] : null;
            if ($tid !== null) {
                $row['tenant_name'] = self::maskedTenantDirectoryLabel($tid);
            }
            $row['contact_number'] = self::maskPhone($row['contact_number'] ?? null);
            $row['email'] = self::maskEmail($row['email'] ?? null);
            $rows[] = $row;
        }
        $report['rows'] = $rows;

        return $report;
    }

    /**
     * @param  array<string, mixed>  $report
     * @return array<string, mixed>
     */
    private static function maskCollectionsReport(array $report): array
    {
        if (! isset($report['rows']) || ! is_iterable($report['rows'])) {
            return $report;
        }

        $rows = [];
        foreach ($report['rows'] as $row) {
            if (! is_array($row)) {
                $rows[] = $row;

                continue;
            }
            $tid = isset($row['tenant_id']) ? (int) $row['tenant_id'] : null;
            if ($tid !== null) {
                $row['tenant_name'] = self::maskedTenantDirectoryLabel($tid);
            }
            $rows[] = $row;
        }
        $report['rows'] = $rows;

        return $report;
    }

    /**
     * @param  array<string, mixed>  $report
     * @return array<string, mixed>
     */
    private static function maskTenantHistoryReport(array $report): array
    {
        if (! isset($report['rows']) || ! is_iterable($report['rows'])) {
            return $report;
        }

        $rows = [];
        foreach ($report['rows'] as $row) {
            if (! is_array($row)) {
                $rows[] = $row;

                continue;
            }
            $tid = isset($row['tenant_id']) ? (int) $row['tenant_id'] : null;
            if ($tid !== null) {
                $row['tenant_name'] = self::maskedTenantDirectoryLabel($tid);
            }
            $row['email'] = self::maskEmail($row['email'] ?? null);
            $rows[] = $row;
        }
        $report['rows'] = $rows;

        return $report;
    }

    /**
     * @param  array<string, mixed>  $report
     * @return array<string, mixed>
     */
    private static function maskTenantLedgerReport(array $report): array
    {
        if (isset($report['tenant']) && is_array($report['tenant']) && isset($report['tenant']['id'])) {
            $id = (int) $report['tenant']['id'];
            $report['tenant']['name'] = self::maskedTenantDirectoryLabel($id);
        }

        return $report;
    }

    /**
     * @param  array<string, mixed>  $report
     * @return array<string, mixed>
     */
    private static function maskOccupancyStatusReport(array $report): array
    {
        if (! isset($report['rows']) || ! is_iterable($report['rows'])) {
            return $report;
        }

        $rows = [];
        foreach ($report['rows'] as $row) {
            if (! is_array($row)) {
                $rows[] = $row;

                continue;
            }
            $tid = isset($row['tenant_id']) && $row['tenant_id'] !== null ? (int) $row['tenant_id'] : null;
            if ($tid !== null) {
                $row['tenant_name'] = self::maskedTenantDirectoryLabel($tid);
            }
            $rows[] = $row;
        }
        $report['rows'] = $rows;

        return $report;
    }
}
