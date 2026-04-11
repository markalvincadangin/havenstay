<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class AuditService
{
    /**
     * Log user login event (App-level event)
     */
    public static function logLogin(User $user): void
    {
        // CCR-003: INSERT audit log entry
        DB::table('audit_logs')->insert([
            'user_id' => $user->user_id,
            'entity_name' => 'users',
            'entity_id' => (string) $user->user_id,
            'action' => 'login',
            'created_at' => now(),
        ]);
    }

    /**
     * Log user logout event (App-level event)
     */
    public static function logLogout(?User $user): void
    {
        if ($user) {
            DB::table('audit_logs')->insert([
                'user_id' => $user->user_id,
                'entity_name' => 'users',
                'entity_id' => (string) $user->user_id,
                'action' => 'logout',
                'created_at' => now(),
            ]);
        }
    }

    /**
     * Log access denied event (App-level event)
     */
    public static function logAccessDenied(?User $user, string $resource): void
    {
        DB::table('audit_logs')->insert([
            'user_id' => $user?->user_id,
            'entity_name' => $resource,
            'entity_id' => 'denied',
            'action' => 'access_denied',
            'created_at' => now(),
        ]);
    }

    /**
     * Set the database context for @app_user_id.
     * This is used by database triggers for row-level auditing.
     * CCR-008: Trigger context — enables triggers to capture acting user
     */
    public static function setAuditUserContext(int $userId): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('SET @app_user_id = ?', [$userId]);
        }
    }

    /**
     * List audit logs with filters.
     *
     * @param  array{entity_type?: string, action?: string, from?: string, to?: string, user?: string}  $filters
     */
    public static function listLogs(array $filters = []): Collection
    {
        // CCR-003, CCR-005: Use Eloquent with optimization
        $query = AuditLog::with(['user' => function ($q) {
            $q->select('user_id', 'username', 'first_name', 'last_name');
        }]);

        if (! empty($filters['entity_type'])) {
            $query->where('entity_name', $filters['entity_type']);
        }

        if (! empty($filters['action'])) {
            $query->where('action', $filters['action']);
        }

        if (! empty($filters['from'])) {
            $query->where('created_at', '>=', $filters['from'].' 00:00:00');
        }

        if (! empty($filters['to'])) {
            $query->where('created_at', '<=', $filters['to'].' 23:59:59');
        }

        if (! empty($filters['user'])) {
            $userQ = $filters['user'];
            $query->whereHas('user', function ($q) use ($userQ): void {
                $q->where('username', 'LIKE', "%{$userQ}%")
                    ->orWhere('first_name', 'LIKE', "%{$userQ}%")
                    ->orWhere('last_name', 'LIKE', "%{$userQ}%");
            });
        }

        return $query->orderByDesc('created_at')
            ->limit(500)
            ->get()
            ->map(function ($log) {
                // Formatting for frontend parity
                $log->user_username = $log->user?->username;
                $log->user_first_name = $log->user?->first_name;
                $log->user_last_name = $log->user?->last_name;

                return $log;
            });
    }
}
