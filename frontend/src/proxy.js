import { NextResponse } from "next/server";

const AUTH_PAGES = new Set(["/login", "/signin"]);
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/tenants",
  "/rooms",
  "/contracts",
  "/billing",
  "/payments",
  "/reports",
  "/users",
  "/audit-logs",
];

function isProtectedPath(pathname) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("havenstay_token")?.value;
  const isAuthPage = AUTH_PAGES.has(pathname);
  const protectedPath = isProtectedPath(pathname);

  if (pathname === "/") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = token ? "/dashboard" : "/login";
    return NextResponse.redirect(redirectUrl);
  }

  if (!token && protectedPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (token && isAuthPage) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
