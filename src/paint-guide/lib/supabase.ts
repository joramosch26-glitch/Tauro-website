import { createClient } from "@supabase/supabase-js";
import { loadBrowserConfiguration } from "./environment";

function browserConfiguration() {
  try {
    return loadBrowserConfiguration({
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      VITE_TAURO_PG_EXPECTED_PROJECT_REF: import.meta.env.VITE_TAURO_PG_EXPECTED_PROJECT_REF,
      VITE_TAURO_PG_ENVIRONMENT: import.meta.env.VITE_TAURO_PG_ENVIRONMENT,
    });
  } catch { return null; }
}

const configuration = browserConfiguration();
export const isSupabaseConfigured = configuration !== null;
export const supabase = configuration
  ? createClient(configuration.url.href, configuration.key, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
