import { supabase } from "../lib/supabase";
import type { PaintRecord, PaintRecordSection } from "./types";
import { verifiedSwatchFieldsToPersist } from "../presentation/homeowner-features";
import { assertHomeownerDesignSchemaAvailable, HomeownerDesignMigrationRequiredError, normalizeHomeownerDesignDatabaseError, queryWithLegacyDesignColumns } from "./homeowner-design-schema";

const CATALOG_FIELDS = ["color_origin_brand", "color_reference_hex", "color_reference_provider", "color_reference_id", "color_reference_url", "color_reference_retrieved_at"] as const;
const COLUMNS = `id, guide_id, section, surface, brand, product, color_name, color_code, swatch_hex, swatch_provenance, ${CATALOG_FIELDS.join(", ")}, sheen, notes, sort_order, created_at, updated_at`;
const DESIGN_COLUMNS = "id, guide_id, section, surface, brand, product, color_name, color_code, swatch_hex, swatch_provenance, sheen, notes, sort_order, created_at, updated_at";
const LEGACY_COLUMNS = "id, guide_id, section, surface, brand, product, color_name, color_code, sheen, notes, sort_order, created_at, updated_at";
const optional = (value: string) => value.trim() || null;
function client() {
  if (!supabase) throw new Error("Paint Guide is not configured.");
  return supabase as any;
}

export type PaintRecordInput = {
  section: PaintRecordSection;
  surface: string;
  colorName: string;
  brand: string;
  product: string;
  colorCode: string;
  swatchHex: string;
  swatchProvenance: string;
  colorOriginBrand: string;
  colorReferenceHex: string;
  colorReferenceProvider: string;
  colorReferenceId: string;
  colorReferenceUrl: string;
  colorReferenceRetrievedAt: string;
  sheen: string;
  notes: string;
  sortOrder: number;
  homeowner_design_fields_available?: boolean;
};

function catalogFieldsMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const text = [value.message, value.details, value.hint].filter((item): item is string => typeof item === "string").join(" ").toLowerCase();
  return (value.code === "42703" || value.code === "PGRST204") && CATALOG_FIELDS.some((column) => text.includes(column));
}

function orderedQuery(db: any, columns: string, guideId: string) {
  return db.from("paint_records").select(columns).eq("guide_id", guideId)
    .order("sort_order", { ascending: true }).order("created_at", { ascending: true }).order("id", { ascending: true });
}

export async function listPaintRecords(guideId: string): Promise<PaintRecord[]> {
  const db = client();
  const full = await orderedQuery(db, COLUMNS, guideId);
  let data: unknown[] | null = null;
  let designFieldsAvailable = true;
  let catalogReferenceFieldsAvailable = true;

  if (!full.error) {
    data = full.data;
  } else {
    const normalized = normalizeHomeownerDesignDatabaseError(full.error);
    if (!catalogFieldsMissing(full.error) && !(normalized instanceof HomeownerDesignMigrationRequiredError)) throw full.error;
    catalogReferenceFieldsAvailable = false;
    const legacy = await queryWithLegacyDesignColumns(
      () => orderedQuery(db, DESIGN_COLUMNS, guideId),
      () => orderedQuery(db, LEGACY_COLUMNS, guideId),
    ) as { result: { error: unknown | null; data: unknown[] | null }; designFieldsAvailable: boolean };
    if (legacy.result.error) throw normalizeHomeownerDesignDatabaseError(legacy.result.error);
    data = legacy.result.data;
    designFieldsAvailable = legacy.designFieldsAvailable;
  }

  const records = (data ?? []).map((item) => ({
    ...(item as Record<string, unknown>),
    homeowner_design_fields_available: designFieldsAvailable,
  })) as PaintRecord[] & { homeowner_design_fields_available?: boolean; catalog_reference_fields_available?: boolean };
  records.homeowner_design_fields_available = designFieldsAvailable;
  records.catalog_reference_fields_available = catalogReferenceFieldsAvailable;
  return records;
}

const hasCatalogReference = (input: PaintRecordInput) => Boolean(
  input.colorOriginBrand.trim() || input.colorReferenceHex.trim() || input.colorReferenceProvider.trim() || input.colorReferenceId.trim() || input.colorReferenceUrl.trim() || input.colorReferenceRetrievedAt.trim(),
);

const values = (input: PaintRecordInput) => ({
  section: input.section,
  surface: input.surface.trim(),
  color_name: input.colorName.trim(),
  brand: optional(input.brand),
  product: optional(input.product),
  color_code: optional(input.colorCode),
  ...verifiedSwatchFieldsToPersist(input),
  ...(hasCatalogReference(input) ? {
    color_origin_brand: optional(input.colorOriginBrand),
    color_reference_hex: optional(input.colorReferenceHex),
    color_reference_provider: optional(input.colorReferenceProvider),
    color_reference_id: optional(input.colorReferenceId),
    color_reference_url: optional(input.colorReferenceUrl),
    color_reference_retrieved_at: optional(input.colorReferenceRetrievedAt),
  } : {}),
  sheen: optional(input.sheen),
  notes: optional(input.notes),
  sort_order: input.sortOrder,
});

function resultColumns(input: PaintRecordInput) { return hasCatalogReference(input) ? COLUMNS : DESIGN_COLUMNS; }

export async function createPaintRecord(guideId: string, input: PaintRecordInput): Promise<PaintRecord> {
  const db = client();
  await assertHomeownerDesignSchemaAvailable(db);
  const { data, error } = await db.from("paint_records").insert({ guide_id: guideId, ...values(input) }).select(resultColumns(input)).single();
  if (error || !data) throw error ? normalizeHomeownerDesignDatabaseError(error) : new Error("Could not add paint record.");
  return data as unknown as PaintRecord;
}

export async function updatePaintRecord(guideId: string, id: string, input: PaintRecordInput): Promise<PaintRecord> {
  const db = client();
  await assertHomeownerDesignSchemaAvailable(db);
  const { data, error } = await db.from("paint_records").update(values(input)).eq("id", id).eq("guide_id", guideId).select(resultColumns(input)).maybeSingle();
  if (error || !data) throw error ? normalizeHomeownerDesignDatabaseError(error) : new Error("Could not save paint record.");
  return data as unknown as PaintRecord;
}

export async function deletePaintRecord(guideId: string, id: string): Promise<void> {
  const { data, error } = await client().from("paint_records").delete().eq("id", id).eq("guide_id", guideId).select("id");
  if (error || !data?.length) throw error ? normalizeHomeownerDesignDatabaseError(error) : new Error("Could not delete paint record.");
}
