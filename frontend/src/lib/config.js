/** Use empty string for same-origin `/api/*` (Next.js rewrites to Laravel). */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
