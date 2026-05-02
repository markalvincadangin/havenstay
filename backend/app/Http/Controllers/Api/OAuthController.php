<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Services\Identity\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Symfony\Component\HttpFoundation\Response;
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
        try {
            /** @var \Laravel\Socialite\Two\AbstractProvider $driver */
            $driver = Socialite::driver('google');
            
            /** @var \Laravel\Socialite\Two\User $googleUser */
            $googleUser = $driver->stateless()->user();

            $result = AuthService::oauthLogin([
                'provider' => 'google',
                'provider_id' => $googleUser->getId(),
                'email' => $googleUser->getEmail(),
                'first_name' => $googleUser->user['given_name'] ?? $googleUser->getName(),
                'last_name' => $googleUser->user['family_name'] ?? '',
                'avatar' => $googleUser->getAvatar(),
            ]);

            $frontendUrl = config('app.frontend_url', 'http://localhost:3000') . '/callback';
            $token = $result['token'];
            
            return redirect()->away("{$frontendUrl}?token={$token}");
        } catch (\Exception $e) {
            Log::error('OAuth Callback Error: ' . $e->getMessage());
            $frontendUrl = config('app.frontend_url', 'http://localhost:3000') . '/login';
            return redirect()->away("{$frontendUrl}?error=oauth_failed");
        }
    }
}
