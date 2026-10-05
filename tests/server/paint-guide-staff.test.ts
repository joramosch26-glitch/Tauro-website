import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync, sign, timingSafeEqual } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { loadPaintGuideServerEnvironment } from "../../server/paint-guide-homeowner/env.js";
import { hasAllowedHomeownerOrigin } from "../../server/paint-guide-homeowner/origin.js";
import {
  createPaintGuideStaffAuthorizer,
  createPaintGuideStaffClient,
  paintGuideStaffFailureResponse,
  type PaintGuideStaffFailure,
  type PaintGuideStaffRole,
} from "../../server/paint-guide-staff/auth.js";

const PROJECT_REF = "abcdefghijklmnopqrst";
const USER_ID = "72000000-0000-4000-8000-000000000001";
const SESSION_ID = "72000000-0000-4000-8000-000000000002";
const ENVIRONMENT = {
  TAURO_PG_SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`,
  TAURO_PG_SUPABASE_SECRET_KEY: "synthetic-server-credential",
  TAURO_PG_EXPECTED_PROJECT_REF: PROJECT_REF,
  TAURO_PG_ENVIRONMENT: "test",
  TAURO_PG_HOMEOWNER_ACCESS_ENABLED: "true",
  TAURO_PG_ALLOWED_ORIGINS: "http://127.0.0.1:55400",
};
const environment = loadPaintGuideServerEnvironment(ENVIRONMENT);
const EC = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const RSA = generateKeyPairSync("rsa", { modulusLength: 2048 });
const HMAC_KEY = Buffer.alloc(32, 37); // Synthetic Auth signing secret, never a deployment key.
const JWKS = { keys: [
  { ...EC.publicKey.export({ format: "jwk" }), kid: "staff-test-ec", alg: "ES256", use: "sig" },
  { ...RSA.publicKey.export({ format: "jwk" }), kid: "staff-test-rsa", alg: "RS256", use: "sig" },
] };

function claims(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: `${ENVIRONMENT.TAURO_PG_SUPABASE_URL}/auth/v1`,
    aud: "authenticated", role: "authenticated", sub: USER_ID,
    session_id: SESSION_ID, iat: now - 30, exp: now + 3600,
    ...overrides,
  };
}

function jwt(overrides: Record<string, unknown> = {}, algorithm = "ES256") {
  const header = { typ: "JWT", alg: algorithm,
    ...(algorithm === "HS256" ? {} : { kid: algorithm === "RS256" ? "staff-test-rsa" : "staff-test-ec" }) };
  const input = `${Buffer.from(JSON.stringify(header)).toString("base64url")}.${Buffer.from(JSON.stringify(claims(overrides))).toString("base64url")}`;
  const signature = algorithm === "HS256" ? createHmac("sha256", HMAC_KEY).update(input).digest()
    : sign("sha256", Buffer.from(input), { key: algorithm === "RS256" ? RSA.privateKey : EC.privateKey, dsaEncoding: "ieee-p1363" });
  return `${input}.${signature.toString("base64url")}`;
}

function request(authorization?: string) {
  return new Request("https://www.tauropainting.com/api/paint-guide/staff/test", {
    headers: authorization === undefined ? {} : { Authorization: authorization },
  });
}

type HarnessOptions = {
  profileRows?: unknown;
  profileStatus?: number;
  authStatus?: number;
  transportFailure?: boolean;
};

function harness(options: HarnessOptions = {}) {
  const calls: Array<{ path: string; authorization: string | null }> = [];
  const fetchImplementation: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    calls.push({ path: url.pathname, authorization: headers.get("authorization") });
    assert.equal(url.origin, environment.supabaseUrl.origin);
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    if (options.transportFailure) throw new Error(`private transport ${headers.get("authorization")} ${environment.supabaseSecretKey}`);
    if (url.pathname === "/auth/v1/.well-known/jwks.json") {
      return Response.json(JWKS);
    }
    if (url.pathname === "/auth/v1/user") {
      if (options.authStatus) return Response.json({ message: "private Auth details", error_code: "bad_jwt" }, { status: options.authStatus });
      // Simulate the symmetric project's Auth server, including actual HMAC
      // verification. The SDK itself verifies asymmetric signatures via JWKS.
      const bearer = headers.get("authorization")?.slice("Bearer ".length) ?? "";
      const [header, payload, signature] = bearer.split(".");
      const expected = createHmac("sha256", HMAC_KEY).update(`${header}.${payload}`).digest();
      const supplied = Buffer.from(signature, "base64url");
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
        return Response.json({ message: "private signature details" }, { status: 401 });
      }
      return Response.json({ id: USER_ID, aud: "authenticated", role: "authenticated" });
    }
    assert.equal(url.pathname, "/rest/v1/profiles");
    assert.equal(url.searchParams.get("select"), "user_id,role,active");
    assert.equal(url.searchParams.get("user_id"), `eq.${USER_ID}`);
    assert.equal(headers.get("accept-profile"), "public");
    // Identity verification must not replace the admin client's Authorization.
    assert.equal(headers.get("authorization"), `Bearer ${environment.supabaseSecretKey}`);
    return Response.json(options.profileRows === undefined
      ? [{ user_id: USER_ID, role: "owner", active: true }]
      : options.profileRows, { status: options.profileStatus ?? 200 });
  };
  const client = createPaintGuideStaffClient(environment, fetchImplementation);
  const authorize = createPaintGuideStaffAuthorizer({ loadEnvironment: () => environment, createClient: () => client });
  return { authorize, calls };
}

test("shared server environment preserves project/origin checks without homeowner crypto keys", () => {
  assert.deepEqual(Object.keys(environment).sort(), ["allowedOrigins", "environment", "expectedProjectRef", "supabaseSecretKey", "supabaseUrl"].sort());
  for (const overrides of [
    { TAURO_PG_SUPABASE_URL: "https://wrongprojectabcdefghij.supabase.co" },
    { TAURO_PG_SUPABASE_URL: `https://user:password@${PROJECT_REF}.supabase.co` },
    { TAURO_PG_SUPABASE_URL: `https://${PROJECT_REF}.supabase.co:443` },
    { TAURO_PG_HOMEOWNER_ACCESS_ENABLED: " true " },
    { TAURO_PG_ALLOWED_ORIGINS: "*" },
  ]) assert.throws(() => loadPaintGuideServerEnvironment({ ...ENVIRONMENT, ...overrides }));
  assert.equal(hasAllowedHomeownerOrigin(new Request("https://www.tauropainting.com", { headers: { Origin: "http://127.0.0.1:55400" } }), environment), true);
  assert.equal(hasAllowedHomeownerOrigin(new Request("https://www.tauropainting.com", { headers: { Origin: "http://127.0.0.1:55400/" } }), environment), false);
});

test("strict Bearer extraction rejects missing, wrong, empty, malformed, and ambiguous credentials", async () => {
  const { authorize, calls } = harness();
  assert.deepEqual(await authorize(request(), ["owner", "supervisor"]), { kind: "denied", reason: "unauthenticated" });
  for (const header of ["Basic abc", "Bearer", "Bearer ", "bearer a.b.c", "Bearer  a.b.c", "Bearer a.b", "Bearer a.b.c=", "Bearer a.b.c extra", "Bearer a.b.c, Bearer d.e.f", `Bearer ${"a".repeat(8192)}.b.c`]) {
    assert.deepEqual(await authorize(request(header), ["owner"]), { kind: "denied", reason: "invalid_credential" });
  }
  const duplicate = request("Bearer a.b.c");
  duplicate.headers.append("Authorization", "Bearer d.e.f");
  assert.deepEqual(await authorize(duplicate, ["owner"]), { kind: "denied", reason: "invalid_credential" });
  assert.equal(calls.length, 0);
});

test("real installed SDK verifies valid ES256 and RS256 Tauro user access tokens", async () => {
  for (const algorithm of ["ES256", "RS256"]) {
    const { authorize, calls } = harness();
    const result = await authorize(request(`Bearer ${jwt({}, algorithm)}`), ["owner", "supervisor"]);
    assert.deepEqual(result, { kind: "authorized", staff: { userId: USER_ID, role: "owner" } });
    assert.equal(calls.filter((call) => call.path === "/auth/v1/user").length, 0);
    assert.equal(calls.filter((call) => call.path === "/rest/v1/profiles").length, 1);
  }
});

test("real SDK rejects malformed, forged signature, expired and wrong-project JWTs before profile lookup", async () => {
  const valid = jwt();
  const components = valid.split(".");
  components[2] = Buffer.alloc(64, 0).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  for (const token of ["abc.def.ghi", components.join("."), jwt({ exp: now - 1 }), jwt({ iss: "https://differentprojectabcd.supabase.co/auth/v1" })]) {
    const { authorize, calls } = harness();
    assert.deepEqual(await authorize(request(`Bearer ${token}`), ["owner"]), { kind: "denied", reason: "invalid_credential" });
    assert.equal(calls.filter((call) => call.path === "/rest/v1/profiles").length, 0);
  }
});

test("verified claims must represent a current user Auth session, never an API key or arbitrary identity", async () => {
  const now = Math.floor(Date.now() / 1000);
  for (const overrides of [
    { sub: undefined }, { sub: "not-a-user-id" }, { sub: "" },
    { session_id: undefined }, { session_id: "not-a-session-id" },
    { aud: "anon" }, { aud: ["authenticated"] }, { role: "service_role" },
    { exp: String(now + 3600) }, { iat: now + 60 }, { nbf: now + 60 },
    { is_anonymous: true }, { iss: `${ENVIRONMENT.TAURO_PG_SUPABASE_URL}/auth/v1/` },
  ]) {
    const { authorize, calls } = harness();
    assert.deepEqual(await authorize(request(`Bearer ${jwt(overrides)}`), ["owner"]), { kind: "denied", reason: "invalid_credential" });
    assert.equal(calls.filter((call) => call.path === "/rest/v1/profiles").length, 0);
  }
});

test("legacy HS256 verification uses the configured project's Auth server and rejects a forged HMAC", async () => {
  const { authorize, calls } = harness();
  const valid = jwt({}, "HS256");
  assert.deepEqual(await authorize(request(`Bearer ${valid}`), ["owner"]), { kind: "authorized", staff: { userId: USER_ID, role: "owner" } });
  assert.equal(calls.find((call) => call.path === "/auth/v1/user")?.authorization, `Bearer ${valid}`);
  const [header, payload] = valid.split(".");
  assert.deepEqual(await authorize(request(`Bearer ${header}.${payload}.${Buffer.alloc(32).toString("base64url")}`), ["owner"]), { kind: "denied", reason: "invalid_credential" });
});

test("fresh authoritative profiles enforce active owner/supervisor operation roles", async () => {
  for (const role of ["owner", "supervisor"] as const) {
    const { authorize } = harness({ profileRows: [{ user_id: USER_ID, role, active: true }] });
    assert.deepEqual(await authorize(request(`Bearer ${jwt()}`), ["owner", "supervisor"]), { kind: "authorized", staff: { userId: USER_ID, role } });
    assert.deepEqual(await authorize(request(`Bearer ${jwt()}`), ["owner"]), role === "owner"
      ? { kind: "authorized", staff: { userId: USER_ID, role } }
      : { kind: "denied", reason: "forbidden_role" });
  }
});

test("profile absence, inactivity, unknown roles, malformed and duplicate results fail closed", async () => {
  const cases: Array<[unknown, PaintGuideStaffFailure]> = [
    [[], "profile_missing"],
    [[{ user_id: USER_ID, role: "owner", active: false }], "profile_inactive"],
    [[{ user_id: USER_ID, role: "supervisor", active: false }], "profile_inactive"],
    [[{ user_id: USER_ID, role: "admin", active: true }], "unauthorized_staff"],
    [[{ user_id: USER_ID, role: "OWNER", active: true }], "unauthorized_staff"],
    [[{ user_id: SESSION_ID, role: "owner", active: true }], "unauthorized_staff"],
    [[{ user_id: USER_ID, role: "owner", active: "true" }], "unauthorized_staff"],
    [[{ user_id: USER_ID }], "unauthorized_staff"],
    [[null], "profile_missing"],
    [[{ user_id: USER_ID, role: "owner", active: true }, { user_id: USER_ID, role: "supervisor", active: true }], "internal_failure"],
  ];
  for (const [profileRows, reason] of cases) {
    const { authorize } = harness({ profileRows });
    assert.deepEqual(await authorize(request(`Bearer ${jwt()}`), ["owner", "supervisor"]), { kind: "denied", reason });
  }
});

test("JWT metadata and request actor/role never grant staff authority; profiles are reread each time", async () => {
  const forged = jwt({ user_metadata: { role: "owner" }, app_metadata: { role: "owner" } });
  const { authorize, calls } = harness({ profileRows: [{ user_id: USER_ID, role: "supervisor", active: true }] });
  const maliciousRequest = new Request("https://www.tauropainting.com/api/paint-guide/staff/test?actor=owner", {
    method: "POST", headers: { Authorization: `Bearer ${forged}` },
    body: JSON.stringify({ actorId: SESSION_ID, role: "owner" }),
  });
  assert.deepEqual(await authorize(maliciousRequest, ["owner"]), { kind: "denied", reason: "forbidden_role" });
  assert.deepEqual(await authorize(maliciousRequest, ["owner", "supervisor"]), { kind: "authorized", staff: { userId: USER_ID, role: "supervisor" } });
  assert.equal(calls.filter((call) => call.path === "/rest/v1/profiles").length, 2);
});

test("empty and invalid operation allowlists deny access", async () => {
  const { authorize, calls } = harness();
  for (const roles of [[], ["admin"] as unknown as PaintGuideStaffRole[]]) {
    assert.deepEqual(await authorize(request(`Bearer ${jwt()}`), roles), { kind: "denied", reason: "forbidden_role" });
  }
  assert.equal(calls.length, 0);
});

test("Auth, profile, transport and configuration failures are safely classified without credentials or logs", async (context) => {
  const logged: unknown[][] = [];
  for (const method of ["log", "warn", "error", "debug", "info"] as const) context.mock.method(console, method, (...values: unknown[]) => { logged.push(values); });
  const token = jwt({}, "HS256");
  for (const [options, expected] of [
    [{ authStatus: 401 }, "invalid_credential"],
    [{ authStatus: 503 }, "internal_failure"],
    [{ profileStatus: 500, profileRows: { message: `private ${token} ${environment.supabaseSecretKey}` } }, "internal_failure"],
    [{ transportFailure: true }, "internal_failure"],
  ] as const) {
    const { authorize } = harness(options);
    const result = await authorize(request(`Bearer ${token}`), ["owner"]);
    assert.deepEqual(result, { kind: "denied", reason: expected });
    assert.equal(JSON.stringify(result).includes(token), false);
    assert.equal(JSON.stringify(result).includes(environment.supabaseSecretKey), false);
  }
  const broken = createPaintGuideStaffAuthorizer({ loadEnvironment: () => { throw new Error(`private ${token}`); } });
  assert.deepEqual(await broken(request(`Bearer ${token}`), ["owner"]), { kind: "denied", reason: "internal_failure" });
  assert.deepEqual(logged, []);
});

test("external failures hide profile/verification internals and retain mandatory privacy headers", async () => {
  for (const reason of ["unauthenticated", "invalid_credential", "unauthorized_staff", "profile_missing", "profile_inactive", "forbidden_role", "internal_failure"] as const) {
    const response = paintGuideStaffFailureResponse(reason);
    assert.equal(response.status, reason === "internal_failure" ? 503 : reason === "unauthenticated" || reason === "invalid_credential" ? 401 : 403);
    assert.deepEqual(await response.json(), { available: false });
    assert.equal(response.headers.get("cache-control"), "no-store, private");
    assert.equal(response.headers.get("cdn-cache-control"), "no-store");
    assert.equal(response.headers.get("vercel-cdn-cache-control"), "no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  }
});

test("browser source cannot import server modules; the new boundary adds no token logging/storage", () => {
  function inspectBrowser(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) inspectBrowser(file);
      else if (/\.[cm]?[jt]sx?$/.test(file)) {
        assert.doesNotMatch(readFileSync(file, "utf8"), /(?:from\s*|import\s*\(|require\s*\()\s*["'][^"']*(?:server\/paint-guide|server\\paint-guide)/);
      }
    }
  }
  inspectBrowser(path.resolve("src"));
  const source = readFileSync(path.resolve("server/paint-guide-staff/auth.ts"), "utf8");
  assert.doesNotMatch(source, /console\s*\.(?:log|warn|error|debug|info)\s*\(/);
  assert.doesNotMatch(source, /(?:localStorage|sessionStorage|setSession|getSession)\s*[.(]/);
});
