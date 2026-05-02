<?php

namespace App\Services\Identity;

use App\Models\User;
use App\Services\Concerns\ManagesWorkflows;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * UserService
 *
 * Identity service for managing user accounts, role assignments,
 * and profile states.
 * Optimized for HavenStay Forensic v5.0.
 */
class UserService
{
    use ManagesWorkflows;

    /**
     * Create a new system user profile.
     *
     * @param  User  $actor  Performing staff member.
     * @param  array  $data  Input including password and role_id.
     */
    public static function create(User $actor, array $data): User
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'CREATE_USER',
            payload: [
                'username_fact' => $data['username'] ?? 'N/A',
                'email_fact' => $data['email'] ?? 'N/A',
                'role_id_fact' => $data['role_id'] ?? 0,
            ],
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
            resultDetails: fn(User $createdUser): array => ['user_id' => $createdUser->user_id]
        );
    }

    /**
     * Update an existing user profile.
     *
     * @param  User  $actor  Performing staff member.
     * @param  User  $user  Target user.
     * @param  array  $data  Updated fields.
     */
    public static function update(User $actor, User $user, array $data): User
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'UPDATE_USER',
            payload: ['user_id' => $user->user_id, 'old_username' => $user->username],
            operation: function () use ($user, $data): User {
                if (!empty($data['password'] ?? null)) {
                    $data['password_hash'] = Hash::make($data['password']);
                }
                unset($data['password']);

                $user->update($data);

                return $user;
            }
        );
    }

    /**
     * Deactivate a staff account (disables login).
     *
     * @param  User  $actor  Performing staff member.
     */
    public static function deactivate(User $actor, User $user): User
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'DEACTIVATE_USER',
            payload: ['user_id' => $user->user_id, 'username' => $user->username],
            operation: function () use ($user): User {
                $user->update(['is_active' => false]);

                return $user;
            }
        );
    }

    /**
     * Archive a user record via soft-delete.
     *
     * @param  User  $actor  Performing staff member.
     */
    public static function archive(User $actor, User $user): User
    {
        // Defense-in-depth: Service-level self-archival guard
        if ($actor->user_id === $user->user_id) {
            $validator = Validator::make([], []);
            $validator->errors()->add('user', 'You cannot archive your own account.');
            throw new ValidationException($validator);
        }

        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'ARCHIVE_USER',
            payload: ['user_id' => $user->user_id],
            operation: function () use ($user): User {
                $user->delete();

                return $user;
            }
        );
    }

    /**
     * Restore a soft-deleted staff account.
     */
    public static function restore(User $actor, int $id): User
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'RESTORE_USER',
            payload: ['user_id' => $id],
            operation: function () use ($id): User {
                $user = User::withTrashed()->findOrFail($id);
                $user->restore();

                return $user;
            }
        );
    }

    /**
     * Reactivate an inactive staff account.
     */
    public static function reactivate(User $actor, User $user): User
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'REACTIVATE_USER',
            payload: ['user_id' => $user->user_id],
            operation: function () use ($user): User {
                $user->update(['is_active' => true]);

                return $user;
            }
        );
    }

    /**
     * Assign a different role to a staff member.
     */
    public static function assignRole(User $actor, User $user, int $roleId): User
    {
        return self::runWriteWorkflow(
            actorId: $actor->user_id,
            action: 'ASSIGN_ROLE',
            payload: ['user_id' => $user->user_id, 'new_role_id' => $roleId],
            operation: function () use ($user, $roleId): User {
                $user->update(['role_id' => $roleId]);

                return $user;
            }
        );
    }

    /**
     * System-wide user statistics for administrative KPIs.
     */
    public static function summary(): array
    {
        return [
            'total_users' => User::count(),
            'active_users' => User::where('is_active', true)->count(),
            'inactive_users' => User::where('is_active', false)->count(),
            'archived_users' => User::onlyTrashed()->count(),
            'admin_count' => User::whereHas('role', fn($q) => $q->where('role_name', 'admin'))->count(),
        ];
    }

    /**
     * Paginated user list with role context and filtering.
     *
     * @param  array  $filters  (q, role, account_status).
     */
    public static function listPaginated(array $filters, int $page, int $perPage): LengthAwarePaginator
    {
        $query = User::with('role')->orderByDesc('user_id');

        if (($filters['account_status'] ?? '') === 'archived') {
            $query->onlyTrashed();
        } else {
            if (!empty($filters['account_status'])) {
                $isActive = $filters['account_status'] === 'active';
                $query->where('is_active', $isActive);
            }
        }

        if (!empty($filters['q'])) {
            $needle = $filters['q'];
            $query->where(function ($w) use ($needle): void {
                $w->where('username', 'LIKE', "%{$needle}%")
                    ->orWhere('first_name', 'LIKE', "%{$needle}%")
                    ->orWhere('last_name', 'LIKE', "%{$needle}%")
                    ->orWhere('email', 'LIKE', "%{$needle}%");
            });
        }

        if (!empty($filters['role'])) {
            $query->whereHas('role', fn($r) => $r->where('role_name', $filters['role']));
        }

        return $query->paginate($perPage, ['*'], 'page', $page);
    }
}
