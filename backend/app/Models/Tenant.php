<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'first_name',
    'last_name',
    'contact_number',
    'email',
    'emergency_contact_name',
    'emergency_contact_number', 'address', 'status',
])]
class Tenant extends Model
{
    use HasFactory;

    protected $table = 'tenants';

    protected $primaryKey = 'tenant_id';

    const STATUS_ACTIVE = 'active';

    const STATUS_MOVED_OUT = 'moved_out';

    const STATUS_ARCHIVED = 'archived';

    protected function casts(): array
    {
        return [
            'status' => 'string',
        ];
    }
}
