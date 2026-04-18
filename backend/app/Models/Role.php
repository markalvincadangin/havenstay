<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Role Model
 * 
 * Defines access levels for system operators (admin, staff, viewer).
 * 
 * @property int $role_id
 * @property string $role_name
 * @property string|null $description
 */
class Role extends Model
{
    protected $table = 'roles';

    protected $primaryKey = 'role_id';

    protected $fillable = [
        'role_name',
        'description',
    ];

    const ADMIN = 'admin';

    const STAFF = 'staff';

    const VIEWER = 'viewer';

    protected function casts(): array
    {
        return [
            'role_name' => 'string',
            'description' => 'string',
        ];
    }

    /**
     * Users assigned to this role.
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'role_id', 'role_id');
    }
}
