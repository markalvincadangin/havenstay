<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = $request->validated();

        $result = AuthService::login($credentials);
        $authenticatedUser = $result['user'];
        $token = $result['token'];

        return response()->json([
            'message' => 'Authenticated.',
            'data' => [
                'user' => $authenticatedUser->load('role'),
                'token' => $token,
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'message' => 'Authenticated user retrieved successfully.',
            'data' => $request->user()?->load('role'),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        AuthService::logout($request->user());

        return response()->json([
            'message' => 'Logged out.',
            'data' => null,
        ]);
    }
}
