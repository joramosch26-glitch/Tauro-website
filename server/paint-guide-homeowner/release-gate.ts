import { timingSafeEqual } from "node:crypto";
import { callStaffAccessMaterial, type StaffAccessRpcClient } from "../paint-guide-staff/access-rpc.js";
import { createHomeownerSupabaseAdminClient } from "./supabase-admin.js";
import type { HomeownerServerEnvironment } from "./types.js";
import type { HomeownerSessionExchangeInput } from "./rpc.js";
import type { HomeownerGuideDocumentData } from "./document.js";

// Existing server-only RPC, same unchanged crypto/key history, no schema change.
// A valid token from the protected QA project or another residence cannot enter
// this canonical release merely because the project/keyrings are shared.
export async function permitsSyntheticReleaseToken(environment: HomeownerServerEnvironment,
  input: Pick<HomeownerSessionExchangeInput, "lookupKeyVersion" | "tokenHmac">, fetchImplementation?: typeof fetch) {
  const gate = environment.syntheticRelease;
  if (!gate) return true;
  const client = createHomeownerSupabaseAdminClient(environment, fetchImplementation) as unknown as StaffAccessRpcClient;
  const result = await callStaffAccessMaterial(client, "recover", environment,
    gate.guideId, gate.actorId);
  return result.kind === "active" && result.material.lookupKeyVersion === input.lookupKeyVersion
    && result.material.tokenHmac.length === input.tokenHmac.length
    && timingSafeEqual(result.material.tokenHmac, input.tokenHmac);
}

// The existing document RPC intentionally omits the guide UUID. Prove its
// record/location provenance against the pinned guide before returning content.
// Empty guides are deliberately unavailable during synthetic-only acceptance.
export async function permitsSyntheticReleaseDocument(environment: HomeownerServerEnvironment,
  document: HomeownerGuideDocumentData, fetchImplementation?: typeof fetch) {
  const gate = environment.syntheticRelease;
  if (!gate) return true;
  if (!document.records.length && !document.locations.length) return false;
  const client = createHomeownerSupabaseAdminClient(environment, fetchImplementation);
  const [guide, records, locations] = await Promise.all([
    client.from("paint_guides").select("residence_name,primary_scope_note,status").eq("id", gate.guideId).maybeSingle(),
    client.from("paint_records").select("id").eq("guide_id", gate.guideId),
    client.from("guide_locations").select("id").eq("guide_id", gate.guideId),
  ]);
  if (guide.error || records.error || locations.error || !guide.data || guide.data.status !== "published"
    || guide.data.residence_name !== document.guide.residence_name
    || guide.data.primary_scope_note !== document.guide.primary_scope_note) return false;
  const recordIds = new Set((records.data ?? []).map((row) => row.id));
  const locationIds = new Set((locations.data ?? []).map((row) => row.id));
  return document.records.every((row) => recordIds.has(row.id))
    && document.locations.every((row) => locationIds.has(row.id));
}
