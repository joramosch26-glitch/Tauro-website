import { createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const docker = process.env.TAURO_DOCKER_CLI || "docker";
const dbContainer = "supabase_db_tauro-paint-guide";
const authContainer = "supabase_auth_tauro-paint-guide";
const localApiUrl = "http://127.0.0.1:55321";
const guideId = "73000000-0000-4000-8000-000000000101";
const actorId = "73000000-0000-4000-8000-000000000001";

function fail() {
  throw new Error("Tauro local bytea contract probe failed.");
}

function runDocker(args, input) {
  const result = spawnSync(docker, args, {
    encoding: "utf8",
    input,
    windowsHide: true,
  });
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
delete from public.paint_guides where id = '${guideId}'::uuid;
delete from auth.users where id = '${actorId}'::uuid;
commit;
`;

const setupSql = `
begin;
delete from public.paint_guides where id = '${guideId}'::uuid;
delete from auth.users where id = '${actorId}'::uuid;
insert into auth.users (id, aud, role, email) values
  ('${actorId}'::uuid, 'authenticated', 'authenticated', 'tauro-bytea-probe@example.test');
insert into public.profiles (user_id, role, active) values
  ('${actorId}'::uuid, 'owner', true);
insert into public.paint_guides (id, residence_name, status) values
  ('${guideId}'::uuid, 'Tauro bytea probe fixture', 'published');
commit;
`;

async function main() {
  assertTauroContainer(dbContainer);
  assertTauroContainer(authContainer);
  const { byteaToPostgrest } = await import(
    pathToFileURL(resolve("dist/server-tests/server/paint-guide-homeowner/bytea.js")).href,
  );
  const material = {
    tokenHmac: Buffer.from("00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff", "hex"),
    ciphertext: Buffer.from("00ff10807f", "hex"),
    nonce: Buffer.from("00112233445566778899aabb", "hex"),
    tag: Buffer.from("ffeeddccbbaa99887766554433221100", "hex"),
  };

  try {
    executeSql(setupSql);
    const serviceRoleToken = localServiceRoleToken();
    const response = await fetch(`${localApiUrl}/rest/v1/rpc/paint_guide_homeowner_access_issue`, {
      method: "POST",
      headers: {
        apikey: serviceRoleToken,
        authorization: `Bearer ${serviceRoleToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_guide_id: guideId,
        p_actor_id: actorId,
        p_format_version: 1,
        p_lookup_key_version: 1,
        p_token_hmac: byteaToPostgrest(material.tokenHmac),
        p_encryption_key_version: 1,
        p_token_ciphertext: byteaToPostgrest(material.ciphertext),
        p_encryption_nonce: byteaToPostgrest(material.nonce),
        p_encryption_tag: byteaToPostgrest(material.tag),
      }),
    });
    if (!response.ok) fail();

    const exact = executeSql(`
select (
  token_hmac = decode('${material.tokenHmac.toString("hex")}', 'hex') and
  token_ciphertext = decode('${material.ciphertext.toString("hex")}', 'hex') and
  encryption_nonce = decode('${material.nonce.toString("hex")}', 'hex') and
  encryption_tag = decode('${material.tag.toString("hex")}', 'hex')
)::text
from paint_guide_private.homeowner_access_tokens
where guide_id = '${guideId}'::uuid;
`);
    if (exact !== "true") fail();
    process.stdout.write("TAURO_BYTEA_CONTRACT_PASS\n");
  } finally {
    executeSql(cleanupSql);
  }
}

main().catch(() => {
  process.stderr.write("TAURO_BYTEA_CONTRACT_FAIL\n");
  process.exitCode = 1;
});
