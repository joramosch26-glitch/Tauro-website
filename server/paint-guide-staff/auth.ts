import { isAuthError, type SupabaseClient } from "@supabase/supabase-js";
import { loadPaintGuideServerEnvironment } from "../paint-guide-homeowner/env.js";
import { homeownerJsonResponse } from "../paint-guide-homeowner/responses.js";
import { createHomeownerSupabaseAdminClient } from "../paint-guide-homeowner/supabase-admin.js";
import type { PaintGuideServerEnvironment } from "../paint-guide-homeowner/types.js";

export type PaintGuideStaffRole = "owner" | "supervisor";
export type PaintGuideStaffIdentity = { userId: string; role: PaintGuideStaffRole };
export type PaintGuideStaffFailure =
  | "unauthenticated"
  | "invalid_credential"
  | "unauthorized_staff"
  | "profile_missing"
  | "profile_inactive"
  | "forbidden_role"
  | "internal_failure";
export type PaintGuideStaffResult =
  | { kind: "authorized"; staff: PaintGuideStaffIdentity }
  | { kind: "denied"; reason: PaintGuideStaffFailure };

type StaffAuthorizationDependencies = {
  loadEnvironment?: () => PaintGuideServerEnvironment;
  createClient?: (environment: PaintGuideServerEnvironment) => SupabaseClient;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_BEARER_BYTES = 8192;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function isStaffRole(value: unknown): value is PaintGuideStaffRole {
  return value === "owner" || value === "supervisor";
}

function denied(reason: PaintGuideStaffFailure): PaintGuideStaffResult {
  return { kind: "denied", reason };
}

function bearerFromRequest(request: Request) {
  const header = request.headers.get("authorization");
  if (header === null) return null;
  if (header.length > MAX_BEARER_BYTES) return undefined;
  // Fetch Headers joins duplicate Authorization values with commas; this
  // rejects joined credentials as well as extra whitespace/schemes/padding.
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(header);
  if (!match) return undefined;
  try {
    const parts = match[1].split(".");
    const bytes = parts.map((part) => Buffer.from(part, "base64url"));
    if (bytes.some((part, index) => part.toString("base64url") !== parts[index])) return undefined;
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const jwtHeader: unknown = JSON.parse(decoder.decode(bytes[0]));
    const payload: unknown = JSON.parse(decoder.decode(bytes[1]));
    // Syntax checks only: no decoded claim is used as identity or authority.
    if (!isObject(jwtHeader) || !isObject(payload) || jwtHeader.typ !== "JWT"
      || !["HS256", "ES256", "RS256"].includes(String(jwtHeader.alg))) return undefined;
    return match[1];
  } catch {
    return undefined;
  }
}

function validUserClaims(value: unknown, environment: PaintGuideServerEnvironment) {
  if (!isObject(value)) return null;
  const now = Math.floor(Date.now() / 1000);
  // The SDK verifies signatures/expiry, but does not enforce our exact issuer
  // or user-token contract. Inspect only claims returned AFTER verification.
  if (
    value.iss !== new URL("/auth/v1", environment.supabaseUrl).toString()
    || value.aud !== "authenticated"
    || value.role !== "authenticated"
    || typeof value.sub !== "string" || !UUID.test(value.sub)
    || typeof value.session_id !== "string" || !UUID.test(value.session_id)
    || !Number.isSafeInteger(value.exp) || (value.exp as number) <= now
    || !Number.isSafeInteger(value.iat) || (value.iat as number) > now
    || (value.iat as number) >= (value.exp as number)
    || (value.nbf !== undefined && (!Number.isSafeInteger(value.nbf) || (value.nbf as number) > now))
    || value.is_anonymous === true
  ) return null;
  return value.sub;
}

function verificationFailure(error: unknown): PaintGuideStaffFailure {
  if (error instanceof SyntaxError) return "invalid_credential";
  if (isAuthError(error) && (
    error.name === "AuthInvalidJwtError"
    || (error.status !== undefined && [400, 401, 403, 422].includes(error.status))
  )) return "invalid_credential";
  return "internal_failure";
}

export function createPaintGuideStaffClient(
  environment: PaintGuideServerEnvironment,
  fetchImplementation: typeof fetch = fetch,
) {
  return createHomeownerSupabaseAdminClient(environment, async (input, init) => {
    try {
      return await fetchImplementation(input, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      // auth-js logs thrown transport errors. Convert them before they reach
      // the SDK so a fetch exception containing request secrets cannot leak.
      return new Response(null, { status: 503 });
    }
  });
}

export function createPaintGuideStaffAuthorizer(dependencies: StaffAuthorizationDependencies = {}) {
  const loadEnvironment = dependencies.loadEnvironment ?? loadPaintGuideServerEnvironment;
  const createClient = dependencies.createClient ?? createPaintGuideStaffClient;

  return async function requirePaintGuideStaff(
    request: Request,
    allowedRoles: readonly PaintGuideStaffRole[],
  ): Promise<PaintGuideStaffResult> {
    const bearer = bearerFromRequest(request);
    if (bearer === null) return denied("unauthenticated");
    if (bearer === undefined) return denied("invalid_credential");
    if (!Array.isArray(allowedRoles) || allowedRoles.length === 0 || !allowedRoles.every(isStaffRole)) {
      return denied("forbidden_role");
    }

    try {
      const environment = loadEnvironment();
      const client = createClient(environment);
      // Always pass the explicit bearer: never read SDK session storage, accept
      // caller JWKS, or allow expired tokens. JWKS/Auth URLs come from config.
      const { data, error } = await client.auth.getClaims(bearer);
      if (error) return denied(verificationFailure(error));
      const userId = validUserClaims(data?.claims, environment);
      if (userId === null) return denied("invalid_credential");

      const { data: profile, error: profileError } = await client
        .schema("public")
        .from("profiles")
        .select("user_id, role, active")
        .eq("user_id", userId)
        .maybeSingle();
      if (profileError) return denied("internal_failure");
      if (profile === null) return denied("profile_missing");
      if (
        !isObject(profile) || profile.user_id !== userId
        || typeof profile.active !== "boolean" || !isStaffRole(profile.role)
      ) return denied("unauthorized_staff");
      if (!profile.active) return denied("profile_inactive");
      if (!allowedRoles.includes(profile.role)) return denied("forbidden_role");

      // Return no JWT, Auth user, metadata, or unrelated profile fields.
      return { kind: "authorized", staff: { userId, role: profile.role } };
    } catch (error) {
      return denied(verificationFailure(error));
    }
  };
}

export const requirePaintGuideStaff = createPaintGuideStaffAuthorizer();

export function paintGuideStaffFailureResponse(failure: PaintGuideStaffFailure) {
  // All denials share one body. Profile absence/inactivity/role are deliberately
  // indistinguishable externally; diagnostic classifications stay internal.
  const status = failure === "internal_failure" ? 503
    : failure === "unauthenticated" || failure === "invalid_credential" ? 401 : 403;
  return homeownerJsonResponse({ available: false }, { status });
}
