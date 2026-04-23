<?php
 
 namespace App\Models;
 
 use Illuminate\Database\Eloquent\Model;
 use Illuminate\Database\Eloquent\Casts\Attribute;
 use Illuminate\Database\Eloquent\Relations\BelongsTo;
 use Illuminate\Support\Carbon;
 use App\Enums\AuditAction;
 
 /**
  * AuditLog Model
  * 
  * Forensic ledger entry for row-level database mutations and application-layer
  * security events. Entries are predominantly written by DB triggers.
  * 
  * @property int $id
  * @property \App\Enums\AuditAction $action
  * @property string $target_table
  * @property int $record_id
  * @property array|null $old_value
  * @property array|null $new_value
  * @property int|null $changed_by
  * @property string|null $correlation_id
  * @property \Illuminate\Support\Carbon $changed_at
  */
 class AuditLog extends Model
 {
     protected $table = 'audit_logs';
 
     protected $primaryKey = 'id';
 
     /**
      * Audit logs are append-only. changed_at is managed by DB defaults.
      */
     public $timestamps = false;
 
     protected $fillable = [
         'action',
         'target_table',
         'record_id',
         'old_value',
         'new_value',
         'changed_by',
         'correlation_id',
         'changed_at',
     ];
 
     protected function casts(): array
     {
         return [
             'action'     => AuditAction::class,
             'old_value'  => 'array',
             'new_value'  => 'array',
             'changed_at' => 'datetime',
         ];
     }
 
     /**
      * Actor profile responsible for the event.
      */
     public function user(): BelongsTo
     {
         return $this->belongsTo(User::class, 'changed_by', 'user_id');
     }
 
     /**
      * Forensic Timestamp Normalization:
      * DB triggers operate in UTC (system time), but the administrative UI requires
      * localization to Asia/Manila for operational clarity.
      */
     protected function changedAt(): Attribute
     {
         return Attribute::make(
             get: fn ($value) => $value ? Carbon::parse($value, 'UTC')->tz(config('app.timezone')) : null,
         );
     }
 }
