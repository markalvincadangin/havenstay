<?php

namespace App\Http\Controllers\Api;

use App\Http\Concerns\HandlesAuthorization;
use App\Http\Controllers\Controller;
use App\Http\Requests\User\StoreUserRequest;
use App\Http\Requests\User\UpdateUserRequest;
use App\Models\Role;
use App\Models\User;
use App\Services\AuthorizationService;
use App\Services\UserService;
use App\Support\PaginationResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    use HandlesAuthorization;

    /**
     */
    public function store(StoreUserRequest $request): JsonResponse
    {
        if (! AuthorizationService::canManageUsers($request->user())) {
            return $this->forbidden($request, 'users.create', 'Unauthorized: only Admin can create users.');
        }

        $validated = $request->validated();

        $user = UserService::create($request->user(), $validated);

        return response()->json([
            'message' => 'User created successfully.',
            'data' => $user->load('role'),
        ], 201);
    }

    /**
     */
    public function show(Request $request, User $user): JsonResponse
    {
        if (! AuthorizationService::canManageUsers($request->user())) {
            return $this->forbidden($request, 'users.show', 'Unauthorized: only Admin can view user details.');
        }

        return response()->json([
            'message' => 'User retrieved successfully.',
            'data' => $user->load('role'),
        ]);
    }

    /**
     */
    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        if (! AuthorizationService::canManageUsers($request->user())) {
            return $this->forbidden($request, 'users.update', 'Unauthorized: only Admin can update users.');
        }

        $validated = $request->validated();

        $user = UserService::update($request->user(), $user, $validated);

        return response()->json([
            'message' => 'User updated successfully.',
            'data' => $user->load('role'),
        ]);
    }

    /**
     */
    public function deactivate(Request $request, User $user): JsonResponse
    {
        if (! AuthorizationService::canManageUsers($request->user())) {
            return $this->forbidden($request, 'users.deactivate', 'Unauthorized: only Admin can deactivate users.');
        }

        // Safety: Prevent self-deactivation (Admin cannot lock themselves out)
        if ($user->user_id === $request->user()->user_id) {
            return response()->json([
                'message' => 'Conflict: You cannot deactivate your own account.',
            ], 400);
        }

        $user = UserService::deactivate($request->user(), $user);

        return response()->json([
            'message' => 'User deactivated successfully.',
            'data' => $user->load('role'),
        ]);
    }

    /**
     */
    public function reactivate(Request $request, User $user): JsonResponse
    {
        if (! AuthorizationService::canManageUsers($request->user())) {
            return $this->forbidden($request, 'users.reactivate', 'Unauthorized: only Admin can reactivate users.');
        }

        $user = UserService::reactivate($request->user(), $user);

        return response()->json([
            'message' => 'User reactivated successfully.',
            'data' => $user->load('role'),
        ]);
    }

    /**
     */
    public function assignRole(Request $request, User $user): JsonResponse
    {
        if (! AuthorizationService::canManageUsers($request->user())) {
            return $this->forbidden($request, 'users.assignRole', 'Unauthorized: only Admin can assign roles.');
        }

        $validated = $request->validate([
            'role_id' => ['required', 'exists:roles,role_id'],
        ]);

        $user = UserService::assignRole($request->user(), $user, (int) $validated['role_id']);

        return response()->json([
            'message' => 'User role updated successfully.',
            'data' => $user->load('role'),
        ]);
    }

    /**
     */
    public function index(Request $request): JsonResponse
    {
        if (! AuthorizationService::canManageUsers($request->user())) {
            return $this->forbidden($request, 'users.list', 'Unauthorized: only Admin can list users.');
        }

        $validated = $request->validate(array_merge([
            'q' => ['nullable', 'string', 'max:200'],
            'role' => ['nullable', 'string', 'max:32'],
            'account_status' => ['nullable', 'string', 'in:active,inactive'],
        ], PaginationResponse::queryRules()));

        $pageParams = PaginationResponse::normalizePageParams($validated);

        $paginator = UserService::listPaginated($validated, $pageParams['page'], $pageParams['per_page']);

        return PaginationResponse::fromPaginator($paginator);
    }

    /**
     * List all available roles (Admin only)
     */
    public function roles(Request $request): JsonResponse
    {
        if (! AuthorizationService::canManageUsers($request->user())) {
            return $this->forbidden($request, 'users.roles', 'Unauthorized: only Admin can view roles.');
        }

        return response()->json([
            'message' => 'Roles retrieved successfully.',
            'data' => Role::all(),
        ]);
    }

    /**
     * Archive a user (Soft Delete)
     */
    public function archive(Request $request, User $user): JsonResponse
    {
        if (! AuthorizationService::canManageUsers($request->user())) {
            return $this->forbidden($request, 'users.archive', 'Unauthorized: only Admin can archive users.');
        }

        // Safety: Prevent self-archival
        if ($user->user_id === $request->user()->user_id) {
            return response()->json(['message' => 'You cannot archive your own account.'], 400);
        }

        $user = UserService::archive($request->user(), $user);

        return response()->json([
            'message' => 'User archived successfully.',
            'data' => $user,
        ]);
    }

    /**
     * Restore an archived user
     */
    public function restore(Request $request, int $id): JsonResponse
    {
        if (! AuthorizationService::canManageUsers($request->user())) {
            return $this->forbidden($request, 'users.restore', 'Unauthorized: only Admin can restore users.');
        }

        $user = UserService::restore($request->user(), $id);

        return response()->json([
            'message' => 'User restored successfully.',
            'data' => $user,
        ]);
    }
}
