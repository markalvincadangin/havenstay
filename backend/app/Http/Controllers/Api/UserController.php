<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\User\StoreUserRequest;
use App\Http\Requests\User\UpdateUserRequest;
use App\Models\Role;
use App\Models\User;
use App\Services\Identity\AuthorizationService;
use App\Services\Identity\UserService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{

    /**
     * Create a new user.
     *
     * @param StoreUserRequest $request
     * @return JsonResponse
     */
    public function store(StoreUserRequest $request): JsonResponse
    {
        AuthorizationService::ensureCanManageUsers($request->user());

        $validated = $request->validated();

        $user = UserService::create($request->user(), $validated);

        return response()->json([
            'message' => 'User created successfully.',
            'data' => $user->load('role'),
        ], 201);
    }

    /**
     * Retrieve a specific user.
     *
     * @param Request $request
     * @param User $user
     * @return JsonResponse
     */
    public function show(Request $request, User $user): JsonResponse
    {
        AuthorizationService::ensureCanManageUsers($request->user());

        return response()->json([
            'message' => 'User retrieved successfully.',
            'data' => $user->load('role'),
        ]);
    }

    /**
     * Update an existing user.
     *
     * @param UpdateUserRequest $request
     * @param User $user
     * @return JsonResponse
     */
    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        AuthorizationService::ensureCanManageUsers($request->user());

        $validated = $request->validated();

        $user = UserService::update($request->user(), $user, $validated);

        return response()->json([
            'message' => 'User updated successfully.',
            'data' => $user->load('role'),
        ]);
    }

    /**
     * Deactivate a user account.
     *
     * @param Request $request
     * @param User $user
     * @return JsonResponse
     */
    public function deactivate(Request $request, User $user): JsonResponse
    {
        AuthorizationService::ensureCanManageUsers($request->user());

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
     * Reactivate a user account.
     *
     * @param Request $request
     * @param User $user
     * @return JsonResponse
     */
    public function reactivate(Request $request, User $user): JsonResponse
    {
        AuthorizationService::ensureCanManageUsers($request->user());

        $user = UserService::reactivate($request->user(), $user);

        return response()->json([
            'message' => 'User reactivated successfully.',
            'data' => $user->load('role'),
        ]);
    }

    /**
     * Assign a role to a user.
     *
     * @param Request $request
     * @param User $user
     * @return JsonResponse
     */
    public function assignRole(Request $request, User $user): JsonResponse
    {
        AuthorizationService::ensureCanManageUsers($request->user());

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
     * List users with pagination.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanManageUsers($request->user());

        $validated = $request->validate(array_merge([
            'q' => ['nullable', 'string', 'max:200'],
            'role' => ['nullable', 'string', 'max:32'],
            'account_status' => ['nullable', 'string', 'in:active,inactive'],
        ], Pagination::queryRules()));

        $pageParams = Pagination::normalizePageParams($validated);

        $paginator = UserService::listPaginated($validated, $pageParams['page'], $pageParams['per_page']);

        return Pagination::fromPaginator($paginator);
    }

    /**
     * List all available roles (Admin only).
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function roles(Request $request): JsonResponse
    {
        AuthorizationService::ensureCanManageUsers($request->user());

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
        AuthorizationService::ensureCanManageUsers($request->user());

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
        AuthorizationService::ensureCanManageUsers($request->user());

        $user = UserService::restore($request->user(), $id);

        return response()->json([
            'message' => 'User restored successfully.',
            'data' => $user,
        ]);
    }
}
