<?php

namespace App\Services;

use App\Services\Concerns\ManagesWorkflows;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Hash;

class UserService
{
    use ManagesWorkflows;

    public static function create(User $actor, array $data): User
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'CREATE_USER',
            txnReference: self::buildTxnReference('USER-CRT'),
            payload: ['username' => $data['username'] ?? null, 'email' => $data['email'] ?? null],
            operation: function () use ($data): User {
                return User::create([
                    'first_name' => $data['first_name'],
                    'last_name' => $data['last_name'],
                    'username' => $data['username'],
                    'email' => $data['email'],
                    'password_hash' => Hash::make($data['password']),
                    'role_id' => $data['role_id'],
                    'is_active' => true,
                ]);
            },
            resultDetails: fn (User $createdUser): array => ['user_id' => $createdUser->user_id]
        );
    }

    public static function update(User $actor, User $user, array $data): User
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'UPDATE_USER',
            txnReference: self::buildTxnReference('USER-UPD'),
            payload: ['user_id' => $user->user_id],
            operation: function () use ($user, $data): User {
                if (! empty($data['password'] ?? null)) {
                    $data['password_hash'] = Hash::make($data['password']);
                }
                unset($data['password']);

                $user->update($data);

                return $user;
            },
            resultDetails: fn (User $updatedUser): array => ['user_id' => $updatedUser->user_id]
        );
    }

    public static function deactivate(User $actor, User $user): User
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'DEACTIVATE_USER',
            txnReference: self::buildTxnReference('USER-DEACT'),
            payload: ['user_id' => $user->user_id],
            operation: function () use ($user): User {
                $user->update(['is_active' => false]);
                return $user;
            },
            resultDetails: fn (User $deactivatedUser): array => ['user_id' => $deactivatedUser->user_id]
        );
    }

    public static function reactivate(User $actor, User $user): User
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'REACTIVATE_USER',
            txnReference: self::buildTxnReference('USER-REACT'),
            payload: ['user_id' => $user->user_id],
            operation: function () use ($user): User {
                $user->update(['is_active' => true]);
                return $user;
            },
            resultDetails: fn (User $reactivatedUser): array => ['user_id' => $reactivatedUser->user_id]
        );
    }

    public static function assignRole(User $actor, User $user, int $roleId): User
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'ASSIGN_USER_ROLE',
            txnReference: self::buildTxnReference('USER-ROLE'),
            payload: ['user_id' => $user->user_id, 'role_id' => $roleId],
            operation: function () use ($user, $roleId): User {
                $user->update(['role_id' => $roleId]);
                return $user;
            },
            resultDetails: fn (User $updatedUser): array => ['user_id' => $updatedUser->user_id, 'role_id' => $updatedUser->role_id]
        );
    }

    public static function archive(User $actor, User $user): User
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'ARCHIVE_USER',
            txnReference: self::buildTxnReference('USER-ARC'),
            payload: ['user_id' => $user->user_id],
            operation: function () use ($user): User {
                $user->delete();

                return $user;
            },
            resultDetails: fn (User $archivedUser): array => ['user_id' => $archivedUser->user_id]
        );
    }

    public static function restore(User $actor, int $id): User
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'RESTORE_USER',
            txnReference: self::buildTxnReference('USER-RES'),
            payload: ['user_id' => $id],
            operation: function () use ($id): User {
                $user = User::withTrashed()->findOrFail($id);
                $user->restore();

                return $user;
            },
            resultDetails: fn (User $restoredUser): array => ['user_id' => $restoredUser->user_id]
        );
    }

    /**
     * @param  array{q?:string,role?:string,account_status?:string}  $filters
     */
    public static function listPaginated(array $filters, int $page, int $perPage): LengthAwarePaginator
    {
        $query = User::with('role')->orderByDesc('user_id');

        if (! empty($filters['q'])) {
            $needle = $filters['q'];
            $query->where(function ($w) use ($needle): void {
                $w->where('username', 'LIKE', "%{$needle}%")
                    ->orWhere('first_name', 'LIKE', "%{$needle}%")
                    ->orWhere('last_name', 'LIKE', "%{$needle}%")
                    ->orWhere('email', 'LIKE', "%{$needle}%");

                if (ctype_digit($needle)) {
                    $w->orWhere('user_id', (int) $needle);
                }
            });
        }

        if (! empty($filters['role'])) {
            $query->whereHas('role', function ($r) use ($filters): void {
                $r->where('role_name', $filters['role']);
            });
        }

        if (($filters['account_status'] ?? null) === 'active') {
            $query->where('is_active', true);
        } elseif (($filters['account_status'] ?? null) === 'inactive') {
            $query->where('is_active', false);
        }

        return $query->paginate($perPage, ['*'], 'page', $page);
    }
}

