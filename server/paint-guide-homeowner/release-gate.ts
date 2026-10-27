import { timingSafeEqual } from "node:crypto";
import { callStaffAccessMaterial, type StaffAccessRpcClient } from "../paint-guide-staff/access-rpc.js";
import { createHomeownerSupabaseAdminClient } from "./supabase-admin.js";
import type { HomeownerServerEnvironment } from "./types.js";
import type { HomeownerSessionExchangeInput } from "./rpc.js";
import type { HomeownerGuideDocumentData } from "./document.js";
import { syntheticReleaseGuideIds } from "./synthetic-release.js";

export type SyntheticReleasePhoto = NonNullable<HomeownerGuideDocumentData["photos"]>[number];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function matchingSyntheticGuideId(environment: HomeownerServerEnvironment,
  document: HomeownerGuideDocumentData, fetchImplementation?: typeof fetch): Promise<string | null> {
  const gate = environment.syntheticRelease;
  if (!gate || (!document.records.length && !document.locations.length)) return null;
  const client = createHomeownerSupabaseAdminClient(environment, fetchImplementation);
  for (const guideId of syntheticReleaseGuideIds(environment)) {
    const [guide, records, locations] = await Promise.all([
      client.from("paint_guides").select("residence_name,primary_scope_note,status").eq("id", guideId).maybeSingle(),
      client.from("paint_records").select("id").eq("guide_id", guideId),
      client.from("guide_locations").select("id").eq("guide_id", guideId),
    ]);
    if (guide.error || records.error || locations.error || !guide.data || guide.data.status !== "published"
      || guide.data.residence_name !== document.guide.residence_name
      || guide.data.primary_scope_note !== document.guide.primary_scope_note) continue;
    const recordIds = new Set((records.data ?? []).map((row) => row.id));
    const locationIds = new Set((locations.data ?? []).map((row) => row.id));
    if (document.records.every((row) => recordIds.has(row.id))
      && document.locations.every((row) => locationIds.has(row.id))) return guideId;
  }
  return null;
}

/** Backward-compatible Preview metadata for databases whose document RPC predates photo slots. */
export async function readSyntheticReleasePhotos(environment: HomeownerServerEnvironment,
  document: HomeownerGuideDocumentData, fetchImplementation?: typeof fetch): Promise<SyntheticReleasePhoto[] | null> {
  if (environment.environment !== "preview") return null;
  const guideId = await matchingSyntheticGuideId(environment, document, fetchImplementation);
  if (!guideId || !UUID.test(guideId)) return null;
  try {
    const client = createHomeownerSupabaseAdminClient(environment, fetchImplementation);
    const { data: slotData, error: slotError } = await client.from("paint_guide_photo_slots")
      .select("id,placement_kind,location_id,paint_record_id,current_version_id")
      .eq("guide_id", guideId).not("current_version_id", "is", null);
    if (slotError || !Array.isArray(slotData)) return null;
    const slots: Array<{ id: string; placement_kind: SyntheticReleasePhoto["placement_kind"]; location_id: string | null; paint_record_id: string | null; current_version_id: string }> = [];
    for (const value of slotData as unknown[]) {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const row = value as Record<string, unknown>;
      const { id, placement_kind, location_id, paint_record_id, current_version_id } = row;
      if (typeof id !== "string" || !UUID.test(id) || typeof current_version_id !== "string" || !UUID.test(current_version_id)
        || (placement_kind !== "residence_cover" && placement_kind !== "location" && placement_kind !== "record_context" && placement_kind !== "record_formula_label")
        || !(location_id === null || (typeof location_id === "string" && UUID.test(location_id)))
        || !(paint_record_id === null || (typeof paint_record_id === "string" && UUID.test(paint_record_id)))
        || (placement_kind === "record_formula_label" && (location_id !== null || paint_record_id === null))
        || (placement_kind === "record_context" && (location_id === null || paint_record_id === null))
        || (placement_kind === "location" && (location_id === null || paint_record_id !== null))
        || (placement_kind === "residence_cover" && (location_id !== null || paint_record_id !== null))) return null;
      slots.push({
        id: id as string,
        placement_kind: placement_kind as SyntheticReleasePhoto["placement_kind"],
        location_id: location_id as string | null,
        paint_record_id: paint_record_id as string | null,
        current_version_id: current_version_id as string,
      });
    }
    if (!slots.length) return [];
    const versionIds = [...new Set(slots.map((slot) => slot.current_version_id))];
    const { data: versionData, error: versionError } = await client.from("paint_guide_photo_versions")
      .select("id,slot_id,state").in("id", versionIds).eq("state", "ready");
    if (versionError || !Array.isArray(versionData)) return null;
    const ready = new Set<string>();
    for (const value of versionData as unknown[]) {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const row = value as Record<string, unknown>;
      if (typeof row.id !== "string" || !UUID.test(row.id) || typeof row.slot_id !== "string" || !UUID.test(row.slot_id) || row.state !== "ready") return null;
      ready.add(`${row.slot_id}:${row.id}`);
    }
    return slots.filter((slot) => ready.has(`${slot.id}:${slot.current_version_id}`)).map((slot) => ({
      slot_id: slot.id, version_id: slot.current_version_id, placement_kind: slot.placement_kind,
      location_id: slot.location_id, paint_record_id: slot.paint_record_id,
    }));
  } catch { return null; }
}

// Existing server-only RPC, same unchanged crypto/key history, no schema change.
// A valid token from the protected QA project or another residence cannot enter
// this canonical release merely because the project/keyrings are shared.
export async function permitsSyntheticReleaseToken(environment: HomeownerServerEnvironment,
  input: Pick<HomeownerSessionExchangeInput, "lookupKeyVersion" | "tokenHmac">, fetchImplementation?: typeof fetch) {
  const gate = environment.syntheticRelease;
  if (!gate) return true;
  const client = createHomeownerSupabaseAdminClient(environment, fetchImplementation) as unknown as StaffAccessRpcClient;
  for (const guideId of syntheticReleaseGuideIds(environment)) {
    const result = await callStaffAccessMaterial(client, "recover", environment, guideId, gate.actorId);
    if (result.kind === "active" && result.material.lookupKeyVersion === input.lookupKeyVersion
      && result.material.tokenHmac.length === input.tokenHmac.length
      && timingSafeEqual(result.material.tokenHmac, input.tokenHmac)) return true;
  }
  return false;
}

// The existing document RPC intentionally omits the guide UUID. Prove its
// record/location provenance against the pinned guide before returning content.
// Empty guides are deliberately unavailable during synthetic-only acceptance.
export async function permitsSyntheticReleaseDocument(environment: HomeownerServerEnvironment,
  document: HomeownerGuideDocumentData, fetchImplementation?: typeof fetch) {
  if (!environment.syntheticRelease) return true;
  return await matchingSyntheticGuideId(environment, document, fetchImplementation) !== null;
}

