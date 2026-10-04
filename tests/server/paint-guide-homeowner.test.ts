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
import {
  HOMEOWNER_SESSION_TTL_SECONDS,
  createHomeownerExchangeHandler,
} from "../../server/paint-guide-homeowner/exchange.js";
import { loadHomeownerServerEnvironment } from "../../server/paint-guide-homeowner/env.js";
import {
  HOMEOWNER_SESSION_COOKIE_NAME,
  clearHomeownerSessionCookie,
  readHomeownerSessionCookie,
  serializeHomeownerSessionCookie,
} from "../../server/paint-guide-homeowner/cookies.js";
import { createHomeownerDocumentHandler } from "../../server/paint-guide-homeowner/document-handler.js";
import { createHomeownerEndSessionHandler } from "../../server/paint-guide-homeowner/end-session.js";
import {
  validateHomeownerGuideDocument,
  type HomeownerGuideDocumentData,
} from "../../server/paint-guide-homeowner/document.js";
import {
  callHomeownerDocumentRead,
  callHomeownerSessionEnd,
  callHomeownerSessionExchange,
  type HomeownerDocumentReadInput,
  type HomeownerSessionEndInput,
  type HomeownerSessionExchangeInput,
} from "../../server/paint-guide-homeowner/rpc.js";
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

const serverEnvironment = loadHomeownerServerEnvironment(environment());

function exchangeRequest(
  body: string,
  options: {
    method?: string;
    origin?: string | null;
    contentType?: string | null;
    contentLength?: string | null;
  } = {},
) {
  const headers = new Headers();
  if (options.origin !== null) {
    headers.set("Origin", options.origin ?? "http://127.0.0.1:3000");
  }
  if (options.contentType !== null) {
    headers.set("Content-Type", options.contentType ?? "application/json");
  }
  if (options.contentLength !== null && options.contentLength !== undefined) {
    headers.set("Content-Length", options.contentLength);
  }

  return new Request("https://www.tauropainting.com/api/paint-guide/homeowner/exchange", {
    method: options.method ?? "POST",
    headers,
    body: options.method === "GET" ? undefined : body,
  });
}

async function unavailableSignature(response: Response) {
  return { status: response.status, body: await response.text() };
}

const documentFixture: HomeownerGuideDocumentData = {
  guide: { residence_name: "Homeowner test residence", primary_scope_note: null },
  locations: [{ id: "71000000-0000-4000-8000-000000000101", parent_id: null, name: "Exterior", sort_order: 0, created_at: "2026-10-03T12:00:00.000Z" }],
  records: [{ id: "71000000-0000-4000-8000-000000000102", section: "primary", surface: "Siding", brand: "Tauro", product: null, color_name: "White", color_code: null, sheen: null, notes: null, sort_order: 0, created_at: "2026-10-03T12:00:00.000Z" }],
  assignments: [{ paint_record_id: "71000000-0000-4000-8000-000000000102", location_id: "71000000-0000-4000-8000-000000000101" }],
};

function documentRequest(cookie?: string, method = "GET") {
  const headers = new Headers();
  if (cookie !== undefined) headers.set("Cookie", cookie);
  return new Request("https://www.tauropainting.com/api/paint-guide/homeowner/document", { method, headers });
}

function endSessionRequest(
  cookie?: string,
  options: { method?: string; origin?: string | null } = {},
) {
  const headers = new Headers();
  if (options.origin !== null) headers.set("Origin", options.origin ?? "http://127.0.0.1:3000");
  if (cookie !== undefined) headers.set("Cookie", cookie);
  return new Request("https://www.tauropainting.com/api/paint-guide/homeowner/end-session", {
    method: options.method ?? "POST",
    headers,
  });
}

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

test("exchange validates a strict request, creates a session, and stores only canonical RPC material", async () => {
  const access = createHomeownerAccessToken(2);
  const issuedAt = new Date("2026-10-03T12:00:00.000Z");
  let captured: HomeownerSessionExchangeInput | undefined;
  const handler = createHomeownerExchangeHandler({
    loadEnvironment: () => serverEnvironment,
    now: () => issuedAt,
    exchangeSession: async (_environment, input) => {
      captured = input;
      return { kind: "exchanged" };
    },
  });

  const response = await handler(exchangeRequest(JSON.stringify({ token: access.canonical })));
  assert.equal(response.status, 204);
  assert.ok(captured);
  assert.equal(captured.lookupKeyVersion, 2);
  assert.deepEqual(
    captured.tokenHmac,
    deriveLookupHmac(access, PROJECT_REF, serverEnvironment.tokenLookupHmacKeys),
  );
  assert.equal(captured.sessionKeyVersion, serverEnvironment.sessionHmacKeys.activeVersion);
  assert.equal(captured.sessionHmac.length, 32);
  assert.equal(captured.expiresAt.getTime(), issuedAt.getTime() + HOMEOWNER_SESSION_TTL_SECONDS * 1000);

  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie);
  assert.match(setCookie, new RegExp(`^${HOMEOWNER_SESSION_COOKIE_NAME}=tpgs1\\.`));
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(setCookie, /Path=\/api\/paint-guide\/homeowner/);
  assert.match(setCookie, /Max-Age=1740/);
  assert.doesNotMatch(setCookie, /Domain=/);
  assert.doesNotMatch(setCookie, /Secure/);
  assert.equal(setCookie.includes(access.canonical), false);

  const sessionBearer = setCookie.split(";", 1)[0].split("=", 2)[1];
  const session = parseHomeownerSessionBearer(sessionBearer);
  assert.deepEqual(
    captured.sessionHmac,
    deriveSessionHmac(session, PROJECT_REF, serverEnvironment.sessionHmacKeys),
  );
  const responseContents = `${await response.text()} ${Array.from(response.headers.entries()).join(" ")}`;
  assert.equal(responseContents.includes(access.canonical), false);
  assert.equal(responseContents.includes(captured.tokenHmac.toString("hex")), false);
  assert.equal(responseContents.includes(serverEnvironment.supabaseSecretKey), false);
});

test("exchange rejects malformed and unavailable inputs with one external response shape", async () => {
  const access = createHomeownerAccessToken(2);
  const handler = createHomeownerExchangeHandler({
    loadEnvironment: () => serverEnvironment,
    exchangeSession: async () => ({ kind: "unavailable" }),
  });

  const malformed = await handler(exchangeRequest(JSON.stringify({ token: `${access.canonical} ` })));
  const unknown = await handler(exchangeRequest(JSON.stringify({ token: access.canonical })));
  assert.deepEqual(await unavailableSignature(malformed), await unavailableSignature(unknown));
  assert.match(malformed.headers.get("set-cookie") ?? "", /Max-Age=0/);
  assert.doesNotMatch(malformed.headers.get("set-cookie") ?? "", /=tpgs1\./);

  const baseline = await unavailableSignature(await handler(exchangeRequest("{}")));
  for (const request of [
    exchangeRequest(JSON.stringify({ token: access.canonical }), { method: "GET" }),
    exchangeRequest(JSON.stringify({ token: access.canonical }), { origin: null }),
    exchangeRequest(JSON.stringify({ token: access.canonical }), { origin: "https://evil.example" }),
    exchangeRequest(JSON.stringify({ token: access.canonical }), { contentType: "text/plain" }),
    exchangeRequest("{"),
    exchangeRequest("x".repeat(1025)),
    exchangeRequest(JSON.stringify({ token: access.canonical, extra: true })),
  ]) {
    assert.deepEqual(await unavailableSignature(await handler(request)), baseline);
  }

  const throwingHandler = createHomeownerExchangeHandler({
    loadEnvironment: () => serverEnvironment,
    exchangeSession: async () => {
      throw new Error("database unavailable");
    },
  });
  assert.deepEqual(
    await unavailableSignature(await throwingHandler(exchangeRequest(JSON.stringify({ token: access.canonical })))),
    baseline,
  );
  const invalidConfigurationHandler = createHomeownerExchangeHandler({
    loadEnvironment: () => {
      throw new Error("invalid configuration");
    },
  });
  assert.deepEqual(
    await unavailableSignature(await invalidConfigurationHandler(exchangeRequest(JSON.stringify({ token: access.canonical })))),
    baseline,
  );
});

test("exchange RPC adapter uses canonical bytea and accepts only the exact success shape", async () => {
  const input: HomeownerSessionExchangeInput = {
    lookupKeyVersion: 2,
    tokenHmac: Buffer.alloc(32, 1),
    sessionKeyVersion: 1,
    sessionHmac: Buffer.alloc(32, 2),
    expiresAt: new Date("2026-10-03T12:29:00.000Z"),
  };
  let functionName = "";
  let arguments_: Record<string, unknown> = {};
  const result = await callHomeownerSessionExchange({
    rpc: async (name, values) => {
      functionName = name;
      arguments_ = values;
      return { data: { expires_at: input.expiresAt.toISOString() }, error: null };
    },
  }, input);
  assert.deepEqual(result, { kind: "exchanged" });
  assert.equal(functionName, "paint_guide_homeowner_session_exchange");
  assert.equal(arguments_.p_token_hmac, `\\x${"01".repeat(32)}`);
  assert.equal(arguments_.p_session_hmac, `\\x${"02".repeat(32)}`);

  const unavailable = await callHomeownerSessionExchange({
    rpc: async () => ({ data: { expires_at: input.expiresAt.toISOString(), extra: true }, error: null }),
  }, input);
  assert.deepEqual(unavailable, { kind: "unavailable" });
});

test("session cookie uses the fixed secure production policy without retaining access material", () => {
  const session = createHomeownerSessionBearer(1);
  const localCookie = serializeHomeownerSessionCookie(session.canonical, serverEnvironment);
  const productionCookie = serializeHomeownerSessionCookie(session.canonical, {
    ...serverEnvironment,
    environment: "production",
  });
  assert.doesNotMatch(localCookie, /Secure/);
  assert.match(productionCookie, /Secure/);
  assert.equal(localCookie.includes("tpgh1."), false);
});

test("document cookie reader requires exactly one syntactically valid homeowner cookie", () => {
  const session = createHomeownerSessionBearer(1);
  assert.equal(readHomeownerSessionCookie(documentRequest()), null);
  assert.equal(readHomeownerSessionCookie(documentRequest("other=value")), null);
  assert.equal(readHomeownerSessionCookie(documentRequest(`${HOMEOWNER_SESSION_COOKIE_NAME}=${session.canonical}`)), session.canonical);
  assert.equal(readHomeownerSessionCookie(documentRequest(`other=value; ${HOMEOWNER_SESSION_COOKIE_NAME}=${session.canonical}`)), session.canonical);
  assert.equal(readHomeownerSessionCookie(documentRequest(`${HOMEOWNER_SESSION_COOKIE_NAME}=${session.canonical}; ${HOMEOWNER_SESSION_COOKIE_NAME}=${session.canonical}`)), null);
  assert.equal(readHomeownerSessionCookie(documentRequest("not-a-cookie")), null);
});

test("document handler returns only a validated DTO and never refreshes the session", async () => {
  const session = createHomeownerSessionBearer(1);
  let captured: HomeownerDocumentReadInput | undefined;
  const handler = createHomeownerDocumentHandler({
    loadEnvironment: () => serverEnvironment,
    readDocument: async (_environment, input) => {
      captured = input;
      return { kind: "document", document: documentFixture };
    },
  });
  const response = await handler(documentRequest(`${HOMEOWNER_SESSION_COOKIE_NAME}=${session.canonical}`));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), documentFixture);
  assert.equal(response.headers.get("cache-control"), "no-store, private");
  assert.equal(response.headers.get("cdn-cache-control"), "no-store");
  assert.equal(response.headers.get("vercel-cdn-cache-control"), "no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("set-cookie"), null);
  assert.ok(captured);
  assert.equal(captured.sessionKeyVersion, 1);
  assert.equal(captured.sessionHmac.length, 32);
  assert.deepEqual(captured.sessionHmac, deriveSessionHmac(session, PROJECT_REF, serverEnvironment.sessionHmacKeys));
});

test("document DTO accepts PostgreSQL UUID lexical forms without version or variant narrowing", () => {
  const validDocument = { schema_version: 1, ...documentFixture };
  assert.ok(validateHomeownerGuideDocument(validDocument));
  assert.ok(validateHomeownerGuideDocument({
    ...validDocument,
    locations: [{ ...documentFixture.locations[0], id: "71000000-0000-6000-0000-000000000101" }],
  }));
  assert.ok(validateHomeownerGuideDocument({
    ...validDocument,
    locations: [{ ...documentFixture.locations[0], id: "71000000-0000-4000-0000-000000000101" }],
  }));
  assert.equal(validateHomeownerGuideDocument({
    ...validDocument,
    locations: [{ ...documentFixture.locations[0], id: "71000000-0000-6000-0000-00000000010z" }],
  }), null);
  assert.equal(validateHomeownerGuideDocument({
    ...validDocument,
    locations: [{ ...documentFixture.locations[0], id: "71000000-0000-6000-000000000101" }],
  }), null);
});

test("document handler and RPC adapter fail closed for unavailable, malformed, and unexpected data", async () => {
  const session = createHomeownerSessionBearer(1);
  const handler = createHomeownerDocumentHandler({
    loadEnvironment: () => serverEnvironment,
    readDocument: async () => ({ kind: "unavailable" }),
  });
  const baseline = await unavailableSignature(await handler(documentRequest()));
  for (const request of [
    documentRequest(`other=value; ${HOMEOWNER_SESSION_COOKIE_NAME}=${session.canonical}; ${HOMEOWNER_SESSION_COOKIE_NAME}=${session.canonical}`),
    documentRequest(`${HOMEOWNER_SESSION_COOKIE_NAME}=tpgs1.01.invalid`),
    documentRequest(`${HOMEOWNER_SESSION_COOKIE_NAME}=${session.canonical}`, "POST"),
  ]) {
    const response = await handler(request);
    assert.deepEqual(await unavailableSignature(response), baseline);
    if (request.method === "GET") assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
  }
  const missingKeyHandler = createHomeownerDocumentHandler({
    loadEnvironment: () => ({
      ...serverEnvironment,
      sessionHmacKeys: { activeVersion: 2, keys: new Map([[2, Buffer.alloc(32, 7)]]) },
    }),
  });
  assert.deepEqual(
    await unavailableSignature(await missingKeyHandler(documentRequest(`${HOMEOWNER_SESSION_COOKIE_NAME}=${session.canonical}`))),
    baseline,
  );
  const input: HomeownerDocumentReadInput = { sessionKeyVersion: 1, sessionHmac: Buffer.alloc(32, 9) };
  let name = "";
  let values: Record<string, unknown> = {};
  const rpcDocument = { schema_version: 1, ...documentFixture };
  const accepted = await callHomeownerDocumentRead({ rpc: async (functionName, arguments_) => {
    name = functionName; values = arguments_; return { data: rpcDocument, error: null };
  } }, input);
  assert.deepEqual(accepted, { kind: "document", document: documentFixture });
  assert.equal(name, "paint_guide_homeowner_document_read");
  assert.deepEqual(values, { p_session_key_version: 1, p_session_hmac: `\\x${"09".repeat(32)}` });
  for (const data of [
    null,
    [],
    "unexpected",
    { schema_version: 1, ...documentFixture, token_hmac: "forbidden" },
    { schema_version: 1, ...documentFixture, guide: { ...documentFixture.guide, role: "forbidden" } },
  ]) {
    assert.deepEqual(await callHomeownerDocumentRead({ rpc: async () => ({ data, error: null }) }, input), { kind: "unavailable" });
  }
  assert.match(clearHomeownerSessionCookie({ ...serverEnvironment, environment: "production" }), /Max-Age=0.*SameSite=Strict.*Secure/);
});

test("end-session rejects invalid protocol and treats absent or malformed cookies as idempotent", async () => {
  const session = createHomeownerSessionBearer(1);
  const handler = createHomeownerEndSessionHandler({
    loadEnvironment: () => serverEnvironment,
    endSession: async () => ({ kind: "ended" }),
  });
  const unavailable = await unavailableSignature(await handler(endSessionRequest(undefined, { method: "GET" })));
  for (const request of [
    endSessionRequest(undefined, { origin: null }),
    endSessionRequest(undefined, { origin: "https://evil.example" }),
  ]) {
    assert.deepEqual(await unavailableSignature(await handler(request)), unavailable);
  }

  for (const cookie of [
    undefined,
    "other=value",
    `${HOMEOWNER_SESSION_COOKIE_NAME}=invalid`,
    `${HOMEOWNER_SESSION_COOKIE_NAME}=${session.canonical}; ${HOMEOWNER_SESSION_COOKIE_NAME}=${session.canonical}`,
  ]) {
    const response = await handler(endSessionRequest(cookie));
    assert.equal(response.status, 204);
    assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0.*HttpOnly.*SameSite=Strict/);
  }
});

test("end-session derives only a session HMAC, persists through the exact RPC, and clears the cookie", async () => {
  const session = createHomeownerSessionBearer(1);
  let captured: HomeownerSessionEndInput | undefined;
  const handler = createHomeownerEndSessionHandler({
    loadEnvironment: () => serverEnvironment,
    endSession: async (_environment, input) => {
      captured = input;
      return { kind: "ended" };
    },
  });
  const response = await handler(endSessionRequest(`${HOMEOWNER_SESSION_COOKIE_NAME}=${session.canonical}`));
  assert.equal(response.status, 204);
  assert.ok(captured);
  assert.equal(captured.sessionKeyVersion, 1);
  assert.deepEqual(captured.sessionHmac, deriveSessionHmac(session, PROJECT_REF, serverEnvironment.sessionHmacKeys));
  const contents = `${await response.text()} ${Array.from(response.headers.entries()).join(" ")}`;
  assert.equal(contents.includes(session.canonical), false);
  assert.equal(contents.includes(captured.sessionHmac.toString("hex")), false);
  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);

  const input: HomeownerSessionEndInput = { sessionKeyVersion: 1, sessionHmac: Buffer.alloc(32, 9) };
  let name = "";
  let values: Record<string, unknown> = {};
  assert.deepEqual(await callHomeownerSessionEnd({ rpc: async (functionName, arguments_) => {
    name = functionName; values = arguments_; return { data: true, error: null };
  } }, input), { kind: "ended" });
  assert.equal(name, "paint_guide_homeowner_session_end");
  assert.deepEqual(values, { p_session_key_version: 1, p_session_hmac: `\\x${"09".repeat(32)}` });
  for (const responseValue of [false, null, { ended: true }]) {
    assert.deepEqual(await callHomeownerSessionEnd({ rpc: async () => ({ data: responseValue, error: null }) }, input), { kind: "operational_failure" });
  }
});

test("end-session reports operational failures generically while clearing the browser cookie", async () => {
  const session = createHomeownerSessionBearer(1);
  const rpcFailure = createHomeownerEndSessionHandler({
    loadEnvironment: () => serverEnvironment,
    endSession: async () => ({ kind: "operational_failure" }),
  });
  const missingKey = createHomeownerEndSessionHandler({
    loadEnvironment: () => ({
      ...serverEnvironment,
      sessionHmacKeys: { activeVersion: 2, keys: new Map([[2, Buffer.alloc(32, 7)]]) },
    }),
  });
  for (const handler of [rpcFailure, missingKey]) {
    const response = await handler(endSessionRequest(`${HOMEOWNER_SESSION_COOKIE_NAME}=${session.canonical}`));
    assert.equal(response.status, 503);
    assert.equal(await response.text(), '{"available":false}');
    assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
    assert.equal(response.headers.get("cache-control"), "no-store, private");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  }
});
