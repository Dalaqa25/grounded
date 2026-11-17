import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let admin: SupabaseClient | null = null;

/**
 * Service-role client. Server-side only — it bypasses row-level security, so it
 * must never be imported into a client component.
 */
export function supabaseAdmin(): SupabaseClient {
  if (admin) return admin;
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
  admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
