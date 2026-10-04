import type { HomeownerGuideDocumentData, HomeownerGuideLocation, HomeownerPaintRecord, HomeownerPaintRecordLocation, HomeownerPaintRecordSection } from "../presentation/types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function requiredString(value: unknown) { return typeof value === "string" ? value : null; }
function nullableString(value: unknown): string | null | undefined { return typeof value === "string" || value === null ? value : undefined; }
function finiteNumber(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function parseLocation(value: unknown): HomeownerGuideLocation | null {
  if (!isRecord(value)) return null;
  const id = requiredString(value.id); const parentId = nullableString(value.parent_id); const name = requiredString(value.name); const sortOrder = finiteNumber(value.sort_order); const createdAt = requiredString(value.created_at);
  return id !== null && parentId !== undefined && name !== null && sortOrder !== null && createdAt !== null ? { id, parent_id: parentId, name, sort_order: sortOrder, created_at: createdAt } : null;
}
function parseRecord(value: unknown): HomeownerPaintRecord | null {
  if (!isRecord(value)) return null;
  const id = requiredString(value.id); const section = value.section; const surface = requiredString(value.surface); const brand = nullableString(value.brand); const product = nullableString(value.product); const colorName = requiredString(value.color_name); const colorCode = nullableString(value.color_code); const sheen = nullableString(value.sheen); const notes = nullableString(value.notes); const sortOrder = finiteNumber(value.sort_order); const createdAt = requiredString(value.created_at);
  const validSection = section === "primary" || section === "exception" || section === "additional";
  return id !== null && validSection && surface !== null && colorName !== null && brand !== undefined && product !== undefined && colorCode !== undefined && sheen !== undefined && notes !== undefined && sortOrder !== null && createdAt !== null ? { id, section: section as HomeownerPaintRecordSection, surface, brand, product, color_name: colorName, color_code: colorCode, sheen, notes, sort_order: sortOrder, created_at: createdAt } : null;
}
function parseAssignment(value: unknown): HomeownerPaintRecordLocation | null {
  if (!isRecord(value)) return null;
  const paintRecordId = requiredString(value.paint_record_id); const locationId = requiredString(value.location_id);
  return paintRecordId !== null && locationId !== null ? { paint_record_id: paintRecordId, location_id: locationId } : null;
}
function parseArray<T>(value: unknown, parse: (item: unknown) => T | null) {
  if (!Array.isArray(value)) return null;
  const parsed = value.map(parse);
  return parsed.every((item): item is T => item !== null) ? parsed : null;
}
export function parseHomeownerGuideDocument(value: unknown): HomeownerGuideDocumentData | null {
  if (!isRecord(value) || !isRecord(value.guide)) return null;
  const residenceName = requiredString(value.guide.residence_name); const primaryScopeNote = nullableString(value.guide.primary_scope_note); const locations = parseArray(value.locations, parseLocation); const records = parseArray(value.records, parseRecord); const assignments = parseArray(value.assignments, parseAssignment);
  return value.schema_version === 1 && residenceName !== null && primaryScopeNote !== undefined && locations !== null && records !== null && assignments !== null ? { guide: { residence_name: residenceName, primary_scope_note: primaryScopeNote }, locations, records, assignments } : null;
}
