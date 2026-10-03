import assert from "node:assert/strict";
import test from "node:test";
import { byteaFromPostgrest, byteaToPostgrest } from "../../server/paint-guide-homeowner/bytea.js";
import {
  createHomeownerAccessToken,
  decryptHomeownerAccessToken,
  deriveLookupHmac,
  encryptHomeownerAccessToken,
  parseHomeownerAccessToken,
} from "../../server/paint-guide-homeowner/crypto.js";
import { loadHomeownerServerEnvironment } from "../../server/paint-guide-homeowner/env.js";
import {
  createHomeownerSessionBearer,
  deriveSessionHmac,
  parseHomeownerSessionBearer,
} from "../../server/paint-guide-homeowner/sessions.js";
import type { EnvironmentSource, VersionedKeyring } from "../../server/paint-guide-homeowner/types.js";

const PROJECT_REF = "abcdefghijklmnopqrst";
const GUIDE_ID = "71000000-0000-4000-8000-000000000101";

function key(byte: number) {
  return Buffer.alloc(32, byte).toString("base64url");
}

function environment(overrides: EnvironmentSource = {}): EnvironmentSource {
  return {
    TAURO_PG_SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`,
    TAURO_PG_SUPABASE_SECRET_KEY: key(9),
    TAURO_PG_EXPECTED_PROJECT_REF: PROJECT_REF,
    TAURO_PG_ENVIRONMENT: "test",
    TAURO_PG_HOMEOWNER_ACCESS_ENABLED: "true",
    TAURO_PG_ALLOWED_ORIGINS: "http://127.0.0.1:3000",
    TAURO_PG_TOKEN_LOOKUP_HMAC_ACTIVE_VERSION: "2",
    TAURO_PG_TOKEN_LOOKUP_HMAC_KEY_V1: key(1),
    TAURO_PG_TOKEN_LOOKUP_HMAC_KEY_V2: key(2),
    TAURO_PG_TOKEN_ENCRYPTION_ACTIVE_VERSION: "1",
    TAURO_PG_TOKEN_ENCRYPTION_KEY_V1: key(3),
    TAURO_PG_SESSION_HMAC_ACTIVE_VERSION: "1",
    TAURO_PG_SESSION_HMAC_KEY_V1: key(4),
    ...overrides,
  };
}

function keyring(activeVersion: number, ...entries: Array<[number, number]>): VersionedKeyring {
  return {
    activeVersion,
    keys: new Map(entries.map(([version, byte]) => [version, Buffer.alloc(32, byte)])),
  };
}

const aadContext = {
  environment: "test" as const,
  expectedProjectRef: PROJECT_REF,
  guideId: GUIDE_ID,
  formatVersion: 1,
  encryptionKeyVersion: 1,
};

test("keyrings require canonical versions, active keys, and exact 32-byte material", () => {
  const valid = loadHomeownerServerEnvironment(environment());
  assert.equal(valid.tokenLookupHmacKeys.activeVersion, 2);
  assert.equal(valid.tokenLookupHmacKeys.keys.size, 2);

  assert.throws(() => loadHomeownerServerEnvironment(environment({
    TAURO_PG_SUPABASE_URL: `https://user:password@${PROJECT_REF}.supabase.co`,
  })));
  assert.throws(() => loadHomeownerServerEnvironment(environment({
    TAURO_PG_SUPABASE_URL: `https://${PROJECT_REF}.supabase.co:443`,
  })));
  assert.throws(() => loadHomeownerServerEnvironment(environment({
    TAURO_PG_TOKEN_LOOKUP_HMAC_ACTIVE_VERSION: "02",
  })));
  assert.throws(() => loadHomeownerServerEnvironment(environment({
    TAURO_PG_TOKEN_LOOKUP_HMAC_ACTIVE_VERSION: " 1 ",
  })));
  assert.throws(() => loadHomeownerServerEnvironment(environment({
    TAURO_PG_TOKEN_LOOKUP_HMAC_ACTIVE_VERSION: "3",
  })));
  assert.throws(() => loadHomeownerServerEnvironment(environment({
    TAURO_PG_TOKEN_LOOKUP_HMAC_KEY_V01: key(5),
  })));
  assert.throws(() => loadHomeownerServerEnvironment(environment({
    TAURO_PG_TOKEN_ENCRYPTION_KEY_V1: "not_base64url*",
  })));
  assert.throws(() => loadHomeownerServerEnvironment(environment({
    TAURO_PG_TOKEN_ENCRYPTION_KEY_V1: ` ${key(3)} `,
  })));
  assert.throws(() => loadHomeownerServerEnvironment(environment({
    TAURO_PG_SESSION_HMAC_KEY_V1: Buffer.alloc(31, 4).toString("base64url"),
  })));
  assert.throws(() => loadHomeownerServerEnvironment(environment({
    TAURO_PG_HOMEOWNER_ACCESS_ENABLED: " true ",
  })));
});

test("access bearer is canonical, version-routed, and contains 256 bits of randomness", () => {
  const token = createHomeownerAccessToken(2);
  const parsed = parseHomeownerAccessToken(token.canonical);
  assert.equal(token.secret.length, 32);
  assert.equal(parsed.lookupKeyVersion, 2);
  assert.deepEqual(parsed.secret, token.secret);
  assert.equal(parsed.canonical, token.canonical);
  assert.throws(() => parseHomeownerAccessToken(`${token.canonical}=`));
  assert.throws(() => parseHomeownerAccessToken(token.canonical.replace(".2.", ".02.")));
  assert.throws(() => parseHomeownerAccessToken(token.canonical.replace(".2.", ".0.")));
  assert.throws(() => parseHomeownerAccessToken(token.canonical.replace(".2.", ".-1.")));
  assert.throws(() => parseHomeownerAccessToken(token.canonical.replace(".2.", ".32768.")));
  assert.throws(() => parseHomeownerAccessToken("tpgh1.1.not/base64"));
});

test("lookup HMAC is domain-separated, deterministic, and 32 bytes", () => {
  const token = createHomeownerAccessToken(1);
  const ring = keyring(1, [1, 1]);
  const same = deriveLookupHmac(token, PROJECT_REF, ring);
  assert.deepEqual(same, deriveLookupHmac(token, PROJECT_REF, ring));
  assert.equal(same.length, 32);
  assert.notDeepEqual(same, deriveLookupHmac(createHomeownerAccessToken(1), PROJECT_REF, ring));
  assert.notDeepEqual(same, deriveLookupHmac(token, "bcdefghijklmnopqrstu", ring));
  assert.notDeepEqual(same, deriveLookupHmac(token, PROJECT_REF, keyring(1, [1, 9])));
});

test("AES-256-GCM authenticates canonical access tokens", () => {
  const token = createHomeownerAccessToken(1);
  const ring = keyring(1, [1, 3]);
  const encrypted = encryptHomeownerAccessToken(token, aadContext, ring);
  assert.equal(encrypted.nonce.length, 12);
  assert.equal(encrypted.tag.length, 16);
  assert.ok(encrypted.ciphertext.length > 0);
  assert.equal(decryptHomeownerAccessToken(encrypted, aadContext, ring).canonical, token.canonical);
  assert.notDeepEqual(encrypted.nonce, encryptHomeownerAccessToken(token, aadContext, ring).nonce);

  const corruptedCiphertext = { ...encrypted, ciphertext: Buffer.from(encrypted.ciphertext) };
  corruptedCiphertext.ciphertext[0] ^= 1;
  assert.throws(() => decryptHomeownerAccessToken(corruptedCiphertext, aadContext, ring));
  const corruptedTag = { ...encrypted, tag: Buffer.from(encrypted.tag) };
  corruptedTag.tag[0] ^= 1;
  assert.throws(() => decryptHomeownerAccessToken(corruptedTag, aadContext, ring));
  assert.throws(() => decryptHomeownerAccessToken(encrypted, { ...aadContext, guideId: "71000000-0000-4000-8000-000000000102" }, ring));
  assert.throws(() => decryptHomeownerAccessToken(encrypted, aadContext, keyring(1, [1, 7])));
});

test("session bearer is canonical, version-routed, and HMAC-backed", () => {
  const bearer = createHomeownerSessionBearer(1);
  const parsed = parseHomeownerSessionBearer(bearer.canonical);
  assert.equal(bearer.secret.length, 32);
  assert.deepEqual(parsed.secret, bearer.secret);
  const ring = keyring(1, [1, 4]);
  const hmac = deriveSessionHmac(bearer, PROJECT_REF, ring);
  assert.equal(hmac.length, 32);
  assert.deepEqual(hmac, deriveSessionHmac(bearer, PROJECT_REF, ring));
  assert.notDeepEqual(hmac, deriveSessionHmac(bearer, "bcdefghijklmnopqrstu", ring));
  assert.notDeepEqual(hmac, deriveSessionHmac(bearer, PROJECT_REF, keyring(1, [1, 8])));
  assert.throws(() => parseHomeownerSessionBearer(`${bearer.canonical}=`));
  assert.throws(() => parseHomeownerSessionBearer(bearer.canonical.replace(".1.", ".01.")));
});

test("bytea uses canonical lowercase PostgreSQL hex", () => {
  const bytes = Buffer.from([0, 15, 16, 255]);
  const encoded = byteaToPostgrest(bytes);
  assert.equal(encoded, "\\x000f10ff");
  assert.deepEqual(byteaFromPostgrest(encoded), bytes);
  assert.throws(() => byteaFromPostgrest("\\x000F"));
  assert.throws(() => byteaFromPostgrest("000f"));
  assert.throws(() => byteaFromPostgrest("\\x0"));
});

test("configuration errors never echo secret material", () => {
  const secret = "very-secret-material";
  assert.throws(
    () => loadHomeownerServerEnvironment(environment({ TAURO_PG_TOKEN_ENCRYPTION_KEY_V1: secret })),
    (error: unknown) => error instanceof Error && !error.message.includes(secret),
  );
});
