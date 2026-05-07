<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\HasApiTokens;

/**
 * User Model
 *
 * Represents a system operator in the HavenStay BHMS. Handles authentication
 * and role-based access control.
 *
 * @property int $user_id
 * @property int $role_id
 * @property string $first_name
 * @property string $last_name
 * @property string $username
 * @property string $email
 * @property string $password_hash
 * @property bool $is_active
 * @property Carbon|null $last_login_at
 * @property-read string $full_name
 * @property-read Role $role
 */
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $table = 'users';

    protected $primaryKey = 'user_id';

    protected $fillable = [
        'first_name',
        'last_name',
        'username',
        'email',
        'password_hash',
        'role_id',
        'is_active',
        'last_login_at',
        'google_id',
        'avatar_url',
        'oauth_provider',
    ];

    protected $hidden = [
        'password_hash',
        'remember_token',
    ];

    /**
     * Map default Laravel password field to schema-compliant password_hash.
     */
    public function getAuthPassword()
    {
        return $this->password_hash;
    }

    protected function casts(): array
    {
        return [
            'last_login_at' => 'datetime',
            'is_active' => 'boolean',
            'role_id' => 'integer',
        ];
    }

    /**
     * Virtual attribute for the user's full name.
     */
    protected function fullName(): Attribute
    {
        return Attribute::get(fn () => "{$this->first_name} {$this->last_name}");
    }

    /**
     * Role association defining system permission levels.
     */
    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id', 'role_id');
    }

    /**
     * Contracts created by this user.
     */
    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class, 'created_by', 'user_id');
    }

    /**
     * Payments processed by this user.
     */
    public function processedPayments(): HasMany
    {
        return $this->hasMany(Payment::class, 'processed_by', 'user_id');
    }

    /**
     * Payments voided by this user.
     */
    public function voidedPayments(): HasMany
    {
        return $this->hasMany(Payment::class, 'voided_by', 'user_id');
    }

    /**
     * Utility meter readings recorded by this user.
     */
    public function meterReadings(): HasMany
    {
        return $this->hasMany(MeterReading::class, 'recorded_by', 'user_id');
    }

    /**
     * Audit logs generated for actions performed by this user.
     */
    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class, 'changed_by', 'user_id');
    }

    /**
     * Check if user account is currently active.
     */
    public function isActive(): bool
    {
        return (bool) $this->is_active;
    }
}
