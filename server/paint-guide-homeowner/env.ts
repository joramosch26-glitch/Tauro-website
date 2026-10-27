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
// This dedicated QA branch is the only Preview deployment allowed to reach the
// synthetic release. VERCEL_BRANCH_URL is platform supplied and distinct from
// the immutable deployment URL in VERCEL_URL; compare it to this exact host.
export const PAINT_GUIDE_ISOLATED_PREVIEW_BRANCH = "pgv1";
export const PAINT_GUIDE_ISOLATED_PREVIEW_HOST = "tauro-paint-guide-v1-qa-git-pgv1-jose-ramos-projects-4c64cbba.vercel.app";
export const PAINT_GUIDE_ISOLATED_PREVIEW_ORIGIN = `https://${PAINT_GUIDE_ISOLATED_PREVIEW_HOST}`;
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

function assertIsolatedPreviewOrigin(
  source: EnvironmentSource,
  environment: HomeownerEnvironment,
  origins: ReadonlySet<string>,
) {
  if (environment !== "preview") return;
  // Preview is pinned to one branch URL. Never derive CORS trust from request
  // Host/Origin headers, and fail closed if Vercel omits or changes its value.
  if (source.VERCEL !== "1" || source.VERCEL_ENV !== "preview"
    || source.VERCEL_TARGET_ENV !== "preview"
    || source.VERCEL_GIT_COMMIT_REF !== PAINT_GUIDE_ISOLATED_PREVIEW_BRANCH
    || source.VERCEL_BRANCH_URL !== PAINT_GUIDE_ISOLATED_PREVIEW_HOST
    || origins.size !== 1 || !origins.has(PAINT_GUIDE_ISOLATED_PREVIEW_ORIGIN)) {
    throw new HomeownerEnvironmentError();
  }
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

  if (source.VITE_TAURO_PG_TEST_SUPABASE_ORIGIN !== undefined && environment !== "test") {
    throw new HomeownerEnvironmentError();
  }

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
      source.VITE_TAURO_PG_TEST_SUPABASE_ORIGIN,
    );
  } catch { throw new HomeownerEnvironmentError(); }

  let syntheticRelease: PaintGuideServerEnvironment["syntheticRelease"];
  if (environment === "production") {
    if (source.TAURO_PG_PREVIEW_SYNTHETIC_RELEASE_ENABLED !== undefined) throw new HomeownerEnvironmentError();
    const enabled = requiredValue(source, "TAURO_PG_CUSTOMER_ACCESS_ENABLED");
    if (enabled !== "true" && enabled !== "false") throw new HomeownerEnvironmentError();
    if (enabled === "false") {
      const guideId = requiredValue(source, "TAURO_PG_SYNTHETIC_RELEASE_GUIDE_ID");
      const actorId = requiredValue(source, "TAURO_PG_SYNTHETIC_RELEASE_ACTOR_ID");
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
      if (!uuid.test(guideId) || !uuid.test(actorId) || guideId === actorId) throw new HomeownerEnvironmentError();
      syntheticRelease = { guideId, actorId };
    } else if (source.TAURO_PG_SYNTHETIC_RELEASE_GUIDE_ID || source.TAURO_PG_SYNTHETIC_RELEASE_ACTOR_ID) {
      // Activation is a separate explicit configuration decision, not omission.
      throw new HomeownerEnvironmentError();
    }
  } else if (environment === "preview") {
    // Preview may access the shared project only through an explicit, pinned
    // synthetic release in a real Vercel Preview deployment. Ordinary Preview
    // configurations remain unavailable, and customer access must stay off.
    if (source.VERCEL !== "1" || source.VERCEL_ENV !== "preview"
      || source.TAURO_PG_PREVIEW_SYNTHETIC_RELEASE_ENABLED !== "true"
      || source.TAURO_PG_CUSTOMER_ACCESS_ENABLED !== "false") throw new HomeownerEnvironmentError();
    const guideId = requiredValue(source, "TAURO_PG_SYNTHETIC_RELEASE_GUIDE_ID");
    const actorId = requiredValue(source, "TAURO_PG_SYNTHETIC_RELEASE_ACTOR_ID");
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    if (!uuid.test(guideId) || !uuid.test(actorId) || guideId === actorId) throw new HomeownerEnvironmentError();
    syntheticRelease = { guideId, actorId };
  } else if (source.TAURO_PG_PREVIEW_SYNTHETIC_RELEASE_ENABLED !== undefined) {
    throw new HomeownerEnvironmentError();
  }

  const allowedOrigins = parseAllowedOrigins(
    requiredValue(source, "TAURO_PG_ALLOWED_ORIGINS"),
    environment,
  );
  assertIsolatedPreviewOrigin(source, environment, allowedOrigins);

  return {
    supabaseUrl,
    supabaseSecretKey: requiredValue(source, "TAURO_PG_SUPABASE_SECRET_KEY"),
    expectedProjectRef,
    environment,
    ...(syntheticRelease ? { syntheticRelease } : {}),
    allowedOrigins,
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
