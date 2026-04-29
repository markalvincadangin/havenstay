<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Services\Identity\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * AuthController
 *
 * Entry point for system authentication and session management.
 * Optimized for HavenStay Forensic v5.0.
 */
class AuthController extends Controller
{
    /**
     * Authenticate a user and issue a forensic session token.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = $request->validated();

        $result = AuthService::login($credentials);
        $authenticatedUser = $result['user'];
        $token = $result['token'];

        return $this->success('Authenticated successfully.', [
            'user' => new UserResource($authenticatedUser->load('role')),
            'token' => $token,
        ]);
    }

    /**
     * Retrieve the current authenticated user's profile.
     */
    public function me(Request $request): JsonResponse
    {
        return $this->success('Authenticated user retrieved successfully.', new UserResource($request->user()->load('role')));
    }

    /**
     * Terminate the current session.
     */
    public function logout(Request $request): JsonResponse
    {
        AuthService::logout($request->user());

        return $this->success('Logged out successfully.', null);
    }
}
