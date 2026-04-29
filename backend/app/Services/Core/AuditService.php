<?php
 
 namespace App\Services\Core;
 
 use App\Models\AuditLog;
 use App\Models\User;
 use App\Enums\AuditAction;
 use Illuminate\Support\Facades\DB;
 
 /**
  * Audit Service
  * 
  * Handles database session context injection and manual application-level
  * audit events. This is the foundation of the HavenStay auditing system.
  */
 class AuditService
 {
     /**
      * Set the current operator ID in the database session.
      * Required for MySQL triggers to capture the 'changed_by' attribute.
      */
     public static function setAuditUserContext(int $userId): void
     {
         if (DB::getDriverName() === 'mysql') {
             DB::statement('SET @current_user_id = ?', [$userId]);
         }
     }
 
     /**
      * Set the correlation ID for the current thread of execution.
      * Links high-level business workflows to low-level audit log mutations.
      */
     public static function setCorrelationContext(?string $correlationId): void
     {
         if (DB::getDriverName() === 'mysql') {
             DB::statement('SET @current_correlation_id = ?', [$correlationId]);
         }
     }
 
     /**
      * Set a system-level context for Artisan commands, seeders, or background jobs.
      * Defaults to the Admin user (ID: 1) and generates a system-prefixed correlation ID.
      */
     public static function setSystemContext(string $origin = 'system'): void
     {
         $correlationId = sprintf('sys_%s_%s', $origin, bin2hex(random_bytes(4)));
         self::setAuditUserContext(1); // Default to System Administrator
         self::setCorrelationContext($correlationId);
     }
 
     /**
      * Clean up the correlation context after a workflow completes.
      */
     public static function clearCorrelationContext(): void
     {
         if (DB::getDriverName() === 'mysql') {
             DB::statement('SET @current_correlation_id = NULL');
         }
     }
 
     /**
      * Log a manual application-layer event that isn't captured by DB triggers.
      * Used for security events (login, logout, access denied).
      */
     public static function logManualAction(int $userId, AuditAction $action, string $targetTable, ?string $recordId = null): void
     {
         AuditLog::create([
             'action'       => $action,
             'target_table' => $targetTable,
             'record_id'    => $recordId ?? 0,
             'changed_by'   => $userId,
             'changed_at'   => now(),
         ]);
     }
 
     /**
      * Specialized: Log a user login event.
      */
     public static function logLogin(User $user): void
     {
         self::logManualAction((int) $user->user_id, AuditAction::LOGIN, 'users', (string) $user->user_id);
     }
 
     /**
      * Specialized: Log a user logout event.
      */
     public static function logLogout(?User $user): void
     {
         if ($user) {
             self::logManualAction((int) $user->user_id, AuditAction::LOGOUT, 'users', (string) $user->user_id);
         }
     }
 
     /**
      * Specialized: Access Denied entry for unauthorized RBAC attempts.
      */
     public static function logAccessDenied(?User $user, string $targetTable): void
     {
         $userId = $user?->user_id;
 
         AuditLog::create([
             'action'       => AuditAction::ACCESS_DENIED,
             'target_table' => $targetTable,
             'record_id'    => 0,
             'changed_by'   => $userId,
             'changed_at'   => now(),
         ]);
     }
 }
