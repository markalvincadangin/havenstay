<?php
 
 namespace App\Services\Identity;
 
 use App\Models\User;
 use App\Services\Core\AuditService;
 use App\Services\Concerns\ManagesWorkflows;
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
