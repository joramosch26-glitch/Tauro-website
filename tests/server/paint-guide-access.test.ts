import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { byteaToPostgrest } from "../../server/paint-guide-homeowner/bytea.js";
import { loadHomeownerServerEnvironment } from "../../server/paint-guide-homeowner/env.js";
import { createPaintGuideStaffAuthorizer, createPaintGuideStaffClient } from "../../server/paint-guide-staff/auth.js";
import { canonicalStaffHomeownerOrigin, createStaffAccessHandler } from "../../server/paint-guide-staff/access.js";
import { callStaffAccessMaterial, callStaffAccessRevoke, callStaffAccessStatus, validateStaffAccessStatus,
  type StaffAccessOperation, type StaffAccessRpcClient } from "../../server/paint-guide-staff/access-rpc.js";

const GUIDE = "73000000-0000-4000-8000-000000000101";
const USER = "73000000-0000-4000-8000-000000000001";
const SESSION = "73000000-0000-4000-8000-000000000002";
const ORIGIN = "http://127.0.0.1:55400";
const PROJECT = "abcdefghijklmnopqrst";
const source = {
  TAURO_PG_SUPABASE_URL: `https://${PROJECT}.supabase.co`,
  TAURO_PG_SUPABASE_SECRET_KEY: "synthetic-staff-access-credential",
  TAURO_PG_EXPECTED_PROJECT_REF: PROJECT, TAURO_PG_ENVIRONMENT: "test",
  TAURO_PG_HOMEOWNER_ACCESS_ENABLED: "true", TAURO_PG_ALLOWED_ORIGINS: ORIGIN,
  TAURO_PG_TOKEN_LOOKUP_HMAC_ACTIVE_VERSION: "1", TAURO_PG_TOKEN_LOOKUP_HMAC_KEY_V1: Buffer.alloc(32, 51).toString("base64url"),
  TAURO_PG_TOKEN_ENCRYPTION_ACTIVE_VERSION: "1", TAURO_PG_TOKEN_ENCRYPTION_KEY_V1: Buffer.alloc(32, 52).toString("base64url"),
  TAURO_PG_SESSION_HMAC_ACTIVE_VERSION: "1", TAURO_PG_SESSION_HMAC_KEY_V1: Buffer.alloc(32, 53).toString("base64url"),
};
const environment = loadHomeownerServerEnvironment(source);
const EC = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = { ...EC.publicKey.export({ format: "jwk" }), alg: "ES256", kid: "staff-access-test", use: "sig" };
function jwt(overrides: Record<string, unknown> = {}, forged = false) {
  const now = Math.floor(Date.now() / 1000);
  const input = [ { typ: "JWT", alg: "ES256", kid: jwk.kid }, {
    iss: `${environment.supabaseUrl.origin}/auth/v1`, aud: "authenticated", role: "authenticated",
    sub: USER, session_id: SESSION, iat: now - 10, exp: now + 600, ...overrides,
  } ].map((v) => Buffer.from(JSON.stringify(v)).toString("base64url")).join(".");
  const signature = forged ? Buffer.alloc(64) : sign("sha256", Buffer.from(input), { key: EC.privateKey, dsaEncoding: "ieee-p1363" });
  return `${input}.${signature.toString("base64url")}`;
}
function request(operation: StaffAccessOperation, options: {
  method?: string; origin?: string; authorization?: string | null; contentType?: string; body?: string; headers?: Record<string, string>;
} = {}) {
  const method = options.method ?? "POST";
  return new Request(`http://127.0.0.1:55400/api/paint-guide/staff/access/${operation}`, {
    method, headers: { Origin: options.origin ?? ORIGIN, "Content-Type": options.contentType ?? "application/json",
      ...(options.authorization === null ? {} : { Authorization: options.authorization ?? `Bearer ${jwt()}` }), ...options.headers },
    ...(method === "GET" ? {} : { body: options.body ?? JSON.stringify({ guideId: GUIDE,
      ...(["rotate", "revoke"].includes(operation) ? { expectedTokenGeneration: 1, expectedSessionEpoch: 1 } : {}) }) }),
  });
}
function rawStatus(state = "absent", lifecycle = "draft", generation = 1, epoch = 1): Record<string, unknown> {
  return { guide_id: GUIDE, guide_status: lifecycle, access_state: state,
    token_generation: state === "absent" ? null : generation, session_epoch: state === "absent" ? null : epoch,
    homeowner_exchange_available: lifecycle === "published" && state === "active" };
}
function fixture(options: { role?: string; active?: boolean; missingProfile?: boolean; lifecycle?: string; accessState?: string } = {}) {
  let stored: Record<string, unknown> | null = null;
  let state = options.accessState ?? "absent";
  let lifecycle = options.lifecycle ?? "draft";
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const authClient = createPaintGuideStaffClient(environment, async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("jwks.json")) return Response.json({ keys: [jwk] });
    assert.equal(url.pathname, "/rest/v1/profiles");
    assert.equal(url.searchParams.get("user_id"), `eq.${USER}`);
    return Response.json(options.missingProfile ? [] : [{ user_id: USER, role: options.role ?? "owner", active: options.active ?? true }]);
  });
  const authorize = createPaintGuideStaffAuthorizer({ loadEnvironment: () => environment, createClient: () => authClient });
  const client: StaffAccessRpcClient = { async rpc(name, args) {
    calls.push({ name, args });
    assert.equal(args.p_guide_id, GUIDE);
    assert.equal(args.p_actor_id, USER);
    if (name.endsWith("_status")) return { data: rawStatus(state, lifecycle,
      Number(stored?.token_generation ?? 1), Number(stored?.session_epoch ?? 1)), error: null };
    if (name.endsWith("_rotate") || name.endsWith("_revoke")) {
      if (!stored) return { data: null, error: { code: "P0002" } };
      if (args.p_expected_token_generation !== stored.token_generation) return { data: null, error: { code: "40001" } };
      if (name.endsWith("_revoke") && state === "revoked") return { data: {
        outcome: "already_revoked", token_generation: stored.token_generation, session_epoch: stored.session_epoch }, error: null };
      if (args.p_expected_session_epoch !== stored.session_epoch) return { data: null, error: { code: "40001" } };
      stored.session_epoch = Number(stored.session_epoch) + 1;
      if (name.endsWith("_revoke")) {
        state = "revoked";
        return { data: { outcome: "revoked", token_generation: stored.token_generation, session_epoch: stored.session_epoch }, error: null };
      }
      stored = { guide_id: GUIDE, format_version: args.p_format_version,
        token_generation: Number(stored.token_generation) + 1, session_epoch: stored.session_epoch,
        lookup_key_version: args.p_lookup_key_version, token_hmac: args.p_token_hmac,
        encryption_key_version: args.p_encryption_key_version, token_ciphertext: args.p_token_ciphertext,
        encryption_nonce: args.p_encryption_nonce, encryption_tag: args.p_encryption_tag };
      state = "active";
      return { data: { outcome: "rotated", access: stored }, error: null };
    }
    if (name.endsWith("_issue")) {
      if (state === "revoked") return { data: { outcome: "revoked" }, error: null };
      const existed = stored !== null;
      if (!stored) stored = { guide_id: GUIDE, format_version: args.p_format_version,
        token_generation: 1, session_epoch: 1, lookup_key_version: args.p_lookup_key_version,
        token_hmac: args.p_token_hmac, encryption_key_version: args.p_encryption_key_version,
        token_ciphertext: args.p_token_ciphertext, encryption_nonce: args.p_encryption_nonce, encryption_tag: args.p_encryption_tag };
      state = "active";
      return { data: { outcome: existed ? "existing" : "issued", access: stored }, error: null };
    }
    assert.equal(name, "paint_guide_homeowner_access_recover");
    return { data: stored && state === "active" ? { outcome: "recovered", access: stored } : { outcome: "unavailable" }, error: null };
  } };
  function handler(operation: StaffAccessOperation, rpcClient = client) {
    return createStaffAccessHandler(operation, { authorize, loadEnvironment: () => environment,
      loadCryptoEnvironment: () => environment, createClient: () => rpcClient });
  }
  return { handler, calls, client, material: () => stored!, state: (s: string) => { state = s; }, lifecycle: (s: string) => { lifecycle = s; } };
}
async function safeFailure(response: Response, status: number) {
  assert.equal(response.status, status);
  assert.deepEqual(await response.json(), { available: false });
  assert.equal(response.headers.get("cache-control"), "no-store, private");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("cdn-cache-control"), "no-store");
  assert.equal(response.headers.get("vercel-cdn-cache-control"), "no-store");
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
}

for (const operation of ["status", "issue", "recover", "rotate", "revoke"] as const) {
  test(`${operation}: real staff verifier rejects missing/malformed/forged/wrong-project JWTs and inactive/missing profiles`, async () => {
    for (const authorization of [null, "Bearer malformed", `Bearer ${jwt({}, true)}`,
      `Bearer ${jwt({ iss: "https://wrongprojectabcdefghij.supabase.co/auth/v1" })}`]) {
      const f = fixture();
      await safeFailure(await f.handler(operation)(request(operation, { authorization })), 401);
      assert.equal(f.calls.length, 0);
    }
    for (const options of [{ active: false }, { missingProfile: true }, { role: "admin" }]) {
      const f = fixture(options);
      await safeFailure(await f.handler(operation)(request(operation)), 403);
      assert.equal(f.calls.length, 0);
    }
  });
  test(`${operation}: exact Origin, POST, content type, capped strict JSON/UUID and no caller actor/role`, async () => {
    const f = fixture();
    const cases: Array<[Parameters<typeof request>[1], number]> = [
      [{ origin: "https://wrong.example" }, 403], [{ origin: `${ORIGIN}/` }, 403], [{ method: "GET" }, 405],
      [{ contentType: "text/plain" }, 400], [{ contentType: "application/json; charset=utf-8" }, 400],
      [{ body: "{" }, 400], [{ body: "{}" }, 400], [{ body: "[]" }, 400], [{ body: "null" }, 400],
      [{ body: JSON.stringify({ guideId: "not-a-uuid" }) }, 400],
      [{ body: JSON.stringify({ guideId: GUIDE, actorId: USER }) }, 400],
      [{ body: JSON.stringify({ guideId: GUIDE, role: "owner" }) }, 400],
      [{ body: JSON.stringify({ guideId: GUIDE, extra: true }) }, 400],
      [{ body: " ".repeat(1025) }, 400], [{ headers: { "Content-Length": "1025" } }, 400],
      [{ headers: { "Content-Length": "invalid" } }, 400],
    ];
    for (const [options, status] of cases) await safeFailure(await f.handler(operation)(request(operation, options)), status);
    assert.equal(f.calls.length, 0);
  });
  test(`${operation}: operation-specific owner/supervisor authorization, verified actor used exclusively`, async () => {
    for (const role of ["owner", "supervisor"]) {
      const f = fixture({ role });
      if (["recover", "rotate", "revoke"].includes(operation)) assert.equal((await f.handler("issue")(request("issue"))).status, 200);
      const before = f.calls.length;
      const response = await f.handler(operation)(request(operation));
      if (["rotate", "revoke"].includes(operation) && role === "supervisor") {
        await safeFailure(response, 403); assert.equal(f.calls.length, before);
      } else assert.equal(response.status, 200);
      assert.ok(f.calls.every(c => c.args.p_actor_id === USER));
    }
  });
  test(`${operation}: missing guide, operational and malformed RPC results fail closed`, async () => {
    for (const [data, error, status] of [[null, null, 404], [undefined, null, 503],
      [rawStatus(), { message: "private DB error" }, 503], [{ ...rawStatus(), token_hmac: "private" }, null, 503]] as const) {
      const f = fixture();
      await safeFailure(await f.handler(operation, { rpc: async () => ({ data, error }) })(request(operation)), status);
    }
  });
}

test("status: lifecycle/access matrix is minimal, consistent and never includes private material", async () => {
  for (const lifecycle of ["draft", "published", "archived"]) for (const state of ["absent", "active", "revoked"]) {
    const f = fixture({ lifecycle, accessState: state });
    const response = await f.handler("status")(request("status"));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(Object.keys(data).sort(), ["guideId", "guideStatus", "accessState", "tokenGeneration", "sessionEpoch", "homeownerExchangeAvailable"].sort());
    assert.equal(data.homeownerExchangeAvailable, lifecycle === "published" && state === "active");
    assert.equal(data.accessState, state);
    assert.equal(data.guideStatus, lifecycle);
    assert.equal(data.tokenGeneration, state === "absent" ? null : 1);
  }
  for (const bad of [{ ...rawStatus(), guide_id: USER }, { ...rawStatus(), guide_status: ["draft"] },
    { ...rawStatus(), access_state: "unknown" }, { ...rawStatus(), token_generation: 1 },
    { ...rawStatus("active"), token_generation: Number.MAX_SAFE_INTEGER + 1 },
    { ...rawStatus("active"), session_epoch: 0 }, { ...rawStatus("active"), homeowner_exchange_available: true }]) {
    assert.equal(validateStaffAccessStatus(bad, GUIDE), null);
  }
});

for (const operation of ["rotate", "revoke"] as const) {
  test(`${operation}: exact required CAS fields, safe positive bigint-compatible integers, no extra fields`, async () => {
    const f = fixture();
    const body = { guideId: GUIDE, expectedTokenGeneration: 1, expectedSessionEpoch: 1 };
    const bodies: unknown[] = [
      { guideId: GUIDE }, { guideId: GUIDE, expectedTokenGeneration: 1 }, { guideId: GUIDE, expectedSessionEpoch: 1 },
      { ...body, role: "owner" }, { ...body, actorId: USER },
    ];
    for (const field of ["expectedTokenGeneration", "expectedSessionEpoch"]) for (const bad of
      [null, "1", true, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, 9223372036854775808]) bodies.push({ ...body, [field]: bad });
    bodies.push({ ...body, expectedSessionEpoch: Number.MAX_SAFE_INTEGER });
    if (operation === "rotate") bodies.push({ ...body, expectedTokenGeneration: Number.MAX_SAFE_INTEGER });
    for (const bad of bodies) await safeFailure(await f.handler(operation)(request(operation, { body: JSON.stringify(bad) })), 400);
    assert.equal(f.calls.length, 0);
  });

  test(`${operation}: stale generation/epoch cannot mutate, retry, or expose private material`, async () => {
    for (const field of ["expectedTokenGeneration", "expectedSessionEpoch"]) {
      const f = fixture(); await f.handler("issue")(request("issue"));
      const before = JSON.stringify(f.material());
      await safeFailure(await f.handler(operation)(request(operation, {
        body: JSON.stringify({ guideId: GUIDE, expectedTokenGeneration: 1, expectedSessionEpoch: 1, [field]: 2 }),
      })), 409);
      assert.equal(JSON.stringify(f.material()), before);
      assert.equal(f.calls.filter(c => c.name.endsWith(`_${operation}`)).length, 0);
    }
    for (const code of ["40001", "P0002", "42501", "XX000"]) {
      const f = fixture(); await f.handler("issue")(request("issue"));
      const client: StaffAccessRpcClient = { rpc: (name, args) => name.endsWith(`_${operation}`)
        ? Promise.resolve({ data: null, error: { code, message: "synthetic private database detail" } }) : f.client.rpc(name, args) };
      await safeFailure(await f.handler(operation, client)(request(operation)), code === "40001" ? 409 : code === "P0002" ? 404 : 503);
      assert.equal(JSON.stringify(f.material()).includes("synthetic private"), false);
    }
  });

  test(`${operation}: post-mutation race never returns stale successful credentials or status`, async () => {
    const f = fixture(); await f.handler("issue")(request("issue"));
    let statuses = 0;
    const client: StaffAccessRpcClient = { rpc: (name, args) => name.endsWith("_status") && ++statuses === 2
      ? Promise.resolve({ data: rawStatus("active", "published", 3, 3), error: null }) : f.client.rpc(name, args) };
    await safeFailure(await f.handler(operation, client)(request(operation)), 409);
    assert.equal(f.calls.filter(c => c.name.endsWith(`_${operation}`)).length, 1);
  });
}

test("rotate: fresh crypto, exact generation/epoch advances, stable recovery/issue and restoration after revoke", async () => {
  for (const lifecycle of ["draft", "published", "archived"]) {
    const f = fixture({ lifecycle });
    const first = await (await f.handler("issue")(request("issue"))).json();
    const old = { ...f.material() };
    const rotated = await f.handler("rotate")(request("rotate", { headers: { Host: "attacker.example" } }));
    assert.equal(rotated.status, 200);
    const data = await rotated.json();
    assert.notEqual(data.privateUrl, first.privateUrl);
    assert.equal(data.tokenGeneration, 2); assert.equal(data.sessionEpoch, 2);
    assert.equal(data.accessState, "active"); assert.equal(data.homeownerExchangeAvailable, lifecycle === "published");
    assert.notEqual(f.material().token_hmac, old.token_hmac); assert.notEqual(f.material().encryption_nonce, old.encryption_nonce);
    const url = new URL(data.privateUrl); assert.equal(url.origin, ORIGIN); assert.equal(url.search, ""); assert.match(url.hash, /^#tpgh1\.1\.[A-Za-z0-9_-]{43}$/);
    assert.deepEqual(Object.keys(data).sort(), ["guideId", "guideStatus", "accessState", "tokenGeneration", "sessionEpoch", "homeownerExchangeAvailable", "privateUrl"].sort());
    for (const op of ["issue", "recover"] as const) assert.equal((await (await f.handler(op)(request(op))).json()).privateUrl, data.privateUrl);
    const revoked = await f.handler("revoke")(request("revoke", { body: JSON.stringify({ guideId: GUIDE, expectedTokenGeneration: 2, expectedSessionEpoch: 2 }) }));
    assert.equal(revoked.status, 200);
    const restored = await f.handler("rotate")(request("rotate", { body: JSON.stringify({ guideId: GUIDE, expectedTokenGeneration: 2, expectedSessionEpoch: 3 }) }));
    assert.equal(restored.status, 200);
    const c = await restored.json(); assert.equal(c.accessState, "active"); assert.equal(c.tokenGeneration, 3); assert.equal(c.sessionEpoch, 4);
    assert.notEqual(c.privateUrl, data.privateUrl); assert.notEqual(c.privateUrl, first.privateUrl);
    const call = f.calls.find(c => c.name.endsWith("_rotate"))!;
    assert.deepEqual(Object.keys(call.args).sort(), ["p_guide_id", "p_actor_id", "p_expected_token_generation", "p_expected_session_epoch", "p_format_version", "p_lookup_key_version", "p_token_hmac", "p_encryption_key_version", "p_token_ciphertext", "p_encryption_nonce", "p_encryption_tag"].sort());
  }
});

test("revoke: no recovery/crypto, no URL, generation retained, epoch advances once and repeat is idempotent", async () => {
  const f = fixture(); await f.handler("issue")(request("issue"));
  const material = { ...f.material() };
  const handler = createStaffAccessHandler("revoke", { authorize: async () => ({ kind: "authorized", staff: { userId: USER, role: "owner" } }),
    loadEnvironment: () => environment, createClient: () => f.client,
    loadCryptoEnvironment: () => { throw Error("Revoke must not load crypto."); } });
  const response = await handler(request("revoke")); assert.equal(response.status, 200);
  const data = await response.json(); assert.equal(data.accessState, "revoked"); assert.equal(data.tokenGeneration, 1); assert.equal(data.sessionEpoch, 2);
  assert.deepEqual(Object.keys(data).sort(), ["guideId", "guideStatus", "accessState", "tokenGeneration", "sessionEpoch", "homeownerExchangeAvailable"].sort());
  for (const field of ["token_hmac", "token_ciphertext", "encryption_nonce", "encryption_tag"]) assert.equal(f.material()[field], material[field]);
  await safeFailure(await handler(request("revoke")), 409);
  const repeat = await handler(request("revoke", { body: JSON.stringify({ guideId: GUIDE, expectedTokenGeneration: 1, expectedSessionEpoch: 2 }) }));
  assert.equal(repeat.status, 200); assert.equal((await repeat.json()).sessionEpoch, 2);
  const cas = { expectedTokenGeneration: 1, expectedSessionEpoch: 1 };
  assert.deepEqual(await callStaffAccessRevoke(f.client, GUIDE, USER, cas), { kind: "conflict" });
  for (const op of ["issue", "recover"] as const) {
    const result = await f.handler(op)(request(op)); assert.equal(result.status, 409); assert.equal((await result.json()).privateUrl, undefined);
  }
  assert.deepEqual(Object.keys(f.calls.find(c => c.name.endsWith("_revoke"))!.args).sort(), ["p_guide_id", "p_actor_id", "p_expected_token_generation", "p_expected_session_epoch"].sort());
});

test("rotate/revoke: absent access, malformed mutation/crypto and transport failures fail closed without logging", async (context) => {
  const logs: unknown[][] = [];
  for (const name of ["log", "error", "warn", "debug", "info"] as const) context.mock.method(console, name, (...args: unknown[]) => { logs.push(args); });
  for (const operation of ["rotate", "revoke"] as const) {
    const absent = fixture(); await safeFailure(await absent.handler(operation)(request(operation)), 404);
    const f = fixture(); await f.handler("issue")(request("issue"));
    const malformed = [null, [], {}, { outcome: "revoked", token_generation: 1, session_epoch: 0 },
      { outcome: "revoked", token_generation: 1, session_epoch: 2, privateUrl: "private" },
      { outcome: "rotated", access: { ...f.material(), token_generation: 2, session_epoch: 2 } }];
    for (const data of malformed) {
      const client: StaffAccessRpcClient = { rpc: (name, args) => name.endsWith(`_${operation}`)
        ? Promise.resolve({ data, error: null }) : f.client.rpc(name, args) };
      await safeFailure(await f.handler(operation, client)(request(operation)), 503);
    }
    const thrown: StaffAccessRpcClient = { rpc: (name, args) => {
      if (name.endsWith(`_${operation}`)) throw Error("private transport"); return f.client.rpc(name, args);
    } };
    await safeFailure(await f.handler(operation, thrown)(request(operation)), 503);
  }
  const f = fixture(); await f.handler("issue")(request("issue"));
  const corrupt: StaffAccessRpcClient = { rpc: async (name, args) => {
    if (!name.endsWith("_rotate")) return f.client.rpc(name, args);
    const badArgs = { ...args, p_encryption_tag: byteaToPostgrest(Buffer.alloc(16)) };
    return f.client.rpc(name, badArgs);
  } };
  await safeFailure(await f.handler("rotate", corrupt)(request("rotate")), 503);
  assert.deepEqual(logs, []);
});

test("status requires no crypto keys; wrong-method response advertises POST", async () => {
  const f = fixture();
  const handler = createStaffAccessHandler("status", {
    authorize: async () => ({ kind: "authorized", staff: { userId: USER, role: "owner" } }),
    loadEnvironment: () => environment, createClient: () => f.client,
    loadCryptoEnvironment: () => { throw Error("Status must not request crypto material."); },
  });
  assert.equal((await handler(request("status"))).status, 200);
  const wrongMethod = await handler(request("status", { method: "GET" }));
  assert.equal(wrongMethod.headers.get("allow"), "POST");
  await safeFailure(wrongMethod, 405);
});

test("issue/recover: real AES/HMAC round trip, stable repeated issue/recovery and exact private fragment URL", async () => {
  for (const lifecycle of ["draft", "published", "archived"]) {
    const f = fixture({ lifecycle });
    const first = await (await f.handler("issue")(request("issue", { headers: { Host: "attacker.example" } }))).json();
    const materialBefore = JSON.stringify(f.material());
    for (const operation of ["issue", "recover", "recover"] as const) {
      const response = await f.handler(operation)(request(operation));
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.privateUrl, first.privateUrl);
      assert.equal(data.tokenGeneration, 1);
      assert.equal(data.sessionEpoch, 1);
      assert.equal(data.homeownerExchangeAvailable, lifecycle === "published");
      const url = new URL(data.privateUrl);
      assert.equal(url.origin, ORIGIN); assert.equal(url.pathname, "/paint-guide/p"); assert.equal(url.search, "");
      assert.match(url.hash, /^#tpgh1\.1\.[A-Za-z0-9_-]{43}$/);
      assert.deepEqual(Object.keys(data).sort(), ["guideId", "guideStatus", "accessState", "tokenGeneration", "sessionEpoch", "homeownerExchangeAvailable", "privateUrl"].sort());
    }
    assert.equal(JSON.stringify(f.material()), materialBefore);
    assert.ok(f.calls.every(c => !/session|rotate|revoke/.test(c.name)));
    assert.equal(f.calls.filter(c => c.name.endsWith("_recover")).length, 2);
  }
});

test("issue/recover: revoked is a safe conflict, absent recovery never issues", async () => {
  for (const operation of ["issue", "recover"] as const) {
    const f = fixture({ accessState: "revoked" });
    const response = await f.handler(operation)(request(operation));
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.accessState, "revoked"); assert.equal(body.privateUrl, undefined);
    assert.equal(f.calls.length, 1);
  }
  const f = fixture();
  await safeFailure(await f.handler("recover")(request("recover")), 404);
  assert.equal(f.calls.length, 1);
});

test("recover: corrupt recovery bytes, wrong HMAC/guide/format and unknown crypto versions never expose a URL", async () => {
  const f = fixture();
  assert.equal((await f.handler("issue")(request("issue"))).status, 200);
  for (const patch of [
    { encryption_tag: byteaToPostgrest(Buffer.alloc(16)) }, { encryption_nonce: "\\x01" },
    { token_ciphertext: "\\x01" }, { token_hmac: byteaToPostgrest(Buffer.alloc(32)) },
    { guide_id: USER }, { format_version: 2 }, { lookup_key_version: 2 }, { encryption_key_version: 2 },
    { token_generation: 0 }, { session_epoch: 0 }, { token_ciphertext: "\\XAA" },
  ]) {
    const client: StaffAccessRpcClient = { rpc: (name, args) => name.endsWith("_recover")
      ? Promise.resolve({ data: { outcome: "recovered", access: { ...f.material(), ...patch } }, error: null })
      : f.client.rpc(name, args) };
    await safeFailure(await f.handler("recover", client)(request("recover")), 503);
  }
});

test("issue/recover: concurrent revocation/CAS changes and mismatched environments fail closed", async () => {
  for (const operation of ["issue", "recover"] as const) {
    const f = fixture(); await f.handler("issue")(request("issue"));
    let statuses = 0;
    const client: StaffAccessRpcClient = { rpc: (name, args) => name.endsWith("_status") && ++statuses === 2
      ? Promise.resolve({ data: rawStatus("active", "published", 2, 2), error: null }) : f.client.rpc(name, args) };
    await safeFailure(await f.handler(operation, client)(request(operation)), 503);
  }
  const f = fixture();
  const handler = createStaffAccessHandler("issue", { authorize: async () => ({ kind: "authorized", staff: { userId: USER, role: "owner" } }),
    loadEnvironment: () => environment, loadCryptoEnvironment: () => ({ ...environment, expectedProjectRef: "differentprojectabcd" }),
    createClient: () => f.client });
  await safeFailure(await handler(request("issue")), 503);
  assert.equal(f.calls.length, 1);
});

test("issue: revocation between initial status and issue is handled without exposing credentials", async () => {
  const f = fixture(); await f.handler("issue")(request("issue"));
  const client: StaffAccessRpcClient = { rpc: async (name, args) => {
    if (name.endsWith("_issue")) { f.state("revoked"); return { data: { outcome: "revoked" }, error: null }; }
    return f.client.rpc(name, args);
  } };
  const response = await f.handler("issue", client)(request("issue"));
  assert.equal(response.status, 409);
  const data = await response.json(); assert.equal(data.accessState, "revoked"); assert.equal(data.privateUrl, undefined);
});

test("canonical origin: production fixed hostname, exact allowed nonproduction origin, no Host/unsafe HTTP", () => {
  const production = loadHomeownerServerEnvironment({ ...source, TAURO_PG_ENVIRONMENT: "production",
    TAURO_PG_ALLOWED_ORIGINS: "https://www.tauropainting.com,https://preview.example" });
  assert.equal(canonicalStaffHomeownerOrigin(request("issue", { origin: "https://preview.example", headers: { Host: "attacker.example" } }), production), "https://www.tauropainting.com");
  assert.equal(canonicalStaffHomeownerOrigin(request("issue"), environment), ORIGIN);
  assert.throws(() => canonicalStaffHomeownerOrigin(request("issue", { origin: "https://wrong.example" }), environment));
  const unsafe = { ...environment, allowedOrigins: new Set(["http://public.example"]) };
  assert.throws(() => canonicalStaffHomeownerOrigin(request("issue", { origin: "http://public.example" }), unsafe));
});

test("RPC contracts: exact arguments, strict outcomes and safe transport/configuration failures", async (context) => {
  const logs: unknown[][] = [];
  for (const name of ["log", "error", "warn", "debug", "info"] as const) context.mock.method(console, name, (...args: unknown[]) => { logs.push(args); });
  const bad: StaffAccessRpcClient = { rpc: async () => { throw new Error("synthetic private transport"); } };
  assert.deepEqual(await callStaffAccessStatus(bad, GUIDE, USER), { kind: "operational_failure" });
  for (const operation of ["issue", "recover"] as const) {
    assert.deepEqual(await callStaffAccessMaterial(bad, operation, environment, GUIDE, USER), { kind: "operational_failure" });
    for (const data of [undefined, null, [], { outcome: "recovered", access: null },
      { outcome: ["revoked"] }, { outcome: "unavailable", extra: true }]) {
      assert.deepEqual(await callStaffAccessMaterial({ rpc: async () => ({ data, error: null }) }, operation, environment, GUIDE, USER), { kind: "operational_failure" });
    }
  }
  assert.deepEqual(await callStaffAccessMaterial({ rpc: async () => ({ data: { outcome: "revoked" }, error: null }) }, "issue", environment, GUIDE, USER), { kind: "revoked" });
  assert.deepEqual(await callStaffAccessMaterial({ rpc: async () => ({ data: { outcome: "unavailable" }, error: null }) }, "recover", environment, GUIDE, USER), { kind: "unavailable" });
  await safeFailure(await createStaffAccessHandler("status", { loadEnvironment: () => { throw Error("private configuration"); } })(request("status")), 503);
  assert.deepEqual(logs, []);
});
