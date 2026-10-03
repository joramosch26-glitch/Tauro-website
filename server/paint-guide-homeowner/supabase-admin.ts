import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { HomeownerServerEnvironment } from "./types.js";

export function createHomeownerSupabaseAdminClient(
  environment: HomeownerServerEnvironment,
): SupabaseClient {
  return createClient(
    environment.supabaseUrl.toString(),
    environment.supabaseSecretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}
