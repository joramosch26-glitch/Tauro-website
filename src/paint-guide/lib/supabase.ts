import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

function isValidProjectUrl(value: string) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.hostname === "localhost";
  } catch {
    return false;
  }
}

export const isSupabaseConfigured =
  isValidProjectUrl(supabaseUrl) && Boolean(supabasePublishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
