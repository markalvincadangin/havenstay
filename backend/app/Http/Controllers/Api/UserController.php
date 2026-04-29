<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\User\AssignUserRoleRequest;
use App\Http\Requests\User\IndexUserRequest;
use App\Http\Requests\User\ManageUserRequest;
use App\Http\Requests\User\StoreUserRequest;
use App\Http\Requests\User\UpdateUserRequest;
use App\Http\Resources\RoleResource;
use App\Http\Resources\UserResource;
use App\Models\Role;
use App\Models\User;
use App\Services\Identity\UserService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;

/**
 * UserController
 *
 * Administrative controller for system identity management.
 * Optimized for HavenStay Forensic v5.0.
 */
class UserController extends Controller
{
    /**
     * Create a new user.
     */
    public function store(StoreUserRequest $request): JsonResponse
    {
        $user = UserService::create($request->user(), $request->validated());

        return $this->created('User created successfully.', new UserResource($user->load('role')));
    }

    /**
     * Retrieve a specific user.
     */
    public function show(ManageUserRequest $request, User $user): JsonResponse
    {
        return $this->success('User retrieved successfully.', new UserResource($user->load('role')));
    }

    /**
     * Update an existing user.
     */
    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        $user = UserService::update($request->user(), $user, $request->validated());

        return $this->success('User updated successfully.', new UserResource($user->load('role')));
    }

    /**
     * Deactivate a user account.
     */
    public function deactivate(ManageUserRequest $request, User $user): JsonResponse
    {
        // Safety: Prevent self-deactivation
        if ($user->user_id === $request->user()->user_id) {
            return $this->error('Conflict: You cannot deactivate your own account.', 400);
        }

        $user = UserService::deactivate($request->user(), $user);

        return $this->success('User deactivated successfully.', new UserResource($user->load('role')));
    }

    /**
     * Reactivate a user account.
     */
    public function reactivate(ManageUserRequest $request, User $user): JsonResponse
    {
        $user = UserService::reactivate($request->user(), $user);

        return $this->success('User reactivated successfully.', new UserResource($user->load('role')));
    }

    /**
     * Assign a role to a user.
     */
    public function assignRole(AssignUserRoleRequest $request, User $user): JsonResponse
    {
        $validated = $request->validated();

        $user = UserService::assignRole($request->user(), $user, (int) $validated['role_id']);

        return $this->success('User role updated successfully.', new UserResource($user->load('role')));
    }

    /**
     * List users with pagination.
     */
    public function index(IndexUserRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $pageParams = Pagination::normalizePageParams($validated);

        $paginator = UserService::listPaginated($validated, $pageParams['page'], $pageParams['per_page']);

        return $this->paginated($paginator, [], 'Users retrieved successfully.');
    }

    /**
     * List all available roles (Admin only).
     */
    public function roles(ManageUserRequest $request): JsonResponse
    {
        return $this->success('Roles retrieved successfully.', RoleResource::collection(Role::all()));
    }

    /**
     * Archive a user (Soft Delete)
     */
    public function archive(ManageUserRequest $request, User $user): JsonResponse
    {
        // Safety: Prevent self-archival
        if ($user->user_id === $request->user()->user_id) {
            return $this->error('You cannot archive your own account.', 400);
        }

        $user = UserService::archive($request->user(), $user);

        return $this->success('User archived successfully.', new UserResource($user));
    }

    /**
     * Restore an archived user
     */
    public function restore(ManageUserRequest $request, int $id): JsonResponse
    {
        $user = UserService::restore($request->user(), $id);

        return $this->success('User restored successfully.', new UserResource($user));
    }
}
