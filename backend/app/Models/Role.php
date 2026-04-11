<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'role_name',
    'description',
])]

class Role extends Model
{
    protected $table = 'roles';

    protected $primaryKey = 'role_id';

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

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'role_id', 'role_id');
    }
}
