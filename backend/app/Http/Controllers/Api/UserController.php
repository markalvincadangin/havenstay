<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Services\AuditService;
use App\Services\AuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * FR-005: Admin creates a new user
     */
    public function store(Request $request): JsonResponse
    {
        // FR-004: Check authorization
        if (! AuthorizationService::canManageUsers($request->user())) {
            AuditService::logAccessDenied($request->user(), 'users.create');

            return response()->json([
                'message' => 'Unauthorized: only Admin can create users.',
            ], 403);
        }

        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'username' => ['required', 'string', 'max:50', Rule::unique('users')],
            'email' => ['required', 'email', Rule::unique('users')],
            'password' => ['required', 'string', 'min:8'],
            'role_id' => ['required', 'exists:roles,role_id'],
        ]);

        $user = User::create([
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'],
            'username' => $validated['username'],
            'email' => $validated['email'],
            'password_hash' => bcrypt($validated['password']),
            'role_id' => $validated['role_id'],
            'is_active' => true,
        ]);

        return response()->json([
            'message' => 'User created successfully.',
            'user' => $user->load('role'),
        ], 201);
    }

    /**
     * FR-005: Show user details (Admin only — same scope as list/create).
     */
    public function show(Request $request, User $user): JsonResponse
    {
        if (! AuthorizationService::canManageUsers($request->user())) {
            AuditService::logAccessDenied($request->user(), 'users.show');

            return response()->json([
                'message' => 'Unauthorized: only Admin can view user details.',
            ], 403);
        }

        return response()->json($user->load('role'));
    }

    /**
     * FR-005: Admin updates an existing user
     */
    public function update(Request $request, User $user): JsonResponse
    {
        // FR-004: Check authorization
        if (! AuthorizationService::canManageUsers($request->user())) {
            AuditService::logAccessDenied($request->user(), 'users.update');

            return response()->json([
                'message' => 'Unauthorized: only Admin can update users.',
            ], 403);
        }

        $validated = $request->validate([
            'first_name' => ['sometimes', 'string', 'max:100'],
            'last_name' => ['sometimes', 'string', 'max:100'],
            'username' => ['sometimes', 'string', 'max:50', Rule::unique('users')->ignore($user->user_id, 'user_id')],
            'email' => ['sometimes', 'email', Rule::unique('users')->ignore($user->user_id, 'user_id')],
            'role_id' => ['sometimes', 'exists:roles,role_id'],
            'is_active' => ['sometimes', 'boolean'],
            'password' => ['nullable', 'string', 'min:8'],
        ]);

        if (! empty($validated['password'] ?? null)) {
            $validated['password_hash'] = bcrypt($validated['password']);
        }
        unset($validated['password']);

        $user->update($validated);

        return response()->json([
            'message' => 'User updated successfully.',
            'user' => $user->load('role'),
        ]);
    }

    /**
     * FR-005: Admin deactivates a user
     */
    public function deactivate(Request $request, User $user): JsonResponse
    {
        // FR-004: Check authorization
        if (! AuthorizationService::canManageUsers($request->user())) {
            AuditService::logAccessDenied($request->user(), 'users.deactivate');

            return response()->json([
                'message' => 'Unauthorized: only Admin can deactivate users.',
            ], 403);
        }

        // Safety: Prevent self-deactivation (Admin cannot lock themselves out)
        if ($user->user_id === $request->user()->user_id) {
            return response()->json([
                'message' => 'Conflict: You cannot deactivate your own account.',
            ], 400);
        }

        $user->update([
            'is_active' => false,
        ]);

        return response()->json([
            'message' => 'User deactivated successfully.',
            'user' => $user->load('role'),
        ]);
    }

    /**
     * FR-005: Admin reactivates a user
     */
    public function reactivate(Request $request, User $user): JsonResponse
    {
        // FR-004: Check authorization
        if (! AuthorizationService::canManageUsers($request->user())) {
            AuditService::logAccessDenied($request->user(), 'users.reactivate');

            return response()->json([
                'message' => 'Unauthorized: only Admin can reactivate users.',
            ], 403);
        }

        $user->update([
            'is_active' => true,
        ]);

        return response()->json([
            'message' => 'User reactivated successfully.',
            'user' => $user->load('role'),
        ]);
    }

    /**
     * FR-006: Admin updates user role
     */
    public function assignRole(Request $request, User $user): JsonResponse
    {
        // FR-004: Check authorization
        if (! AuthorizationService::canManageUsers($request->user())) {
            AuditService::logAccessDenied($request->user(), 'users.assignRole');

            return response()->json([
                'message' => 'Unauthorized: only Admin can assign roles.',
            ], 403);
        }

        $validated = $request->validate([
            'role_id' => ['required', 'exists:roles,role_id'],
        ]);

        $user->update(['role_id' => $validated['role_id']]);

        return response()->json([
            'message' => 'User role updated successfully.',
            'user' => $user->load('role'),
        ]);
    }

    /**
     * FR-005: List users (Admin only — docs/API_REFERENCE.md, CLAUDE.md §6.4 routes).
     */
    public function index(Request $request): JsonResponse
    {
        if (! AuthorizationService::canManageUsers($request->user())) {
            AuditService::logAccessDenied($request->user(), 'users.list');

            return response()->json([
                'message' => 'Unauthorized: only Admin can list users.',
            ], 403);
        }

        $users = User::with('role')->get();

        return response()->json([
            'users' => $users,
        ]);
    }

    /**
     * List all available roles (Admin only)
     */
    public function roles(Request $request): JsonResponse
    {
        if (! AuthorizationService::canManageUsers($request->user())) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json(Role::all());
    }
}
