import type {
  EnvironmentSource,
  HomeownerEnvironment,
  HomeownerServerEnvironment,
  PaintGuideServerEnvironment,
} from "./types.js";
import { decodeBase64Url } from "./encoding.js";
import {
  parseProjectUrl,
  validateDeploymentEnvironment,
  validateBrowserServerAgreement,
  isHttpLoopbackOrigin,
} from "../../src/paint-guide/lib/environment.js";

const CANONICAL_PRODUCTION_ORIGIN = "https://www.tauropainting.com";
const ALLOWED_ENVIRONMENTS = new Set<HomeownerEnvironment>([
  "development",
  "preview",
  "production",
  "test",
]);
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const KEY_VERSION_PATTERN = /^[1-9][0-9]*$/;
const MAX_SMALLINT = 32767;

export class HomeownerEnvironmentError extends Error {
  constructor() {
    super("Homeowner server configuration is unavailable.");
  }
}

function requiredValue(source: EnvironmentSource, name: string) {
  const value = source[name];
  if (!value || !value.trim() || value !== value.trim()) {
    throw new HomeownerEnvironmentError();
  }
  return value;
}

function parseAllowedOrigins(value: string, environment: HomeownerEnvironment) {
  const values = value.split(",");
  if (!values.length || values.some((item) => !item || item !== item.trim())) {
    throw new HomeownerEnvironmentError();
  }

  const origins = new Set<string>();

  for (const value of values) {
    let origin: URL;

    try {
      origin = new URL(value);
    } catch {
      throw new HomeownerEnvironmentError();
    }

    if (
      origin.origin !== value ||
      (origin.protocol !== "https:" && origin.protocol !== "http:") ||
      origins.has(origin.origin)
    ) {
      throw new HomeownerEnvironmentError();
    }

    if (origin.protocol === "http:" && ((environment !== "development" && environment !== "test")
      || !isHttpLoopbackOrigin(value))) {
      throw new HomeownerEnvironmentError();
    }

    origins.add(origin.origin);
  }

  // A single cookie policy must work for every configured origin.
  if (new Set([...origins].map((value) => new URL(value).protocol)).size !== 1) {
    throw new HomeownerEnvironmentError();
  }
  if (environment === "production" && !origins.has(CANONICAL_PRODUCTION_ORIGIN)) {
    throw new HomeownerEnvironmentError();
  }

  return origins;
}

function parseKeyVersion(value: string) {
  if (!KEY_VERSION_PATTERN.test(value)) throw new HomeownerEnvironmentError();
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version > MAX_SMALLINT) {
    throw new HomeownerEnvironmentError();
  }
  return version;
}

function parseVersionedKeyring(
  source: EnvironmentSource,
  activeVersionName: string,
  keyPrefix: string,
) {
  const activeVersion = parseKeyVersion(requiredValue(source, activeVersionName));
  const keys = new Map<number, Buffer>();

  for (const [name, value] of Object.entries(source)) {
    if (!name.startsWith(keyPrefix)) continue;

    const versionValue = name.slice(keyPrefix.length);
    const version = parseKeyVersion(versionValue);
    if (keys.has(version)) throw new HomeownerEnvironmentError();

    let key: Buffer;
    try {
      key = decodeBase64Url(requiredValue({ value }, "value"));
    } catch {
      throw new HomeownerEnvironmentError();
    }
    if (key.length !== 32) throw new HomeownerEnvironmentError();
    keys.set(version, key);
  }

  if (!keys.has(activeVersion)) throw new HomeownerEnvironmentError();
  return { activeVersion, keys };
}

// Staff authorization uses the same project/privacy checks without crypto keys.
export function loadPaintGuideServerEnvironment(
  source: EnvironmentSource = process.env,
): PaintGuideServerEnvironment {
  const expectedProjectRef = requiredValue(source, "TAURO_PG_EXPECTED_PROJECT_REF");
  if (!PROJECT_REF_PATTERN.test(expectedProjectRef)) {
    throw new HomeownerEnvironmentError();
  }

  const environmentValue = requiredValue(source, "TAURO_PG_ENVIRONMENT");
  if (!ALLOWED_ENVIRONMENTS.has(environmentValue as HomeownerEnvironment)) {
    throw new HomeownerEnvironmentError();
  }
  const environment = environmentValue as HomeownerEnvironment;

  if (requiredValue(source, "TAURO_PG_HOMEOWNER_ACCESS_ENABLED") !== "true") {
    throw new HomeownerEnvironmentError();
  }

  let supabaseUrl: URL;
  try {
    validateDeploymentEnvironment(source, environment);
    validateBrowserServerAgreement(source, source.VERCEL !== undefined || source.VERCEL_ENV !== undefined);
    supabaseUrl = parseProjectUrl(
      requiredValue(source, "TAURO_PG_SUPABASE_URL"),
      expectedProjectRef,
      environment,
    );
  } catch { throw new HomeownerEnvironmentError(); }

  return {
    supabaseUrl,
    supabaseSecretKey: requiredValue(source, "TAURO_PG_SUPABASE_SECRET_KEY"),
    expectedProjectRef,
    environment,
    allowedOrigins: parseAllowedOrigins(
      requiredValue(source, "TAURO_PG_ALLOWED_ORIGINS"),
      environment,
    ),
  };
}

export function loadHomeownerServerEnvironment(
  source: EnvironmentSource = process.env,
): HomeownerServerEnvironment {
  return {
    ...loadPaintGuideServerEnvironment(source),
    tokenLookupHmacKeys: parseVersionedKeyring(
      source,
      "TAURO_PG_TOKEN_LOOKUP_HMAC_ACTIVE_VERSION",
      "TAURO_PG_TOKEN_LOOKUP_HMAC_KEY_V",
    ),
    tokenEncryptionKeys: parseVersionedKeyring(
      source,
      "TAURO_PG_TOKEN_ENCRYPTION_ACTIVE_VERSION",
      "TAURO_PG_TOKEN_ENCRYPTION_KEY_V",
    ),
    sessionHmacKeys: parseVersionedKeyring(
      source,
      "TAURO_PG_SESSION_HMAC_ACTIVE_VERSION",
      "TAURO_PG_SESSION_HMAC_KEY_V",
    ),
  };
}
