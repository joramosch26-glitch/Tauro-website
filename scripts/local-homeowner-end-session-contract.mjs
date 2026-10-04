import { createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const docker = process.env.TAURO_DOCKER_CLI || "docker";
const dbContainer = "supabase_db_tauro-paint-guide";
const authContainer = "supabase_auth_tauro-paint-guide";
const localApiUrl = "http://127.0.0.1:55321";
const actorId = "75000000-0000-4000-8000-000000000001";
const guideId = "75000000-0000-4000-8000-000000000101";
const locationId = "75000000-0000-4000-8000-000000000201";
const recordId = "75000000-0000-4000-8000-000000000301";
const projectRef = "abcdefghijklmnopqrst";
const origin = "http://127.0.0.1:3000";
let stage = "startup";

function fail() { throw new Error("Tauro local end-session contract probe failed."); }
function runDocker(args, input) {
  const result = spawnSync(docker, args, { encoding: "utf8", input, windowsHide: true });
  if (result.error || result.status !== 0) fail();
  return result.stdout.trim();
}
function assertTauroContainer(name) {
  const running = runDocker(["ps", "--filter", `name=^/${name}$`, "--format", "{{.Names}}"]).trim();
  if (running !== name) fail();
  const project = runDocker(["inspect", "--format", "{{index .Config.Labels \"com.supabase.cli.project\"}}", name]);
  if (project !== "tauro-paint-guide") fail();
}
function executeSql(sql) {
  return runDocker(["exec", "-i", dbContainer, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], sql);
}
function base64url(value) { return Buffer.from(value).toString("base64url"); }
function localServiceRoleToken() {
  const secret = runDocker(["exec", authContainer, "sh", "-lc", "printf %s \"$GOTRUE_JWT_SECRET\""]);
  if (!secret) fail();
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ aud: "authenticated", exp: now + 60, iat: now, iss: "supabase-demo", role: "service_role" }));
  const input = `${header}.${payload}`;
  return `${input}.${createHmac("sha256", secret).update(input).digest("base64url")}`;
}
const cleanupSql = `
begin;
delete from public.paint_guides where id = '${guideId}'::uuid;
delete from auth.users where id = '${actorId}'::uuid;
commit;
`;
const setupSql = `
begin;
delete from public.paint_guides where id = '${guideId}'::uuid;
delete from auth.users where id = '${actorId}'::uuid;
insert into auth.users (id, aud, role, email) values ('${actorId}'::uuid, 'authenticated', 'authenticated', 'tauro-end-session-probe@example.test');
insert into public.profiles (user_id, role, active) values ('${actorId}'::uuid, 'owner', true);
insert into public.paint_guides (id, residence_name, status) values ('${guideId}'::uuid, 'Tauro end-session probe residence', 'published');
insert into public.guide_locations (id, guide_id, parent_id, location_type, name, sort_order) values
  ('${locationId}'::uuid, '${guideId}'::uuid, null, 'structure', 'Exterior', 0);
insert into public.paint_records (id, guide_id, section, surface, color_name, sort_order) values
  ('${recordId}'::uuid, '${guideId}'::uuid, 'primary', 'Siding', 'Synthetic White', 0);
insert into public.paint_record_locations (guide_id, paint_record_id, location_id) values
  ('${guideId}'::uuid, '${recordId}'::uuid, '${locationId}'::uuid);
commit;
`;
async function postRpc(name, body, serviceRoleToken) {
  const response = await fetch(`${localApiUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: serviceRoleToken, authorization: `Bearer ${serviceRoleToken}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) fail();
  return response.json();
}
function exchangeRequest(token) {
  return new Request("https://www.tauropainting.com/api/paint-guide/homeowner/exchange", {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ token }),
  });
}
function documentRequest(cookie) {
  const headers = new Headers();
  if (cookie) headers.set("Cookie", cookie);
  return new Request("https://www.tauropainting.com/api/paint-guide/homeowner/document", { method: "GET", headers });
}
function endSessionRequest(cookie) {
  const headers = new Headers({ Origin: origin });
  if (cookie) headers.set("Cookie", cookie);
  return new Request("https://www.tauropainting.com/api/paint-guide/homeowner/end-session", { method: "POST", headers });
}
function cookieFromExchange(response) {
  if (response.status !== 204) fail();
  const cookie = response.headers.get("set-cookie");
  if (!cookie || !cookie.includes("HttpOnly") || !cookie.includes("SameSite=Strict")) fail();
  return cookie.split(";", 1)[0];
}
function assertCleared(response, status = 204) {
  if (response.status !== status || response.headers.get("cache-control") !== "no-store, private") fail();
  const clear = response.headers.get("set-cookie");
  if (!clear || !clear.includes("Max-Age=0") || !clear.includes("HttpOnly") || !clear.includes("SameSite=Strict")) fail();
}
async function assertDocumentAvailable(handler, cookie) {
  const response = await handler(documentRequest(cookie));
  if (response.status !== 200 || response.headers.get("set-cookie") !== null) fail();
}
async function assertDocumentUnavailable(handler, cookie) {
  const response = await handler(documentRequest(cookie));
  if (response.status !== 404 || (await response.text()) !== '{"available":false}') fail();
  assertCleared(response, 404);
}

async function main() {
  assertTauroContainer(dbContainer);
  assertTauroContainer(authContainer);
  const [exchangeModule, documentModule, endSessionModule, cryptoModule, sessionsModule] = await Promise.all([
    import(pathToFileURL(resolve("dist/server-tests/server/paint-guide-homeowner/exchange.js")).href),
    import(pathToFileURL(resolve("dist/server-tests/server/paint-guide-homeowner/document-handler.js")).href),
    import(pathToFileURL(resolve("dist/server-tests/server/paint-guide-homeowner/end-session.js")).href),
    import(pathToFileURL(resolve("dist/server-tests/server/paint-guide-homeowner/crypto.js")).href),
    import(pathToFileURL(resolve("dist/server-tests/server/paint-guide-homeowner/sessions.js")).href),
  ]);
  const serviceRoleToken = localServiceRoleToken();
  const environment = {
    supabaseUrl: new URL(localApiUrl), supabaseSecretKey: serviceRoleToken, expectedProjectRef: projectRef, environment: "test", allowedOrigins: new Set([origin]),
    tokenLookupHmacKeys: { activeVersion: 1, keys: new Map([[1, Buffer.alloc(32, 17)]]) },
    tokenEncryptionKeys: { activeVersion: 1, keys: new Map([[1, Buffer.alloc(32, 29)]]) },
    sessionHmacKeys: { activeVersion: 1, keys: new Map([[1, Buffer.alloc(32, 23)]]) },
  };
  const exchange = exchangeModule.createHomeownerExchangeHandler({ loadEnvironment: () => environment });
  const document = documentModule.createHomeownerDocumentHandler({ loadEnvironment: () => environment });
  const endSession = endSessionModule.createHomeownerEndSessionHandler({ loadEnvironment: () => environment });
  const issueAccess = async () => {
    const token = cryptoModule.createHomeownerAccessToken(1);
    const hmac = cryptoModule.deriveLookupHmac(token, projectRef, environment.tokenLookupHmacKeys);
    const result = await postRpc("paint_guide_homeowner_access_issue", {
      p_guide_id: guideId, p_actor_id: actorId, p_format_version: 1, p_lookup_key_version: 1,
      p_token_hmac: `\\x${hmac.toString("hex")}`, p_encryption_key_version: 1, p_token_ciphertext: "\\x01",
      p_encryption_nonce: `\\x${Buffer.alloc(12, 41).toString("hex")}`, p_encryption_tag: `\\x${Buffer.alloc(16, 41).toString("hex")}`,
    }, serviceRoleToken);
    if (result?.outcome !== "issued") fail();
    return token;
  };
  const sessionHmacForCookie = (cookie) => {
    const bearer = cookie.split("=", 2)[1];
    return sessionsModule.deriveSessionHmac(sessionsModule.parseHomeownerSessionBearer(bearer), projectRef, environment.sessionHmacKeys);
  };
  const revokedAtForCookie = (cookie) => {
    const hmac = sessionHmacForCookie(cookie);
    return executeSql(`select coalesce(revoked_at::text, '') from paint_guide_private.homeowner_sessions where session_key_version = 1 and session_hmac = decode('${hmac.toString("hex")}', 'hex');`);
  };
  try {
    stage = "setup"; executeSql(setupSql);
    stage = "exchange"; const access = await issueAccess();
    const firstCookie = cookieFromExchange(await exchange(exchangeRequest(access.canonical)));
    const secondCookie = cookieFromExchange(await exchange(exchangeRequest(access.canonical)));
    stage = "document-before"; await assertDocumentAvailable(document, firstCookie); await assertDocumentAvailable(document, secondCookie);
    stage = "end"; assertCleared(await endSession(endSessionRequest(firstCookie)));
    stage = "persistent-revoke"; const firstRevokedAt = revokedAtForCookie(firstCookie); if (!firstRevokedAt) fail();
    stage = "document-after"; await assertDocumentUnavailable(document, firstCookie);
    stage = "second-end"; assertCleared(await endSession(endSessionRequest(firstCookie))); if (revokedAtForCookie(firstCookie) !== firstRevokedAt) fail();
    stage = "isolation"; await assertDocumentAvailable(document, secondCookie); if (revokedAtForCookie(secondCookie)) fail();
    stage = "missing"; assertCleared(await endSession(endSessionRequest())); await assertDocumentAvailable(document, secondCookie);
    stage = "malformed"; assertCleared(await endSession(endSessionRequest("tauro_paint_guide_session=tpgs1.01.invalid"))); await assertDocumentAvailable(document, secondCookie);
    stage = "cleanup"; executeSql(cleanupSql);
    if (executeSql(`select (not exists (select 1 from public.paint_guides where id = '${guideId}'::uuid) and not exists (select 1 from paint_guide_private.homeowner_sessions where guide_id = '${guideId}'::uuid))::text;`) !== "true") fail();
    process.stdout.write("TAURO_END_SESSION_CONTRACT_PASS\n");
  } finally {
    executeSql(cleanupSql);
  }
}

main().catch(() => { process.stderr.write(`TAURO_END_SESSION_CONTRACT_FAIL:${stage}\n`); process.exitCode = 1; });
