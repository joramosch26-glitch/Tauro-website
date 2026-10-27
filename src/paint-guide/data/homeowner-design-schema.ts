const DESIGN_COLUMNS = ["city", "state", "property_type", "room_notes", "swatch_hex", "swatch_provenance"];

type SchemaProbeClient = {
  from(table: string): { select(columns: string): { limit(count: number): PromiseLike<{ error: unknown | null }> } };
};

export class HomeownerDesignMigrationRequiredError extends Error {
  constructor() {
    super("Homeowner design fields are not installed in this database. Review and apply the homeowner design migration before editing metadata, room notes, or swatches.");
    this.name = "HomeownerDesignMigrationRequiredError";
  }
}

export function normalizeHomeownerDesignDatabaseError(error: unknown): unknown {
  if (!error || typeof error !== "object") return error;
  const value = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const text = [value.message, value.details, value.hint].filter((item): item is string => typeof item === "string").join(" ").toLowerCase();
  const mentionsNewColumn = DESIGN_COLUMNS.some((column) => text.includes(column));
  const reportsMissingColumn = value.code === "42703" || value.code === "PGRST204" || /column .* (does not exist|not found)|could not find .* column/.test(text);
  return mentionsNewColumn && reportsMissingColumn ? new HomeownerDesignMigrationRequiredError() : error;
}

export function homeownerDesignErrorMessage(error: unknown, fallback: string): string {
  const normalized = normalizeHomeownerDesignDatabaseError(error);
  return normalized instanceof HomeownerDesignMigrationRequiredError ? normalized.message : fallback;
}

export async function assertHomeownerDesignSchemaAvailable(client: SchemaProbeClient): Promise<void> {
  const results = await Promise.all([
    client.from("paint_guides").select("city,state,property_type").limit(0),
    client.from("guide_locations").select("room_notes").limit(0),
    client.from("paint_records").select("swatch_hex,swatch_provenance").limit(0),
  ]);
  const failed = results.find((result) => result.error);
  if (failed) throw normalizeHomeownerDesignDatabaseError(failed.error);
}

export async function queryWithLegacyDesignColumns<T extends { error: unknown | null }>(
  currentQuery: () => PromiseLike<T>,
  legacyQuery: () => PromiseLike<T>,
): Promise<{ result: T; designFieldsAvailable: boolean }> {
  const current = await currentQuery();
  if (!current.error) return { result: current, designFieldsAvailable: true };
  const normalized = normalizeHomeownerDesignDatabaseError(current.error);
  if (!(normalized instanceof HomeownerDesignMigrationRequiredError)) throw current.error;
  const legacy = await legacyQuery();
  if (legacy.error) throw legacy.error;
  return { result: legacy, designFieldsAvailable: false };
}
