import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PaintGuideServerEnvironment } from "./types.js";

export function createHomeownerSupabaseAdminClient(
  environment: PaintGuideServerEnvironment,
  fetchImplementation?: typeof fetch,
): SupabaseClient {
  return createClient(
    environment.supabaseUrl.toString(),
    environment.supabaseSecretKey,
    {
      ...(fetchImplementation ? { global: { fetch: fetchImplementation } } : {}),
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}
