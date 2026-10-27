import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { EnvironmentSource, PaintGuideServerEnvironment } from "./types.js";

function invalidAdminConfiguration(): never {
  throw new Error("Paint Guide admin transport is unavailable.");
}

export function resolveHomeownerSupabaseAdminUrl(
  environment: Pick<PaintGuideServerEnvironment, "environment" | "supabaseUrl">,
  source: EnvironmentSource = process.env,
) {
  const configuredUrl = source.TAURO_PG_LOCAL_SUPABASE_ADMIN_URL;
  if (configuredUrl === undefined) {
    if (environment.environment === "test" && environment.supabaseUrl.protocol === "https:") {
      return invalidAdminConfiguration();
    }
    return environment.supabaseUrl.toString();
  }
  if (environment.environment !== "test") return invalidAdminConfiguration();
  if (source.TAURO_PG_LOCAL_SUPABASE_UPSTREAM !== configuredUrl) return invalidAdminConfiguration();

  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== "http:" || url.origin !== configuredUrl || url.username || url.password
      || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port || Number(url.port) > 65535) {
      return invalidAdminConfiguration();
    }
    return url.toString();
  } catch {
    return invalidAdminConfiguration();
  }
}

export function createHomeownerSupabaseAdminClient(
  environment: PaintGuideServerEnvironment,
  fetchImplementation?: typeof fetch,
): SupabaseClient {
  return createClient(
    resolveHomeownerSupabaseAdminUrl(environment),
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
