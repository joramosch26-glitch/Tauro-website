// Pure configuration validation: safe to share with Vite and server functions.
export type PaintGuideEnvironment = "development" | "test" | "preview" | "production";
export type ConfigurationSource = Readonly<Record<string, string | undefined>>;

export class PaintGuideConfigurationError extends Error {
  constructor() { super("Paint Guide configuration is unavailable."); }
}

export function requiredConfiguration(source: ConfigurationSource, name: string) {
  const value = source[name];
  if (!value || value !== value.trim()) throw new PaintGuideConfigurationError();
  return value;
}

export function parsePaintGuideEnvironment(value: string): PaintGuideEnvironment {
  if (!["development", "test", "preview", "production"].includes(value)) {
    throw new PaintGuideConfigurationError();
  }
  return value as PaintGuideEnvironment;
}

export function validateDeploymentEnvironment(source: ConfigurationSource, environment: PaintGuideEnvironment) {
  // Only trusted process configuration is used; request/proxy headers never enter here.
  if (source.VERCEL === undefined && source.VERCEL_ENV === undefined) return;
  if (source.VERCEL !== "1" || !["development", "preview", "production"].includes(source.VERCEL_ENV ?? "")
    || source.VERCEL_ENV !== environment) throw new PaintGuideConfigurationError();
}

export function parseProjectReference(value: string) {
  if (!/^[a-z0-9]{20}$/.test(value)) throw new PaintGuideConfigurationError();
  return value;
}

export function isHttpLoopbackOrigin(value: string) {
  const match = /^http:\/\/(?:localhost|127\.0\.0\.1):([1-9][0-9]*)$/.exec(value);
  return match !== null && Number(match[1]) <= 65535 && Number(match[1]) !== 80;
}

export function parseProjectUrl(value: string, reference: string, environment: PaintGuideEnvironment) {
  parseProjectReference(reference);
  const hosted = value === `https://${reference}.supabase.co` || value === `https://${reference}.supabase.co/`;
  const local = (environment === "development" || environment === "test")
    && isHttpLoopbackOrigin(value.endsWith("/") ? value.slice(0, -1) : value);
  if (!hosted && !local) throw new PaintGuideConfigurationError();
  return new URL(value);
}

function jwtPayload(value: string): Record<string, unknown> | null {
  const parts = value.split(".");
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
  try {
    const decode = (part: string) => JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    const header = decode(parts[0]);
    const payload = decode(parts[1]);
    if (header.alg !== "HS256" || !payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    return payload;
  } catch { return null; }
}

export function validateBrowserKey(value: string, reference: string, local: boolean) {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return;
  const payload = jwtPayload(value);
  // Parsing classifies legacy keys; Supabase, not these unverified claims, authenticates them.
  if (!payload || payload.role !== "anon" || (!local && payload.ref !== reference)) {
    throw new PaintGuideConfigurationError();
  }
}

const BROWSER_NAMES = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_TAURO_PG_EXPECTED_PROJECT_REF", "VITE_TAURO_PG_ENVIRONMENT"] as const;

export function loadBrowserConfiguration(source: ConfigurationSource) {
  if (BROWSER_NAMES.every((name) => !source[name])) return null;
  const environment = parsePaintGuideEnvironment(requiredConfiguration(source, BROWSER_NAMES[3]));
  const reference = parseProjectReference(requiredConfiguration(source, BROWSER_NAMES[2]));
  const url = parseProjectUrl(requiredConfiguration(source, BROWSER_NAMES[0]), reference, environment);
  const key = requiredConfiguration(source, BROWSER_NAMES[1]);
  validateBrowserKey(key, reference, url.protocol === "http:");
  return { environment, reference, url, key };
}

export function validateBrowserServerAgreement(source: ConfigurationSource, required = false) {
  const browser = loadBrowserConfiguration(source);
  if (!browser) {
    if (required) throw new PaintGuideConfigurationError();
    return null;
  }
  const reference = parseProjectReference(requiredConfiguration(source, "TAURO_PG_EXPECTED_PROJECT_REF"));
  const environment = parsePaintGuideEnvironment(requiredConfiguration(source, "TAURO_PG_ENVIRONMENT"));
  validateDeploymentEnvironment(source, environment);
  const url = parseProjectUrl(requiredConfiguration(source, "TAURO_PG_SUPABASE_URL"), reference, environment);
  if (browser.reference !== reference || browser.environment !== environment || browser.url.href !== url.href) {
    throw new PaintGuideConfigurationError();
  }
  return browser;
}

export function validateBrowserBuild(source: ConfigurationSource) {
  for (const [name, value] of Object.entries(source)) {
    if (!name.startsWith("VITE_") || !value) continue;
    if (/SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|HMAC|ENCRYPTION/i.test(name)
      || value.includes("sb_secret_") || jwtPayload(value)?.role === "service_role") {
      throw new PaintGuideConfigurationError();
    }
  }
  const browser = loadBrowserConfiguration(source);
  if (!browser) {
    if (source.VERCEL !== undefined || source.VERCEL_ENV !== undefined) throw new PaintGuideConfigurationError();
    return null; // Existing local marketing builds remain available without Paint Guide config.
  }
  validateBrowserServerAgreement(source, true);
  return browser;
}
