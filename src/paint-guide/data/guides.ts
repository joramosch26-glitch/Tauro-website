import { supabase } from "../lib/supabase";
import type { PaintGuide, PaintGuideStatus } from "./types";
import { propertyFieldsToPersist } from "../presentation/homeowner-features";
import { assertHomeownerDesignSchemaAvailable, normalizeHomeownerDesignDatabaseError, queryWithLegacyDesignColumns } from "./homeowner-design-schema";

const PAINT_GUIDE_COLUMNS =
  "id, residence_name, status, primary_scope_note, city, state, property_type, created_at, updated_at";
const LEGACY_PAINT_GUIDE_COLUMNS = "id, residence_name, status, primary_scope_note, created_at, updated_at";

export type CreatePaintGuideInput = {
  residenceName: string;
  primaryScopeNote: string;
};

export type UpdatePaintGuideInput = {
  residenceName: string;
  primaryScopeNote: string;
  status: PaintGuideStatus;
  city?: string;
  state?: string;
  propertyType?: string;
};

export type PaintGuideList = PaintGuide[] & { homeowner_design_fields_available?: boolean };

function requireSupabase() {
  if (!supabase) {
    throw new Error("Paint Guide is not configured.");
  }

  return supabase;
}

export async function listPaintGuides(): Promise<PaintGuideList> {
  const client = requireSupabase();
  const { result, designFieldsAvailable } = await queryWithLegacyDesignColumns(
    () => client.from("paint_guides").select(PAINT_GUIDE_COLUMNS).order("updated_at", { ascending: false }),
    () => client.from("paint_guides").select(LEGACY_PAINT_GUIDE_COLUMNS).order("updated_at", { ascending: false }),
  );
  const { data, error } = result;

  if (error) throw normalizeHomeownerDesignDatabaseError(error);

  const guides = (data ?? []).map((guide) => ({ ...guide, homeowner_design_fields_available: designFieldsAvailable })) as PaintGuideList;
  guides.homeowner_design_fields_available = designFieldsAvailable;
  return guides;
}

export async function getPaintGuide(guideId: string): Promise<PaintGuide | null> {
  const client = requireSupabase();
  const { result, designFieldsAvailable } = await queryWithLegacyDesignColumns(
    () => client.from("paint_guides").select(PAINT_GUIDE_COLUMNS).eq("id", guideId).maybeSingle(),
    () => client.from("paint_guides").select(LEGACY_PAINT_GUIDE_COLUMNS).eq("id", guideId).maybeSingle(),
  );
  const { data, error } = result;

  if (error) throw normalizeHomeownerDesignDatabaseError(error);

  return data ? { ...(data as PaintGuide), homeowner_design_fields_available: designFieldsAvailable } : null;
}

export async function createPaintGuide(
  input: CreatePaintGuideInput,
): Promise<PaintGuide> {
  const client = requireSupabase();
  await assertHomeownerDesignSchemaAvailable(client);
  const { data, error } = await client
    .from("paint_guides")
    .insert({
      residence_name: input.residenceName,
      primary_scope_note: input.primaryScopeNote || null,
      status: "draft",
    })
    .select(PAINT_GUIDE_COLUMNS)
    .single();

  if (error || !data) throw error ? normalizeHomeownerDesignDatabaseError(error) : new Error("Could not create Paint Guide.");

  return data as PaintGuide;
}

export async function updatePaintGuide(
  guideId: string,
  input: UpdatePaintGuideInput,
): Promise<PaintGuide> {
  const client = requireSupabase();
  await assertHomeownerDesignSchemaAvailable(client);
  const { data, error } = await client
    .from("paint_guides")
    .update({
      residence_name: input.residenceName,
      primary_scope_note: input.primaryScopeNote || null,
      status: input.status,
      ...propertyFieldsToPersist(input),
    })
    .eq("id", guideId)
    .select(PAINT_GUIDE_COLUMNS)
    .maybeSingle();

  if (error || !data) throw error ? normalizeHomeownerDesignDatabaseError(error) : new Error("Could not save Paint Guide.");

  return data as PaintGuide;
}
