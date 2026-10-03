import { createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const docker = process.env.TAURO_DOCKER_CLI || "docker";
const dbContainer = "supabase_db_tauro-paint-guide";
const authContainer = "supabase_auth_tauro-paint-guide";
const localApiUrl = "http://127.0.0.1:55321";
const actorId = "72000000-0000-4000-8000-000000000001";
const publishedGuideId = "72000000-0000-4000-8000-000000000101";
const draftGuideId = "72000000-0000-4000-8000-000000000102";
const projectRef = "abcdefghijklmnopqrst";
const origin = "http://127.0.0.1:3000";
let stage = "startup";

function fail() {
  throw new Error("Tauro local exchange contract probe failed.");
}

function runDocker(args, input) {
  const result = spawnSync(docker, args, { encoding: "utf8", input, windowsHide: true });
  if (result.error || result.status !== 0) fail();
  return result.stdout.trim();
}

function assertTauroContainer(name) {
  const running = runDocker(["ps", "--filter", `name=^/${name}$`, "--format", "{{.Names}}"]);
  if (running !== name) fail();
  const project = runDocker(["inspect", "--format", "{{index .Config.Labels \"com.supabase.cli.project\"}}", name]);
  if (project !== "tauro-paint-guide") fail();
}

function executeSql(sql) {
  return runDocker(
    ["exec", "-i", dbContainer, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
    sql,
  );
}

function encodeBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function localServiceRoleToken() {
  const secret = runDocker(["exec", authContainer, "sh", "-lc", "printf %s \"$GOTRUE_JWT_SECRET\""]);
  if (!secret) fail();
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encodeBase64Url(JSON.stringify({
    aud: "authenticated",
    exp: now + 60,
    iat: now,
    iss: "supabase-demo",
    role: "service_role",
  }));
  const signingInput = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

const cleanupSql = `
begin;
delete from public.paint_guides where id in ('${publishedGuideId}'::uuid, '${draftGuideId}'::uuid);
delete from auth.users where id = '${actorId}'::uuid;
commit;
`;

const setupSql = `
begin;
delete from public.paint_guides where id in ('${publishedGuideId}'::uuid, '${draftGuideId}'::uuid);
delete from auth.users where id = '${actorId}'::uuid;
insert into auth.users (id, aud, role, email) values
  ('${actorId}'::uuid, 'authenticated', 'authenticated', 'tauro-exchange-probe@example.test');
insert into public.profiles (user_id, role, active) values
  ('${actorId}'::uuid, 'owner', true);
insert into public.paint_guides (id, residence_name, status) values
  ('${publishedGuideId}'::uuid, 'Tauro exchange published fixture', 'published'),
  ('${draftGuideId}'::uuid, 'Tauro exchange draft fixture', 'draft');
commit;
`;

async function postRpc(name, body, serviceRoleToken) {
  const response = await fetch(`${localApiUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleToken,
      authorization: `Bearer ${serviceRoleToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) fail();
  return response.json();
}

function requestFor(token) {
  return new Request("https://www.tauropainting.com/api/paint-guide/homeowner/exchange", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

function sessionFromResponse(response, parseHomeownerSessionBearer) {
  if (response.status !== 204) fail();
  const cookie = response.headers.get("set-cookie");
  if (!cookie || !cookie.includes("HttpOnly") || !cookie.includes("SameSite=Strict")) fail();
  const bearer = cookie.split(";", 1)[0].split("=", 2)[1];
  return parseHomeownerSessionBearer(bearer);
}

async function assertUnavailable(handler, token) {
  const response = await handler(requestFor(token));
  if (response.status !== 404 || (await response.text()) !== '{"available":false}') fail();
  const cookie = response.headers.get("set-cookie");
  if (cookie && !cookie.includes("Max-Age=0")) fail();
}

async function main() {
  assertTauroContainer(dbContainer);
  assertTauroContainer(authContainer);
  const moduleUrl = pathToFileURL(resolve("dist/server-tests/server/paint-guide-homeowner/exchange.js")).href;
  const cryptoUrl = pathToFileURL(resolve("dist/server-tests/server/paint-guide-homeowner/crypto.js")).href;
  const sessionsUrl = pathToFileURL(resolve("dist/server-tests/server/paint-guide-homeowner/sessions.js")).href;
  const [exchangeModule, cryptoModule, sessionsModule] = await Promise.all([
    import(moduleUrl),
    import(cryptoUrl),
    import(sessionsUrl),
  ]);
  const serviceRoleToken = localServiceRoleToken();
  const lookupKeys = new Map([[1, Buffer.alloc(32, 17)]]);
  const sessionKeys = new Map([[1, Buffer.alloc(32, 23)]]);
  const environment = {
    supabaseUrl: new URL(localApiUrl),
    supabaseSecretKey: serviceRoleToken,
    expectedProjectRef: projectRef,
    environment: "test",
    allowedOrigins: new Set([origin]),
    tokenLookupHmacKeys: { activeVersion: 1, keys: lookupKeys },
    tokenEncryptionKeys: { activeVersion: 1, keys: new Map([[1, Buffer.alloc(32, 29)]]) },
    sessionHmacKeys: { activeVersion: 1, keys: sessionKeys },
  };
  const handler = exchangeModule.createHomeownerExchangeHandler({
    loadEnvironment: () => environment,
  });

  const issueAccess = async (guideId, nonceByte) => {
    const token = cryptoModule.createHomeownerAccessToken(1);
    const hmac = cryptoModule.deriveLookupHmac(token, projectRef, environment.tokenLookupHmacKeys);
    const outcome = await postRpc("paint_guide_homeowner_access_issue", {
      p_guide_id: guideId,
      p_actor_id: actorId,
      p_format_version: 1,
      p_lookup_key_version: 1,
      p_token_hmac: `\\x${hmac.toString("hex")}`,
      p_encryption_key_version: 1,
      p_token_ciphertext: "\\x01",
      p_encryption_nonce: `\\x${Buffer.alloc(12, nonceByte).toString("hex")}`,
      p_encryption_tag: `\\x${Buffer.alloc(16, nonceByte).toString("hex")}`,
    }, serviceRoleToken);
    if (outcome?.outcome !== "issued") fail();
    return { token, hmac };
  };

  try {
    stage = "setup";
    executeSql(setupSql);
    stage = "issue";
    const published = await issueAccess(publishedGuideId, 41);
    const draft = await issueAccess(draftGuideId, 42);

    stage = "published-exchange";
    const firstSession = sessionFromResponse(
      await handler(requestFor(published.token.canonical)),
      sessionsModule.parseHomeownerSessionBearer,
    );
    const firstSessionHmac = sessionsModule.deriveSessionHmac(firstSession, projectRef, environment.sessionHmacKeys);
    stage = "stored-session";
    const firstStored = executeSql(`
select count(*)::text || '|' ||
  coalesce(bool_and(session_hmac = decode('${firstSessionHmac.toString("hex")}', 'hex')), false)::text || '|' ||
  coalesce(bool_and(s.token_generation = t.token_generation), false)::text || '|' ||
  coalesce(bool_and(s.session_epoch = t.session_epoch), false)::text
from paint_guide_private.homeowner_sessions as s
join paint_guide_private.homeowner_access_tokens as t on t.guide_id = s.guide_id
where s.guide_id = '${publishedGuideId}'::uuid;
`);
    if (firstStored !== "1|true|true|true") {
      stage = `stored-session-${firstStored}`;
      fail();
    }
    stage = "expiry";
    const expiryValid = executeSql(`
select (min(expires_at) >= clock_timestamp() + interval '28 minutes 30 seconds'
  and min(expires_at) <= clock_timestamp() + interval '29 minutes 30 seconds')::text
from paint_guide_private.homeowner_sessions
where guide_id = '${publishedGuideId}'::uuid;
`);
    if (expiryValid !== "true") fail();

    stage = "unknown";
    await assertUnavailable(handler, cryptoModule.createHomeownerAccessToken(1).canonical);
    stage = "draft";
    await assertUnavailable(handler, draft.token.canonical);

    stage = "replay";
    const replaySession = sessionFromResponse(
      await handler(requestFor(published.token.canonical)),
      sessionsModule.parseHomeownerSessionBearer,
    );
    const replayHmac = sessionsModule.deriveSessionHmac(replaySession, projectRef, environment.sessionHmacKeys);
    if (replaySession.canonical === firstSession.canonical || replayHmac.equals(firstSessionHmac)) fail();
    stage = "replay-storage";
    const replayStored = executeSql(`
select (count(*) = 2 and count(distinct encode(session_hmac, 'hex')) = 2)::text
from paint_guide_private.homeowner_sessions
where guide_id = '${publishedGuideId}'::uuid;
`);
    if (replayStored !== "true") fail();

    stage = "revoke";
    await postRpc("paint_guide_homeowner_access_revoke", {
      p_guide_id: publishedGuideId,
      p_actor_id: actorId,
      p_expected_token_generation: 1,
      p_expected_session_epoch: 1,
    }, serviceRoleToken);
    stage = "revoked";
    await assertUnavailable(handler, published.token.canonical);
    process.stdout.write("TAURO_EXCHANGE_CONTRACT_PASS\n");
  } finally {
    executeSql(cleanupSql);
  }
}

main().catch(() => {
  process.stderr.write(`TAURO_EXCHANGE_CONTRACT_FAIL:${stage}\n`);
  process.exitCode = 1;
});
