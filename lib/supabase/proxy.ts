import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Public routes that an unauthenticated visitor is allowed to reach.
const PUBLIC_PATHS = ["/login", "/signup", "/auth"];

// Headers Supabase attaches to any response that sets refreshed auth cookies,
// so shared caches/CDNs never store a response carrying someone's session.
const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

// Builds a redirect that still carries the session cookies and cache headers
// staged on `base` during getClaims(). Returning a bare NextResponse.redirect
// here would drop a token refresh performed on this request and log the user out.
function redirectCarrying(
  request: NextRequest,
  pathname: string,
  base: NextResponse,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const response = NextResponse.redirect(url);
  base.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  for (const key of ["cache-control", "pragma", "expires"]) {
    const value = base.headers.get(key);
    if (value) response.headers.set(key, value);
  }
  return response;
}

// Refreshes the Supabase auth session on every request and keeps the
// session cookies in sync between the browser and the server.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Always create a fresh client per request (do not hoist to module scope).
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          // Prevent CDNs/proxies from caching responses that set auth cookies.
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims(): it validates
  // the JWT signature and refreshes the token when needed.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const { pathname } = request.nextUrl;

  // API routes handle their own auth and return JSON, so never redirect them.
  // Route handlers may also refresh the token via lib/supabase/server.ts, which
  // cannot set response headers from its context, so guarantee the no-store
  // headers here for every /api response.
  if (pathname.startsWith("/api")) {
    for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
      supabaseResponse.headers.set(key, value);
    }
    return supabaseResponse;
  }

  // Not logged in and trying to reach a protected page -> send to /login.
  if (!user && !isPublicPath(pathname)) {
    return redirectCarrying(request, "/login", supabaseResponse);
  }

  // Already logged in but on an auth page -> send to the app.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    return redirectCarrying(request, "/", supabaseResponse);
  }

  // IMPORTANT: return supabaseResponse unchanged so the refreshed cookies
  // reach the browser and the session stays in sync.
  return supabaseResponse;
}
