<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Services\Identity\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Symfony\Component\HttpFoundation\Response;
use App\Services\Core\AuditService;
use Laravel\Socialite\Facades\Socialite;
use Illuminate\Support\Facades\Log;

/**
 * OAuthController
 *
 * Handles professional external identity verification via Google.
 * Integrated with HavenStay Forensic auditing.
 */
class OAuthController extends Controller
{
    /**
     * Redirect the user to the Google authentication page.
     */
    public function redirectToGoogle(): Response
    {
        /** @var \Laravel\Socialite\Two\AbstractProvider $driver */
        $driver = Socialite::driver('google');
        
        return $driver->stateless()->redirect();
    }

    /**
     * Obtain the user information from Google.
     */
    public function handleGoogleCallback(): Response
    {
        $frontendBase = config('app.frontend_url', 'http://localhost:3000');

        // Set audit context manually since this route bypasses audit.context middleware
        $ip = request()->ip();

        try {
            /** @var \Laravel\Socialite\Two\AbstractProvider $driver */
            $driver = Socialite::driver('google');
            $googleUser = $driver->stateless()->user();

            $result = AuthService::oauthLogin([
                'provider'    => 'google',
                'provider_id' => $googleUser->getId(),
                'email'       => $googleUser->getEmail(),
                'first_name'  => $googleUser->user['given_name'] ?? $googleUser->getName(),
                'last_name'   => $googleUser->user['family_name'] ?? '',
                'avatar'      => $googleUser->getAvatar(),
            ]);

            return redirect()->away("{$frontendBase}/callback?token={$result['token']}");

        } catch (\Illuminate\Validation\ValidationException $e) {
            // Known business rule failure: deactivated or unregistered account
            $errors = $e->errors();
            $errorMessage = $errors['oauth'][0] ?? $e->getMessage();
            
            $errorType = str_contains($errorMessage, 'not registered') ? 'account_not_found' : 'account_deactivated';
            $logReason = str_contains($errorMessage, 'not registered') ? 'Unregistered account — OAuth access denied' : 'Account deactivated — OAuth access denied';

            $email = null;
            try {
                /** @var \Laravel\Socialite\Two\AbstractProvider $provider */
                $provider = Socialite::driver('google');
                $email = $provider->stateless()->user()->getEmail();
            } catch (\Throwable $err) {}

            AuditService::logFailedOAuth(
                provider: 'google',
                email: $email,
                reason: $logReason,
                ipAddress: $ip
            );

            Log::warning("OAuth blocked ({$errorType}): " . ($email ?? 'unknown'));
            return redirect()->away("{$frontendBase}/login?error={$errorType}");

        } catch (\Throwable $e) {
            // Unknown provider/network/system error
            AuditService::logFailedOAuth(
                provider: 'google',
                email: null,
                reason: 'OAuth provider error: ' . $e->getMessage(),
                ipAddress: $ip
            );

            Log::error('OAuth Callback Error: ' . $e->getMessage());
            return redirect()->away("{$frontendBase}/login?error=oauth_failed");
        }
    }
}
