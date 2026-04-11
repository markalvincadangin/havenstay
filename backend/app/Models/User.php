<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'first_name',
        'last_name',
        'username',
        'email',
        'password_hash',
        'role_id',
        'is_active',
        'last_login_at',
    ];

    protected $hidden = [
        'password_hash',
        'remember_token',
    ];

    protected $table = 'users';

    protected $primaryKey = 'user_id';

    /**
     * Map 'password' attribute to 'password_hash' column for Authentication compatibility.
     */
    public function getAuthPassword()
    {
        return $this->password_hash;
    }

    protected function casts(): array
    {
        return [
            'password_hash' => 'hashed',
            'last_login_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id', 'role_id');
    }

    public function isActive(): bool
    {
        return (bool) $this->is_active;
    }

    public function hasRole(string $roleName): bool
    {
        return strtolower($this->role?->role_name) === strtolower($roleName);
    }

    public function canAdmin(): bool
    {
        return $this->hasRole('admin');
    }

    public function canStaff(): bool
    {
        return $this->hasRole('staff') || $this->canAdmin();
    }

    public function canView(): bool
    {
        return $this->hasRole('viewer') || $this->canStaff();
    }

    public function canManageBilling(): bool
    {
        return $this->canStaff();
    }

    public function canManageContracts(): bool
    {
        return $this->canStaff();
    }

    public function canViewReports(): bool
    {
        return $this->canView();
    }
}
