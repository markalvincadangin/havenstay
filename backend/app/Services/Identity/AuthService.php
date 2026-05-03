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
            AuditService::logFailedLogin('unknown', 'Empty credentials provided');
            throw ValidationException::withMessages([
                'username' => ['The username or email field is required.'],
            ]);
        }

        $loginField = filter_var($identifier, FILTER_VALIDATE_EMAIL) ? 'email' : 'username';

        $user = User::where($loginField, $identifier)->first();
        if ($user && ! $user->isActive()) {
            AuditService::logFailedLogin($identifier, 'Account deactivated');
            throw ValidationException::withMessages([
                'username' => ['This account has been deactivated.'],
            ]);
        }

        if (! Auth::attempt([
            $loginField => $identifier,
            'password' => $credentials['password'],
        ])) {
            AuditService::logFailedLogin($identifier, 'Invalid credentials');
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
        // Resolve user
        $user = User::where('email', $data['email'])
            ->orWhere('google_id', $data['provider_id'])
            ->first();

        if (!$user) {
            // Strict Forensic Rule: Do not auto-provision unknown OAuth identities.
            // Users must be pre-registered by an administrator.
            throw ValidationException::withMessages([
                'oauth' => ['This account is not registered in the system. Please contact an administrator.'],
            ]);
        } else {
            // Guard BEFORE updating: do not update a deactivated user's profile
            if (!$user->isActive()) {
                throw ValidationException::withMessages([
                    'oauth' => ['This account has been deactivated.'],
                ]);
            }
            // Update provider info only for active users
            $user->update([
                'google_id'      => $data['provider_id'],
                'avatar_url'     => $data['avatar'] ?? $user->avatar_url,
                'oauth_provider' => $data['provider'],
            ]);
        }

        // Guard for auto-provisioned users (edge case: created as inactive)
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

        AuditService::logLogin($user, ['auth_method' => 'oauth', 'provider' => $data['provider']]);

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
