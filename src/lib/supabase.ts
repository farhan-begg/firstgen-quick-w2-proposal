import { createClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-safe Supabase client with auth support.
 * Safe to use in client components. Manages auth cookies automatically.
 */
export function getSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Server-only Supabase client using the service role key.
 * Bypasses RLS. NEVER expose this in client components.
 */
export function getSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey);
}
