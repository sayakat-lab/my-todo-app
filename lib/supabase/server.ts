import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase client for use on the server (Route Handlers).
// Reads/writes the session cookies through Next's cookie store.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a context where cookies can't be written.
            // Safe to ignore when the proxy is refreshing sessions.
          }
        },
      },
    },
  );
}
