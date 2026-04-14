<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'username' => ['nullable', 'string'],
            'email' => ['nullable', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $identifier = trim((string) ($credentials['username'] ?? $credentials['email'] ?? ''));
        if ($identifier === '') {
            throw ValidationException::withMessages([
                'username' => ['The username or email field is required.'],
            ]);
        }

        $loginField = filter_var($identifier, FILTER_VALIDATE_EMAIL) ? 'email' : 'username';

        $user = User::where($loginField, $identifier)->first();
        if ($user && ! $user->isActive()) {
            throw ValidationException::withMessages([
                'username' => ['This account has been deactivated.'],
            ]);
        }

        if (! Auth::attempt([
            $loginField => $identifier,
            'password' => $credentials['password'],
        ])) {
            throw ValidationException::withMessages([
                'username' => ['The provided credentials are incorrect.'],
            ]);
        }

        $authenticatedUser = Auth::user();
        $authenticatedUser->update(['last_login_at' => now()]);
        AuditService::logLogin($authenticatedUser);

        // Create API token for stateless auth
        $token = $authenticatedUser->createToken('api-token')->plainTextToken;

        return response()->json([
            'message' => 'Authenticated.',
            'user' => $authenticatedUser->load('role'),
            'token' => $token,
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $request->user()?->load('role'),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        // Delete token if it exists and is deletable
        if ($user?->currentAccessToken()) {
            try {
                if (method_exists($user->currentAccessToken(), 'delete')) {
                    $user->currentAccessToken()->delete();
                }
            } catch (\Exception $e) {
                // Token may not be deletable (e.g., TransientToken in tests)
            }
        }
        AuditService::logLogout($user);

        return response()->json([
            'message' => 'Logged out.',
        ]);
    }
}
