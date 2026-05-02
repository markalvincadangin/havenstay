<?php

namespace App\Services\Identity;

use App\Models\User;
use App\Services\Concerns\ManagesWorkflows;
use App\Services\Core\AuditService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

/**
 * AuthService
 *
 * Manages the authentication lifecycle, session tracking, and
 * security event logging.
 * Optimized for HavenStay Forensic v5.0.
 */
class AuthService
{
    use ManagesWorkflows;

    /**
     * @param  array{username?:string,email?:string,password:string}  $credentials
     * @return array{user:User,token:string}
     */
    public static function login(array $credentials): array
    {
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

        /** @var User $authenticatedUser */
        $authenticatedUser = User::where($loginField, $identifier)->firstOrFail();

        // Forensic Rule: Last Login update must be a tracked workflow
        self::runWriteWorkflow(
            actorId: $authenticatedUser->user_id,
            action: 'USER_LOGIN',
            payload: ['login_field' => $loginField, 'identifier' => $identifier],
            operation: function () use ($authenticatedUser) {
                $authenticatedUser->update(['last_login_at' => now()]);
            }
        );

        AuditService::logLogin($authenticatedUser);

        return [
            'user' => $authenticatedUser,
            'token' => $authenticatedUser->createToken('api-token')->plainTextToken,
        ];
    }

    /**
     * Authenticate via OAuth provider.
     * 
     * @param array{provider:string, provider_id:string, email:string, first_name:string, last_name:string, avatar?:string} $data
     * @return array{user:User,token:string}
     */
    public static function oauthLogin(array $data): array
    {
        // Forensic Rule: OAuth logins must be mapped to existing identities or held for approval
        $user = User::where('email', $data['email'])
            ->orWhere('google_id', $data['provider_id'])
            ->first();

        if (!$user) {
            // Non-Destructive Auto-Registration: Create as inactive or basic role
            // In a strict forensic environment, we might block this or assign 'viewer'
            $user = User::create([
                'role_id' => 3, // Default to 'Viewer'
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'username' => explode('@', $data['email'])[0] . '_' . rand(100, 999),
                'email' => $data['email'],
                'password_hash' => \Illuminate\Support\Facades\Hash::make(\Illuminate\Support\Str::random(32)),
                'google_id' => $data['provider_id'],
                'avatar_url' => $data['avatar'] ?? null,
                'oauth_provider' => $data['provider'],
                'is_active' => true,
            ]);
        } else {
            // Update provider info if missing
            $user->update([
                'google_id' => $data['provider_id'],
                'avatar_url' => $data['avatar'] ?? $user->avatar_url,
                'oauth_provider' => $data['provider'],
            ]);
        }

        if (!$user->isActive()) {
            throw ValidationException::withMessages([
                'oauth' => ['This account has been deactivated.'],
            ]);
        }

        self::runWriteWorkflow(
            actorId: $user->user_id,
            action: 'USER_OAUTH_LOGIN',
            payload: ['provider' => $data['provider'], 'email' => $data['email']],
            operation: function () use ($user) {
                $user->update(['last_login_at' => now()]);
            }
        );

        AuditService::logLogin($user);

        return [
            'user' => $user,
            'token' => $user->createToken('api-token')->plainTextToken,
        ];
    }

    public static function logout(?User $user): void
    {
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
    }
}
