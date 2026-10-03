import type {
  EnvironmentSource,
  HomeownerEnvironment,
  HomeownerServerEnvironment,
} from "./types.js";

const CANONICAL_PRODUCTION_ORIGIN = "https://www.tauropainting.com";
const ALLOWED_ENVIRONMENTS = new Set<HomeownerEnvironment>([
  "development",
  "preview",
  "production",
  "test",
]);
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;

export class HomeownerEnvironmentError extends Error {
  constructor() {
    super("Homeowner server configuration is unavailable.");
  }
}

function requiredValue(source: EnvironmentSource, name: string) {
  const value = source[name]?.trim();
  if (!value) throw new HomeownerEnvironmentError();
  return value;
}

function parseSupabaseUrl(value: string, expectedProjectRef: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new HomeownerEnvironmentError();
  }

  const authorityEnd = value.search(/[\/?#]/);
  const authority = value.slice(
    "https://".length,
    authorityEnd === -1 ? value.length : authorityEnd,
  );

  if (
    url.protocol !== "https:" ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    url.port ||
    authority !== `${expectedProjectRef}.supabase.co`
  ) {
    throw new HomeownerEnvironmentError();
  }

  if (url.hostname !== `${expectedProjectRef}.supabase.co`) {
    throw new HomeownerEnvironmentError();
  }

  return url;
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

    if (environment === "production" && origin.protocol !== "https:") {
      throw new HomeownerEnvironmentError();
    }

    origins.add(origin.origin);
  }

  if (environment === "production" && !origins.has(CANONICAL_PRODUCTION_ORIGIN)) {
    throw new HomeownerEnvironmentError();
  }

  return origins;
}

export function loadHomeownerServerEnvironment(
  source: EnvironmentSource = process.env,
): HomeownerServerEnvironment {
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

  const supabaseUrl = parseSupabaseUrl(
    requiredValue(source, "TAURO_PG_SUPABASE_URL"),
    expectedProjectRef,
  );

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
