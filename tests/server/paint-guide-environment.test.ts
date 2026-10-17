import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, loadEnv } from "vite";
import { loadBrowserRuntimeConfiguration, loadBrowserConfiguration, validateBrowserBuild, validateBuildDiagnostics, PAINT_GUIDE_BUILD_ENV_PREFIXES, PaintGuideConfigurationError } from "../../src/paint-guide/lib/environment.js";
import { loadHomeownerServerEnvironment, loadPaintGuideServerEnvironment } from "../../server/paint-guide-homeowner/env.js";
import { clearHomeownerSessionCookie, serializeHomeownerSessionCookie } from "../../server/paint-guide-homeowner/cookies.js";
import { createHomeownerSessionBearer } from "../../server/paint-guide-homeowner/sessions.js";
import { hasAllowedHomeownerOrigin } from "../../server/paint-guide-homeowner/origin.js";

import { createStaffAccessHandler } from "../../server/paint-guide-staff/access.js";
import { createPaintGuideStaffAuthorizer } from "../../server/paint-guide-staff/auth.js";
import { createHomeownerAccessToken } from "../../server/paint-guide-homeowner/crypto.js";
import { createHomeownerExchangeHandler } from "../../server/paint-guide-homeowner/exchange.js";
import { createHomeownerDocumentHandler } from "../../server/paint-guide-homeowner/document-handler.js";
import { createHomeownerEndSessionHandler } from "../../server/paint-guide-homeowner/end-session.js";

const reference = "abcdefghijklmnopqrst";
const other = "tsrqponmlkjihgfedcba";
const url = `https://${reference}.supabase.co`;
const publicKey = "sb_publishable_synthetic_public_key_only";
const source = {
  VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: publicKey,
  VITE_TAURO_PG_EXPECTED_PROJECT_REF: reference, VITE_TAURO_PG_ENVIRONMENT: "production",
  TAURO_PG_SUPABASE_URL: url, TAURO_PG_EXPECTED_PROJECT_REF: reference, TAURO_PG_ENVIRONMENT: "production",
  TAURO_PG_SUPABASE_SECRET_KEY: "synthetic_backend_only_canary",
  TAURO_PG_HOMEOWNER_ACCESS_ENABLED: "true", TAURO_PG_ALLOWED_ORIGINS: "https://www.tauropainting.com",
  TAURO_PG_CUSTOMER_ACCESS_ENABLED: "true", // Legacy canonical behavior fixture; release-gate tests exercise false.
  VERCEL: "1", VERCEL_ENV: "production",
};
function jwt(role = "anon", ref: string | undefined = reference) {
  return [ { alg: "HS256", typ: "JWT" }, { role, ref } ].map((value) => Buffer.from(JSON.stringify(value)).toString("base64url")).join(".") + ".synthetic_signature";
}

test("local marketing build and browser stay disabled with missing configuration", () => {
  assert.equal(validateBrowserBuild({}), null);
  assert.equal(loadBrowserConfiguration({}), null);
  assert.throws(() => loadPaintGuideServerEnvironment({}));
});

test("same project supports preview builds and production runtime; preview runtime is disabled", () => {
  for (const environment of ["preview", "production"]) {
    const config = { ...source, VERCEL_ENV: environment, TAURO_PG_ENVIRONMENT: environment,
      VITE_TAURO_PG_ENVIRONMENT: environment, TAURO_PG_ALLOWED_ORIGINS: "https://www.tauropainting.com" };
    assert.equal(validateBrowserBuild(config)?.reference, reference);
    if (environment === "preview") {
      assert.equal(loadBrowserRuntimeConfiguration(config), null);
      assert.throws(() => loadPaintGuideServerEnvironment(config));
    } else {
      assert.equal(loadBrowserRuntimeConfiguration(config)?.reference, reference);
      assert.equal(loadPaintGuideServerEnvironment(config).expectedProjectRef, reference);
    }
    assert.equal(loadBrowserConfiguration(config)?.key, publicKey);
  }
});

test("project, URL and environment disagreements fail at build and server startup", async (t) => {
  const cases = [
    { VITE_TAURO_PG_EXPECTED_PROJECT_REF: other },
    { TAURO_PG_EXPECTED_PROJECT_REF: other },
    { VITE_SUPABASE_URL: `https://${other}.supabase.co` },
    { TAURO_PG_SUPABASE_URL: `https://${other}.supabase.co` },
    { VITE_TAURO_PG_ENVIRONMENT: "preview" },
    { TAURO_PG_ENVIRONMENT: "preview" },
    { VITE_TAURO_PG_ENVIRONMENT: "" },
    { VITE_SUPABASE_PUBLISHABLE_KEY: "" },
    { VITE_TAURO_PG_EXPECTED_PROJECT_REF: "" },
  ];
  for (const [index, overrides] of cases.entries()) await t.test(`mismatch ${index}`, () => {
    assert.throws(() => validateBrowserBuild({ ...source, ...overrides }));
    assert.throws(() => loadPaintGuideServerEnvironment({ ...source, ...overrides }));
  });
});

test("Vercel markers must both be present and match the configured environment", async (t) => {
  for (const [index, overrides] of [
    { VERCEL: undefined }, { VERCEL_ENV: undefined }, { VERCEL: "0" },
    { VERCEL_ENV: "test" }, { VERCEL_ENV: "preview" }, { VERCEL_ENV: " preview " },
  ].entries()) await t.test(`platform ${index}`, () => {
    assert.throws(() => validateBrowserBuild({ ...source, ...overrides }));
    assert.throws(() => loadPaintGuideServerEnvironment({ ...source, ...overrides }));
  });
  assert.throws(() => validateBrowserBuild({ VERCEL: "1", VERCEL_ENV: "production" }));
  const serverOnly = Object.fromEntries(Object.entries(source).filter(([name]) => !name.startsWith("VITE_")));
  assert.throws(() => loadPaintGuideServerEnvironment(serverOnly));
});

test("URL validation rejects normalization tricks, credentials, paths and non-Tauro destinations", async (t) => {
  const invalid = [ `https://${reference}.supabase.co:443`, `https://user@${reference}.supabase.co`,
    `https://${reference}.supabase.co/path`, `https://${reference}.supabase.co/?x=1`,
    `https://${reference}.supabase.co/#x`, `https://${reference.toUpperCase()}.supabase.co`,
    `https://${reference}.supabase.co/../`, `https://${reference}.supabase.co?`,
    "https://example.test", "http://127.1:55321", "http://2130706433:55321", "http://127.0.0.1:99999",
    "http://localhost.evil.test:55321", "http://localhost:80", "http://localhost:055321", " http://localhost:55321" ];
  for (const [index, value] of invalid.entries()) await t.test(`URL ${index}`, () => {
    assert.throws(() => loadBrowserConfiguration({ ...source, VITE_SUPABASE_URL: value }));
    assert.throws(() => loadPaintGuideServerEnvironment({ ...source, TAURO_PG_SUPABASE_URL: value }));
  });
});

test("development/test accepts exact loopback URLs; preview/production reject them", () => {
  for (const environment of ["development", "test", "preview", "production"]) {
    const config = { ...source, VERCEL: undefined, VERCEL_ENV: undefined,
      VITE_TAURO_PG_ENVIRONMENT: environment, TAURO_PG_ENVIRONMENT: environment,
      VITE_SUPABASE_URL: "http://127.0.0.1:55321", TAURO_PG_SUPABASE_URL: "http://127.0.0.1:55321/",
      TAURO_PG_ALLOWED_ORIGINS: "http://127.0.0.1:55400" };
    if (environment === "development" || environment === "test") {
      assert.equal(validateBrowserBuild(config)?.url.port, "55321");
      assert.equal(loadPaintGuideServerEnvironment(config).supabaseUrl.port, "55321");
      assert.doesNotMatch(clearHomeownerSessionCookie({ ...loadPaintGuideServerEnvironment(config),
        tokenLookupHmacKeys: emptyKeys, tokenEncryptionKeys: emptyKeys, sessionHmacKeys: emptyKeys }), /Secure/);
    } else {
      assert.throws(() => validateBrowserBuild(config));
      assert.throws(() => loadPaintGuideServerEnvironment(config));
    }
  }
});
const emptyKeys = { activeVersion: 1, keys: new Map<number, Buffer>() };

test("actual Vite env loading excludes server credentials and dotenv platform identity", () => {
  const directory = mkdtempSync(join(tmpdir(), "tauro-p0c-env-test-"));
  try {
    writeFileSync(join(directory, ".env"), [
      "VITE_TAURO_PG_ENVIRONMENT=preview", "TAURO_PG_ENVIRONMENT=preview",
      "VERCEL=1", "VERCEL_ENV=production", "VERCEL_TOKEN=synthetic_only",
      "TAURO_PG_SUPABASE_SECRET_KEY=synthetic_only",
      "TAURO_PG_TOKEN_ENCRYPTION_KEY_V1=synthetic_only",
      "TAURO_PG_TOKEN_LOOKUP_HMAC_KEY_V1=synthetic_only",
      "TAURO_PG_SESSION_HMAC_KEY_V1=synthetic_only",
    ].join("\n"));
    const loaded = loadEnv("production", directory, [...PAINT_GUIDE_BUILD_ENV_PREFIXES]);
    for (const name of ["VERCEL", "VERCEL_ENV", "VERCEL_TOKEN", "TAURO_PG_SUPABASE_SECRET_KEY",
      "TAURO_PG_TOKEN_ENCRYPTION_KEY_V1", "TAURO_PG_TOKEN_LOOKUP_HMAC_KEY_V1", "TAURO_PG_SESSION_HMAC_KEY_V1"]) {
      assert.equal(loaded[name], undefined);
    }
    assert.equal(loaded.VITE_TAURO_PG_ENVIRONMENT, "preview");
    assert.equal(loaded.TAURO_PG_ENVIRONMENT, "preview");
    assert.doesNotThrow(() => validateBrowserBuild({ ...source, VERCEL_ENV: "preview", ...loaded }));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("env diagnostics fail before loading dotenv contents without revealing any values", () => {
  for (const DEBUG of ["vite:env", "vite:*", "*", "v*:*", "other,vite:env", "vite:*,-vite:env"]) {
    assert.throws(() => validateBuildDiagnostics({ DEBUG }), (error: unknown) => {
      assert.ok(error instanceof PaintGuideConfigurationError);
      assert.equal(error.message, "Paint Guide configuration is unavailable.");
      return true;
    });
  }
  for (const DEBUG of [undefined, "", "other:*", "vite:config", "-vite:env"]) {
    assert.doesNotThrow(() => validateBuildDiagnostics({ DEBUG }));
  }
});

test("publishable and project-bound legacy anon keys are accepted; privileged and malformed keys rejected", () => {
  assert.equal(loadBrowserConfiguration({ ...source, VITE_SUPABASE_PUBLISHABLE_KEY: jwt() })?.key, jwt());
  for (const key of ["sb_secret_synthetic_only", jwt("service_role"), jwt("authenticated"), jwt("anon", other),
    "not-a-key", "sb_publishable_", " " + publicKey, publicKey + " ", "abc.def.ghi"]) {
    assert.throws(() => loadBrowserConfiguration({ ...source, VITE_SUPABASE_PUBLISHABLE_KEY: key }));
  }
  assert.equal(loadBrowserConfiguration({ ...source, VITE_SUPABASE_URL: "http://localhost:55321",
    VITE_TAURO_PG_ENVIRONMENT: "development", VITE_SUPABASE_PUBLISHABLE_KEY: jwt("anon", undefined) })?.url.hostname, "localhost");
});

test("Vite rejects privileged values in other public variables without disclosing values", () => {
  for (const overrides of [{ VITE_OTHER: "sb_secret_synthetic_only" }, { VITE_OTHER: jwt("service_role") },
    { VITE_SESSION_HMAC_KEY: "synthetic_only" }]) {
    assert.throws(() => validateBrowserBuild({ ...source, ...overrides }), (error: unknown) => {
      assert.ok(error instanceof PaintGuideConfigurationError);
      assert.equal(error.message, "Paint Guide configuration is unavailable.");
      return true;
    });
  }
});

test("HTTPS cookies remain Secure and HttpOnly in enabled environments, including clearing", () => {
  for (const environment of ["development", "test", "production"]) {
    const config = { ...source, VERCEL: undefined, VERCEL_ENV: undefined,
      TAURO_PG_SUPABASE_URL: environment === "production" ? url : "http://127.0.0.1:55321",
      VITE_SUPABASE_URL: environment === "production" ? url : "http://127.0.0.1:55321",
      TAURO_PG_ENVIRONMENT: environment, VITE_TAURO_PG_ENVIRONMENT: environment,
      TAURO_PG_ALLOWED_ORIGINS: "https://www.tauropainting.com" };
    const loaded = { ...loadPaintGuideServerEnvironment(config), tokenLookupHmacKeys: emptyKeys,
      tokenEncryptionKeys: emptyKeys, sessionHmacKeys: emptyKeys };
    for (const cookie of [serializeHomeownerSessionCookie(createHomeownerSessionBearer(1).canonical, loaded), clearHomeownerSessionCookie(loaded)]) {
      assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/); assert.match(cookie, /; Secure/);
    }
  }
});

test("unsafe or mixed origins fail closed; forwarded/host headers cannot authorize origins", () => {
  for (const origins of ["http://public.example.test", "http://127.0.0.1:55400", "https://preview.example.test,http://127.0.0.1:55400"]) {
    assert.throws(() => loadPaintGuideServerEnvironment({ ...source, TAURO_PG_ALLOWED_ORIGINS: origins }));
  }
  const environment = loadPaintGuideServerEnvironment(source);
  assert.equal(hasAllowedHomeownerOrigin(new Request("https://preview.example.test", { headers: {
    Origin: "https://attacker.example.test", Host: "preview.example.test", "x-forwarded-host": "preview.example.test",
    "x-forwarded-proto": "https", "x-vercel-env": "production" } }), environment), false);
});

test("development/test reject hosted databases in browser, build and server", () => {
  for (const environment of ["development", "test"]) {
    const config = { ...source, VERCEL: undefined, VERCEL_ENV: undefined,
      VITE_TAURO_PG_ENVIRONMENT: environment, TAURO_PG_ENVIRONMENT: environment };
    assert.throws(() => loadBrowserRuntimeConfiguration(config));
    assert.throws(() => validateBrowserBuild(config));
    assert.throws(() => loadPaintGuideServerEnvironment(config));
    const local = { ...config, VITE_SUPABASE_URL: "http://127.0.0.1:55321",
      TAURO_PG_SUPABASE_URL: "http://127.0.0.1:55321" };
    assert.equal(loadBrowserRuntimeConfiguration(local)?.environment, environment);
    assert.equal(loadPaintGuideServerEnvironment(local).environment, environment);
  }
});

test("preview denies every access endpoint and homeowner handler before authorization or RPC", async () => {
  const preview = { ...source, VERCEL_ENV: "preview", TAURO_PG_ENVIRONMENT: "preview",
    VITE_TAURO_PG_ENVIRONMENT: "preview", TAURO_PG_ALLOWED_ORIGINS: "https://preview.example.test",
    TAURO_PG_TOKEN_LOOKUP_HMAC_ACTIVE_VERSION: "1", TAURO_PG_TOKEN_LOOKUP_HMAC_KEY_V1: Buffer.alloc(32, 1).toString("base64url"),
    TAURO_PG_TOKEN_ENCRYPTION_ACTIVE_VERSION: "1", TAURO_PG_TOKEN_ENCRYPTION_KEY_V1: Buffer.alloc(32, 2).toString("base64url"),
    TAURO_PG_SESSION_HMAC_ACTIVE_VERSION: "1", TAURO_PG_SESSION_HMAC_KEY_V1: Buffer.alloc(32, 3).toString("base64url"),
  };
  assert.equal(loadHomeownerServerEnvironment({ ...preview, VERCEL_ENV: "production",
    TAURO_PG_ENVIRONMENT: "production", VITE_TAURO_PG_ENVIRONMENT: "production",
    TAURO_PG_ALLOWED_ORIGINS: "https://www.tauropainting.com" }).environment, "production");
  const syntaxValidBearer = [{ typ: "JWT", alg: "ES256" }, { sub: "73000000-0000-4000-8000-000000000001" }]
    .map(value => Buffer.from(JSON.stringify(value)).toString("base64url")).join(".") + "." + Buffer.alloc(64).toString("base64url");
  let calls = 0;
  const unexpected = () => { calls++; throw new Error("Unexpected backend access."); };
  const loadEnvironment = () => loadPaintGuideServerEnvironment(preview);
  const loadCryptoEnvironment = () => loadHomeownerServerEnvironment(preview);
  for (const operation of ["status", "issue", "recover", "rotate", "revoke"] as const) {
    const handler = createStaffAccessHandler(operation, { loadEnvironment,
      loadCryptoEnvironment, authorize: unexpected, createClient: unexpected });
    const response = await handler(new Request("https://preview.example.test/api/paint-guide/staff/access/" + operation, {
      method: "POST", headers: { Origin: "https://preview.example.test", "Content-Type": "application/json",
        Authorization: "Bearer synthetic.credential.signature" },
      body: JSON.stringify({ guideId: "73000000-0000-4000-8000-000000000101", expectedTokenGeneration: 1, expectedSessionEpoch: 1 }),
    }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { available: false });
  }
  let authorizationEnvironmentCalls = 0;
  const authorize = createPaintGuideStaffAuthorizer({ loadEnvironment: () => { authorizationEnvironmentCalls++; return loadEnvironment(); }, createClient: unexpected });
  assert.equal((await authorize(new Request("https://preview.example.test", {
    headers: { Authorization: "Bearer " + syntaxValidBearer } }), ["owner"])).kind, "denied");
  assert.equal(authorizationEnvironmentCalls, 1);
  const session = createHomeownerSessionBearer(1).canonical;
  const headers = { Origin: "https://preview.example.test", "Content-Type": "application/json",
    Cookie: "tauro_paint_guide_session=" + session };
  const handlers = [
    [createHomeownerExchangeHandler({ loadEnvironment: loadCryptoEnvironment, exchangeSession: unexpected }), "POST", JSON.stringify({ token: createHomeownerAccessToken(1).canonical })],
    [createHomeownerDocumentHandler({ loadEnvironment: loadCryptoEnvironment, readDocument: unexpected }), "GET", undefined],
    [createHomeownerEndSessionHandler({ loadEnvironment: loadCryptoEnvironment, endSession: unexpected }), "POST", undefined],
  ] as const;
  for (const [handler, method, body] of handlers) {
    const response = await handler(new Request("https://preview.example.test/api/paint-guide/homeowner/test", { method, headers, body }));
    assert.notEqual(response.status, 200);
    assert.notEqual(response.status, 204);
    assert.equal(response.headers.get("Set-Cookie"), null);
  }
  assert.equal(calls, 0);
});


test("actual browser SDK adapter disables Preview and keeps Production enabled", async () => {
  for (const environment of ["preview", "production"]) {
    const browserValues = { ...source, VITE_TAURO_PG_ENVIRONMENT: environment };
    const define = Object.fromEntries(Object.entries(browserValues)
      .filter(([name]) => name.startsWith("VITE_"))
      .map(([name, value]) => ["import.meta.env." + name, JSON.stringify(value)]));
    const server = await createServer({ configFile: false, envFile: false,
      define, server: { middlewareMode: true, watch: null } });
    try {
      const adapter = await server.ssrLoadModule("/src/paint-guide/lib/supabase.ts");
      assert.equal(adapter.isSupabaseConfigured, environment === "production");
      if (environment === "preview") assert.equal(adapter.supabase, null);
      else {
        assert.ok(adapter.supabase);
        await adapter.supabase.auth.stopAutoRefresh();
      }
    } finally { await server.close(); }
  }
});
