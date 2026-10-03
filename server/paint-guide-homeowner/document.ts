/** Runtime boundary for the exact JSONB emitted by homeowner_document_read. */
export type HomeownerGuideDocumentData = {
  guide: { residence_name: string; primary_scope_note: string | null };
  locations: Array<{ id: string; parent_id: string | null; name: string; sort_order: number; created_at: string }>;
  records: Array<{ id: string; section: "primary" | "exception" | "additional"; surface: string; brand: string | null; product: string | null; color_name: string; color_code: string | null; sheen: string | null; notes: string | null; sort_order: number; created_at: string }>;
  assignments: Array<{ paint_record_id: string; location_id: string }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function exactObject(value: unknown, keys: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return null;
  const object = value as Record<string, unknown>;
  const actualKeys = Object.keys(object);
  return actualKeys.length === keys.length && actualKeys.every((key) => keys.includes(key)) ? object : null;
}
function nullableString(value: unknown): value is string | null { return value === null || typeof value === "string"; }
function uuid(value: unknown): value is string { return typeof value === "string" && UUID.test(value); }
function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}
function sortOrder(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 2147483647;
}

function guideValue(value: unknown): HomeownerGuideDocumentData["guide"] | null {
  const guide = exactObject(value, ["residence_name", "primary_scope_note"]);
  return guide && typeof guide.residence_name === "string" && nullableString(guide.primary_scope_note)
    ? { residence_name: guide.residence_name, primary_scope_note: guide.primary_scope_note } : null;
}
function locationsValue(value: unknown): HomeownerGuideDocumentData["locations"] | null {
  if (!Array.isArray(value)) return null;
  const locations: HomeownerGuideDocumentData["locations"] = [];
  for (const valueItem of value) {
    const item = exactObject(valueItem, ["id", "parent_id", "name", "sort_order", "created_at"]);
    if (!item || !uuid(item.id) || !(item.parent_id === null || uuid(item.parent_id)) || typeof item.name !== "string" || !sortOrder(item.sort_order) || !timestamp(item.created_at)) return null;
    locations.push({ id: item.id, parent_id: item.parent_id, name: item.name, sort_order: item.sort_order, created_at: item.created_at });
  }
  return locations;
}
function recordsValue(value: unknown): HomeownerGuideDocumentData["records"] | null {
  if (!Array.isArray(value)) return null;
  const records: HomeownerGuideDocumentData["records"] = [];
  for (const valueItem of value) {
    const item = exactObject(valueItem, ["id", "section", "surface", "brand", "product", "color_name", "color_code", "sheen", "notes", "sort_order", "created_at"]);
    if (!item || !uuid(item.id) || (item.section !== "primary" && item.section !== "exception" && item.section !== "additional") || typeof item.surface !== "string" || !nullableString(item.brand) || !nullableString(item.product) || typeof item.color_name !== "string" || !nullableString(item.color_code) || !nullableString(item.sheen) || !nullableString(item.notes) || !sortOrder(item.sort_order) || !timestamp(item.created_at)) return null;
    records.push({ id: item.id, section: item.section, surface: item.surface, brand: item.brand, product: item.product, color_name: item.color_name, color_code: item.color_code, sheen: item.sheen, notes: item.notes, sort_order: item.sort_order, created_at: item.created_at });
  }
  return records;
}
function assignmentsValue(value: unknown): HomeownerGuideDocumentData["assignments"] | null {
  if (!Array.isArray(value)) return null;
  const assignments: HomeownerGuideDocumentData["assignments"] = [];
  for (const valueItem of value) {
    const item = exactObject(valueItem, ["paint_record_id", "location_id"]);
    if (!item || !uuid(item.paint_record_id) || !uuid(item.location_id)) return null;
    assignments.push({ paint_record_id: item.paint_record_id, location_id: item.location_id });
  }
  return assignments;
}

export function validateHomeownerGuideDocument(value: unknown): HomeownerGuideDocumentData | null {
  const document = exactObject(value, ["schema_version", "guide", "locations", "records", "assignments"]);
  if (!document || document.schema_version !== 1) return null;
  const guide = guideValue(document.guide);
  const locations = locationsValue(document.locations);
  const records = recordsValue(document.records);
  const assignments = assignmentsValue(document.assignments);
  return guide && locations && records && assignments ? { guide, locations, records, assignments } : null;
}
