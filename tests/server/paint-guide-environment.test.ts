import assert from "node:assert/strict";
import test from "node:test";
import { loadBrowserConfiguration, validateBrowserBuild, validateBuildDeploymentMarkers, PaintGuideConfigurationError } from "../../src/paint-guide/lib/environment.js";
import { loadPaintGuideServerEnvironment } from "../../server/paint-guide-homeowner/env.js";
import { clearHomeownerSessionCookie, serializeHomeownerSessionCookie } from "../../server/paint-guide-homeowner/cookies.js";
import { createHomeownerSessionBearer } from "../../server/paint-guide-homeowner/sessions.js";
import { hasAllowedHomeownerOrigin } from "../../server/paint-guide-homeowner/origin.js";

const reference = "abcdefghijklmnopqrst";
const other = "tsrqponmlkjihgfedcba";
const url = `https://${reference}.supabase.co`;
const publicKey = "sb_publishable_synthetic_public_key_only";
const source = {
  VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: publicKey,
  VITE_TAURO_PG_EXPECTED_PROJECT_REF: reference, VITE_TAURO_PG_ENVIRONMENT: "preview",
  TAURO_PG_SUPABASE_URL: url, TAURO_PG_EXPECTED_PROJECT_REF: reference, TAURO_PG_ENVIRONMENT: "preview",
  TAURO_PG_SUPABASE_SECRET_KEY: "synthetic_backend_only_canary",
  TAURO_PG_HOMEOWNER_ACCESS_ENABLED: "true", TAURO_PG_ALLOWED_ORIGINS: "https://preview.example.test",
  VERCEL: "1", VERCEL_ENV: "preview",
};
function jwt(role = "anon", ref: string | undefined = reference) {
  return [ { alg: "HS256", typ: "JWT" }, { role, ref } ].map((value) => Buffer.from(JSON.stringify(value)).toString("base64url")).join(".") + ".synthetic_signature";
}

test("local marketing build and browser stay disabled with missing configuration", () => {
  assert.equal(validateBrowserBuild({}), null);
  assert.equal(loadBrowserConfiguration({}), null);
  assert.throws(() => loadPaintGuideServerEnvironment({}));
});

test("matching preview and production config reaches real browser/build/server validators", () => {
  for (const environment of ["preview", "production"]) {
    const config = { ...source, VERCEL_ENV: environment, TAURO_PG_ENVIRONMENT: environment,
      VITE_TAURO_PG_ENVIRONMENT: environment, TAURO_PG_ALLOWED_ORIGINS: "https://www.tauropainting.com" };
    assert.equal(validateBrowserBuild(config)?.reference, reference);
    assert.equal(loadPaintGuideServerEnvironment(config).expectedProjectRef, reference);
    assert.equal(loadBrowserConfiguration(config)?.key, publicKey);
  }
});

test("project, URL and environment disagreements fail at build and server startup", async (t) => {
  const cases = [
    { VITE_TAURO_PG_EXPECTED_PROJECT_REF: other },
    { TAURO_PG_EXPECTED_PROJECT_REF: other },
    { VITE_SUPABASE_URL: `https://${other}.supabase.co` },
    { TAURO_PG_SUPABASE_URL: `https://${other}.supabase.co` },
    { VITE_TAURO_PG_ENVIRONMENT: "production" },
    { TAURO_PG_ENVIRONMENT: "production" },
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
    { VERCEL_ENV: "test" }, { VERCEL_ENV: "production" }, { VERCEL_ENV: " preview " },
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

test("dotenv cannot introduce or override Vercel platform identity", () => {
  assert.doesNotThrow(() => validateBuildDeploymentMarkers({}, {}));
  assert.doesNotThrow(() => validateBuildDeploymentMarkers(source, source));
  assert.throws(() => validateBuildDeploymentMarkers({ VERCEL: "1", VERCEL_ENV: "production" }, {}));
  assert.throws(() => validateBuildDeploymentMarkers({ VERCEL_ENV: "production" }, { VERCEL_ENV: "preview" }));
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

test("HTTPS cookies are Secure and HttpOnly in every environment, including clearing", () => {
  for (const environment of ["development", "test", "preview", "production"]) {
    const config = { ...source, VERCEL: undefined, VERCEL_ENV: undefined,
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
