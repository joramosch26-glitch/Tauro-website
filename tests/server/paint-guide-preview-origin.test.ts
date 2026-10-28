import assert from "node:assert/strict";
import test from "node:test";
import {
  loadHomeownerServerEnvironment,
  PAINT_GUIDE_ISOLATED_PREVIEW_BRANCH,
  PAINT_GUIDE_ISOLATED_PREVIEW_HOST,
  PAINT_GUIDE_ISOLATED_PREVIEW_ORIGIN,
  PAINT_GUIDE_PHOTO_PREVIEW_BRANCH,
  PAINT_GUIDE_PHOTO_PREVIEW_HOST,
  PAINT_GUIDE_PHOTO_PREVIEW_ORIGIN,
} from "../../server/paint-guide-homeowner/env.js";
import { hasAllowedHomeownerOrigin } from "../../server/paint-guide-homeowner/origin.js";
import { validateBrowserServerAgreement } from "../../src/paint-guide/lib/environment.js";

const reference = "hgfgnfhfqqetxjhasbbe";
const key = Buffer.alloc(32, 7).toString("base64url");
const config = {
  VITE_SUPABASE_URL: `https://${reference}.supabase.co`,
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_key",
  VITE_TAURO_PG_EXPECTED_PROJECT_REF: reference,
  VITE_TAURO_PG_ENVIRONMENT: "preview",
  TAURO_PG_SUPABASE_URL: `https://${reference}.supabase.co`,
  TAURO_PG_EXPECTED_PROJECT_REF: reference,
  TAURO_PG_ENVIRONMENT: "preview",
  TAURO_PG_SUPABASE_SECRET_KEY: "synthetic_server_key",
  TAURO_PG_HOMEOWNER_ACCESS_ENABLED: "true",
  TAURO_PG_ALLOWED_ORIGINS: PAINT_GUIDE_ISOLATED_PREVIEW_ORIGIN,
  TAURO_PG_CUSTOMER_ACCESS_ENABLED: "false",
  TAURO_PG_PREVIEW_SYNTHETIC_RELEASE_ENABLED: "true",
  TAURO_PG_SYNTHETIC_RELEASE_GUIDE_ID: "b28d3dd5-eb34-46a2-99de-7af143de80db",
  TAURO_PG_SYNTHETIC_RELEASE_ACTOR_ID: "e8fa431f-ea5c-46fb-b92c-6d5d213531bc",
  TAURO_PG_TOKEN_LOOKUP_HMAC_ACTIVE_VERSION: "1",
  TAURO_PG_TOKEN_LOOKUP_HMAC_KEY_V1: key,
  TAURO_PG_TOKEN_ENCRYPTION_ACTIVE_VERSION: "1",
  TAURO_PG_TOKEN_ENCRYPTION_KEY_V1: key,
  TAURO_PG_SESSION_HMAC_ACTIVE_VERSION: "1",
  TAURO_PG_SESSION_HMAC_KEY_V1: key,
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_TARGET_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: PAINT_GUIDE_ISOLATED_PREVIEW_BRANCH,
  VERCEL_BRANCH_URL: PAINT_GUIDE_ISOLATED_PREVIEW_HOST,
};

test("isolated Preview allows only the exact dedicated branch origin", () => {
  assert.doesNotThrow(() => validateBrowserServerAgreement(config, true));
  const runtime = loadHomeownerServerEnvironment(config);
  assert.deepEqual([...runtime.allowedOrigins], [PAINT_GUIDE_ISOLATED_PREVIEW_ORIGIN]);
  assert.equal(hasAllowedHomeownerOrigin(new Request(PAINT_GUIDE_ISOLATED_PREVIEW_ORIGIN, {
    headers: { Origin: PAINT_GUIDE_ISOLATED_PREVIEW_ORIGIN },
  }), runtime), true);
  for (const origin of [
    `https://evil.${PAINT_GUIDE_ISOLATED_PREVIEW_HOST}`,
    "https://tauro-paint-guide-v1-qa.vercel.app",
    "https://another-deployment.vercel.app",
  ]) {
    assert.equal(hasAllowedHomeownerOrigin(new Request(PAINT_GUIDE_ISOLATED_PREVIEW_ORIGIN, {
      headers: { Origin: origin },
    }), runtime), false);
  }
});

test("isolated Preview fails closed for mismatched identity or broad origins", () => {
  const rejected = [
    { VERCEL_TARGET_ENV: undefined },
    { VERCEL_TARGET_ENV: "production" },
    { VERCEL_GIT_COMMIT_REF: "different-branch" },
    { VERCEL_BRANCH_URL: undefined },
    { VERCEL_BRANCH_URL: `deployment-${PAINT_GUIDE_ISOLATED_PREVIEW_HOST}` },
    { TAURO_PG_ALLOWED_ORIGINS: "https://*.vercel.app" },
    { TAURO_PG_ALLOWED_ORIGINS: `${PAINT_GUIDE_ISOLATED_PREVIEW_ORIGIN},https://other.example` },
  ];
  for (const overrides of rejected) {
    assert.throws(() => loadHomeownerServerEnvironment({ ...config, ...overrides }));
  }
});

test("photo-loading Preview accepts only its pinned branch, alias, project, and origin", () => {
  const candidate = {
    ...config,
    TAURO_PG_ALLOWED_ORIGINS: PAINT_GUIDE_PHOTO_PREVIEW_ORIGIN,
    VERCEL_GIT_COMMIT_REF: PAINT_GUIDE_PHOTO_PREVIEW_BRANCH,
    VERCEL_BRANCH_URL: PAINT_GUIDE_PHOTO_PREVIEW_HOST,
  };
  assert.doesNotThrow(() => loadHomeownerServerEnvironment(candidate));
  const runtime = loadHomeownerServerEnvironment(candidate);
  assert.deepEqual([...runtime.allowedOrigins], [PAINT_GUIDE_PHOTO_PREVIEW_ORIGIN]);
  assert.equal(hasAllowedHomeownerOrigin(new Request(PAINT_GUIDE_PHOTO_PREVIEW_ORIGIN, {
    headers: { Origin: PAINT_GUIDE_PHOTO_PREVIEW_ORIGIN },
  }), runtime), true);

  const rejected = [
    { VERCEL_GIT_COMMIT_REF: "codex/another-branch" },
    { VERCEL_BRANCH_URL: "tauro-paint-guide-v1-qa-git-other-jose-ramos-projects-4c64cbba.vercel.app" },
    { TAURO_PG_ALLOWED_ORIGINS: "https://another-preview.vercel.app" },
    { TAURO_PG_EXPECTED_PROJECT_REF: "abcdefghijklmnopqrst", VITE_TAURO_PG_EXPECTED_PROJECT_REF: "abcdefghijklmnopqrst",
      TAURO_PG_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co", VITE_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co" },
  ];
  for (const overrides of rejected) {
    assert.throws(() => loadHomeownerServerEnvironment({ ...candidate, ...overrides }));
  }
});

test("existing production origin policy does not depend on Preview branch markers", () => {
  const production: Record<string, string | undefined> = { ...config };
  production.VITE_TAURO_PG_ENVIRONMENT = "production";
  production.TAURO_PG_ENVIRONMENT = "production";
  production.TAURO_PG_ALLOWED_ORIGINS = "https://www.tauropainting.com";
  production.TAURO_PG_CUSTOMER_ACCESS_ENABLED = "true";
  production.VERCEL_ENV = "production";
  production.VERCEL_TARGET_ENV = "production";
  production.VERCEL_GIT_COMMIT_REF = PAINT_GUIDE_PHOTO_PREVIEW_BRANCH;
  production.VERCEL_BRANCH_URL = PAINT_GUIDE_PHOTO_PREVIEW_HOST;
  delete production.TAURO_PG_PREVIEW_SYNTHETIC_RELEASE_ENABLED;
  delete production.TAURO_PG_SYNTHETIC_RELEASE_GUIDE_ID;
  delete production.TAURO_PG_SYNTHETIC_RELEASE_ACTOR_ID;
  const runtime = loadHomeownerServerEnvironment(production);
  assert.deepEqual([...runtime.allowedOrigins], ["https://www.tauropainting.com"]);
});
