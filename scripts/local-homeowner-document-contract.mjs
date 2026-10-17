import { createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const docker = process.env.TAURO_DOCKER_CLI || "docker";
const dbContainer = "supabase_db_tauro-paint-guide";
const authContainer = "supabase_auth_tauro-paint-guide";
const localApiUrl = "http://127.0.0.1:55321";
const actorId = "73000000-0000-4000-8000-000000000001";
const guideId = "73000000-0000-4000-8000-000000000101";
const exteriorId = "73000000-0000-4000-8000-000000000201";
const entryId = "73000000-0000-4000-8000-000000000202";
const primaryRecordId = "73000000-0000-4000-8000-000000000301";
const exceptionRecordId = "73000000-0000-4000-8000-000000000302";
const additionalRecordId = "73000000-0000-4000-8000-000000000303";
const projectRef = "abcdefghijklmnopqrst";
const origin = "http://127.0.0.1:3000";
let stage = "startup";

function fail() { throw new Error("Tauro local document contract probe failed."); }
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
insert into auth.users (id, aud, role, email) values ('${actorId}'::uuid, 'authenticated', 'authenticated', 'tauro-document-probe@example.test');
insert into public.profiles (user_id, role, active) values ('${actorId}'::uuid, 'owner', true);
insert into public.paint_guides (id, residence_name, status, primary_scope_note) values ('${guideId}'::uuid, 'Tauro document probe residence', 'published', 'Synthetic local document fixture.');
insert into public.guide_locations (id, guide_id, parent_id, location_type, name, sort_order) values
  ('${exteriorId}'::uuid, '${guideId}'::uuid, null, 'structure', 'Exterior', 0),
  ('${entryId}'::uuid, '${guideId}'::uuid, '${exteriorId}'::uuid, 'area', 'Front Entry', 0);
insert into public.paint_records (id, guide_id, section, surface, brand, product, color_name, color_code, sheen, notes, sort_order) values
  ('${primaryRecordId}'::uuid, '${guideId}'::uuid, 'primary', 'Siding', 'Synthetic Paint', 'Exterior', 'Alpine White', 'S-100', 'Satin', null, 0),
  ('${exceptionRecordId}'::uuid, '${guideId}'::uuid, 'exception', 'Front Door', 'Synthetic Paint', null, 'Black', 'S-200', 'Gloss', 'Local fixture exception.', 0),
  ('${additionalRecordId}'::uuid, '${guideId}'::uuid, 'additional', 'Railings', null, null, 'Iron Gray', null, null, null, 0);
insert into public.paint_record_locations (guide_id, paint_record_id, location_id) values
  ('${guideId}'::uuid, '${primaryRecordId}'::uuid, '${exteriorId}'::uuid),
  ('${guideId}'::uuid, '${exceptionRecordId}'::uuid, '${entryId}'::uuid),
  ('${guideId}'::uuid, '${additionalRecordId}'::uuid, '${exteriorId}'::uuid);
commit;
`;
async function postRpc(name, body, serviceRoleToken) {
  const response = await fetch(`${localApiUrl}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: serviceRoleToken, authorization: `Bearer ${serviceRoleToken}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) fail();
  return response.json();
}
function exchangeRequest(token) {
  return new Request("https://www.tauropainting.com/api/paint-guide/homeowner/exchange", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
}
function documentRequest(cookie) {
  const headers = new Headers();
  if (cookie) headers.set("Cookie", cookie);
  return new Request("https://www.tauropainting.com/api/paint-guide/homeowner/document", { method: "GET", headers });
}
function cookieFromExchange(response) {
  if (response.status !== 204) fail();
  const cookie = response.headers.get("set-cookie");
  if (!cookie || !cookie.includes("HttpOnly") || !cookie.includes("SameSite=Strict")) fail();
  return cookie.split(";", 1)[0];
}
async function assertUnavailable(handler, cookie) {
  const response = await handler(documentRequest(cookie));
  if (response.status !== 404 || (await response.text()) !== '{"available":false}') fail();
  const clear = response.headers.get("set-cookie");
  if (!clear || !clear.includes("Max-Age=0") || !clear.includes("HttpOnly") || !clear.includes("SameSite=Strict")) fail();
}
function assertNoPrivateFields(value) {
  const forbidden = new Set([
    "token_hmac", "token_ciphertext", "encryption_nonce", "encryption_tag",
    "lookup_key_version", "encryption_key_version", "session_key_version", "session_hmac",
    "token_generation", "session_epoch", "revoked_at", "created_by", "rotated_by", "revoked_by",
    "user_id", "profile_id", "role", "auth_uid", "service_role", "jwt",
  ]);
  if (Array.isArray(value)) { value.forEach(assertNoPrivateFields); return; }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key)) fail();
    assertNoPrivateFields(child);
  }
}

async function main() {
  assertTauroContainer(dbContainer);
  assertTauroContainer(authContainer);
  const [exchangeModule, documentModule, cryptoModule] = await Promise.all([
    import(pathToFileURL(resolve("dist/server-tests/server/paint-guide-homeowner/exchange.js")).href),
    import(pathToFileURL(resolve("dist/server-tests/server/paint-guide-homeowner/document-handler.js")).href),
    import(pathToFileURL(resolve("dist/server-tests/server/paint-guide-homeowner/crypto.js")).href),
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
  const issueAccess = async (nonceByte) => {
    const token = cryptoModule.createHomeownerAccessToken(1);
    const hmac = cryptoModule.deriveLookupHmac(token, projectRef, environment.tokenLookupHmacKeys);
    const result = await postRpc("paint_guide_homeowner_access_issue", { p_guide_id: guideId, p_actor_id: actorId, p_format_version: 1, p_lookup_key_version: 1, p_token_hmac: `\\x${hmac.toString("hex")}`, p_encryption_key_version: 1, p_token_ciphertext: "\\x01", p_encryption_nonce: `\\x${Buffer.alloc(12, nonceByte).toString("hex")}`, p_encryption_tag: `\\x${Buffer.alloc(16, nonceByte).toString("hex")}` }, serviceRoleToken);
    if (result?.outcome !== "issued") fail();
    return token;
  };
  const freshSession = async (nonceByte) => cookieFromExchange(await exchange(exchangeRequest(await issueAccess(nonceByte).then((token) => token.canonical))));
  try {
    stage = "setup"; executeSql(setupSql);
    stage = "exchange"; const firstCookie = await freshSession(41);
    stage = "document"; const response = await document(documentRequest(firstCookie));
    if (response.status !== 200 || response.headers.get("set-cookie") !== null || response.headers.get("cache-control") !== "no-store, private") fail();
    const body = await response.json();
    if (body.guide?.residence_name !== "Tauro document probe residence" || body.locations?.length !== 2 || body.records?.length !== 3 || body.assignments?.length !== 3) fail();
    assertNoPrivateFields(body);
    stage = "missing"; await assertUnavailable(document);
    stage = "malformed"; await assertUnavailable(document, "tauro_paint_guide_session=tpgs1.01.invalid");
    stage = "unpublish"; executeSql(`update public.paint_guides set status = 'draft' where id = '${guideId}'::uuid;`); await assertUnavailable(document, firstCookie);
    stage = "revoke-setup"; executeSql(`delete from paint_guide_private.homeowner_access_tokens where guide_id = '${guideId}'::uuid; update public.paint_guides set status = 'published' where id = '${guideId}'::uuid;`); const revokeCookie = await freshSession(42);
    stage = "revoke"; await postRpc("paint_guide_homeowner_access_revoke", { p_guide_id: guideId, p_actor_id: actorId, p_expected_token_generation: 1, p_expected_session_epoch: 1 }, serviceRoleToken); await assertUnavailable(document, revokeCookie);
    stage = "expiry-setup"; executeSql(`delete from paint_guide_private.homeowner_access_tokens where guide_id = '${guideId}'::uuid;`); const expiryCookie = await freshSession(43);
    stage = "expiry"; executeSql(`update paint_guide_private.homeowner_sessions set created_at = statement_timestamp() - interval '31 minutes', expires_at = statement_timestamp() - interval '1 minute' where guide_id = '${guideId}'::uuid;`); await assertUnavailable(document, expiryCookie);
    stage = "cleanup-check"; executeSql(cleanupSql); if (executeSql(`select (not exists (select 1 from public.paint_guides where id = '${guideId}'::uuid))::text;`) !== "true") fail();
    process.stdout.write("TAURO_DOCUMENT_CONTRACT_PASS\n");
  } finally { executeSql(cleanupSql); }
}
main().catch(() => { process.stderr.write(`TAURO_DOCUMENT_CONTRACT_FAIL:${stage}\n`); process.exitCode = 1; });
