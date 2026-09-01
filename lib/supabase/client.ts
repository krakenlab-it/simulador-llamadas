import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client factory.
 * Wire API routes and server actions in a later PR.
 */
export function createServerSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key. See .env.example.",
    );
  }

  return createClient(url, key);
}

let browserClient: SupabaseClient | null = null;

/**
 * Browser Supabase client factory.
 * Use in client components once auth and screens land.
 */
export function createBrowserSupabaseClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  browserClient = createClient(url, key);
  return browserClient;
}
