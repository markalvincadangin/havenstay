<?php

namespace App\Models;

use App\Enums\TenantStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Tenant Model
 *
 * Profile for a boarding house resident. Tracks personal information,
 * status, and rental history.
 *
 * @property int $tenant_id
 * @property string $first_name
 * @property string $last_name
 * @property string $contact_number
 * @property string $email
 * @property string $emergency_contact_name
 * @property string $emergency_contact_number
 * @property string $address
 * @property TenantStatus $status
 * @property string|null $active_email
 */
class Tenant extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'tenants';

    protected $primaryKey = 'tenant_id';

    protected $fillable = [
        'first_name',
        'last_name',
        'contact_number',
        'email',
        'emergency_contact_name',
        'emergency_contact_number',
        'address',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'status' => TenantStatus::class,
        ];
    }

    /**
     * Historical and active contracts associated with this tenant.
     */
    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class, 'tenant_id', 'tenant_id');
    }
}
