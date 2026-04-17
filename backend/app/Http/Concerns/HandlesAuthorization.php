<?php

namespace App\Http\Concerns;

use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

trait HandlesAuthorization
{
    protected function forbidden(Request $request, string $resource, string $message): JsonResponse
    {
        AuditService::logAccessDenied($request->user(), $resource);

        return response()->json(['message' => $message], 403);
    }

    protected function forbiddenExport(Request $request, string $resource, string $message): never
    {
        AuditService::logAccessDenied($request->user(), $resource);
        abort(403, $message);
    }
}
