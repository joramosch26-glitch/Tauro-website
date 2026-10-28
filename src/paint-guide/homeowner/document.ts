import type { HomeownerGuideDocumentData, HomeownerGuideLocation, HomeownerGuidePhoto, HomeownerPaintRecord, HomeownerPaintRecordLocation, HomeownerPaintRecordSection } from "../presentation/types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
function requiredString(value: unknown) { return typeof value === "string" ? value : null; }
function nullableString(value: unknown): string | null | undefined { return typeof value === "string" || value === null ? value : undefined; }
function finiteNumber(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function parseLocation(value: unknown): HomeownerGuideLocation | null {
  if (!isRecord(value)) return null;
  const id = requiredString(value.id); const parentId = nullableString(value.parent_id); const name = requiredString(value.name); const sortOrder = finiteNumber(value.sort_order); const createdAt = requiredString(value.created_at);
  const roomNotes = nullableString(value.room_notes);
  const validRoomNotesShape = !hasOwn(value, "room_notes") || roomNotes !== undefined;
  return id !== null && parentId !== undefined && name !== null && sortOrder !== null && createdAt !== null && validRoomNotesShape ? { id, parent_id: parentId, name, sort_order: sortOrder, created_at: createdAt, ...(roomNotes === undefined ? {} : { room_notes: roomNotes }) } : null;
}
function parseRecord(value: unknown): HomeownerPaintRecord | null {
  if (!isRecord(value)) return null;
  const id = requiredString(value.id); const section = value.section; const surface = requiredString(value.surface); const brand = nullableString(value.brand); const product = nullableString(value.product); const colorName = requiredString(value.color_name); const colorCode = nullableString(value.color_code); const swatchHex = nullableString(value.swatch_hex); const swatchProvenance = nullableString(value.swatch_provenance); const colorOriginBrand = nullableString(value.color_origin_brand); const colorReferenceHex = nullableString(value.color_reference_hex); const colorReferenceProvider = nullableString(value.color_reference_provider); const colorReferenceUrl = nullableString(value.color_reference_url); const colorReferenceRetrievedAt = nullableString(value.color_reference_retrieved_at); const sheen = nullableString(value.sheen); const notes = nullableString(value.notes); const sortOrder = finiteNumber(value.sort_order); const createdAt = requiredString(value.created_at);
  const validSection = section === "primary" || section === "exception" || section === "additional";
  const validHex = swatchHex === undefined || swatchHex === null || /^#[\da-f]{6}$/i.test(swatchHex);
  const validProvenancePair = (swatchHex == null) === (swatchProvenance == null);
  const validSwatchShape = (!hasOwn(value, "swatch_hex") && !hasOwn(value, "swatch_provenance")) || (swatchHex !== undefined && swatchProvenance !== undefined);
  const validCatalogHex = colorReferenceHex === undefined || colorReferenceHex === null || /^#[\da-f]{6}$/i.test(colorReferenceHex);
  const catalogFields = ["color_origin_brand", "color_reference_hex", "color_reference_provider", "color_reference_url", "color_reference_retrieved_at"];
  const hasCatalogReference = catalogFields.some((key) => hasOwn(value, key));
  const validCatalogShape = !hasCatalogReference || catalogFields.every((key) => hasOwn(value, key) && nullableString(value[key]) !== undefined);
  const validCatalogValues = !hasCatalogReference
    || (colorOriginBrand === null && colorReferenceHex === null && colorReferenceProvider === null && colorReferenceUrl === null && colorReferenceRetrievedAt === null)
    || (typeof colorOriginBrand === "string" && ["Sherwin-Williams", "Benjamin Moore", "Farrow & Ball"].includes(colorOriginBrand)
      && typeof colorReferenceHex === "string" && /^#[\da-f]{6}$/i.test(colorReferenceHex) && colorReferenceProvider === "PaintDB"
      && typeof colorReferenceUrl === "string" && /^https:\/\/paintdb\.com\/colors\/\S+$/i.test(colorReferenceUrl)
      && typeof colorReferenceRetrievedAt === "string" && Number.isFinite(Date.parse(colorReferenceRetrievedAt)));
  return id !== null && validSection && surface !== null && colorName !== null && brand !== undefined && product !== undefined && colorCode !== undefined && validSwatchShape && validHex && validProvenancePair && validCatalogHex && validCatalogShape && validCatalogValues && sheen !== undefined && notes !== undefined && sortOrder !== null && createdAt !== null ? { id, section: section as HomeownerPaintRecordSection, surface, brand, product, color_name: colorName, color_code: colorCode, ...(swatchHex === undefined ? {} : { swatch_hex: swatchHex }), ...(swatchProvenance === undefined ? {} : { swatch_provenance: swatchProvenance }), ...(colorOriginBrand === undefined ? {} : { color_origin_brand: colorOriginBrand }), ...(colorReferenceHex === undefined ? {} : { color_reference_hex: colorReferenceHex }), ...(colorReferenceProvider === undefined ? {} : { color_reference_provider: colorReferenceProvider }), ...(colorReferenceUrl === undefined ? {} : { color_reference_url: colorReferenceUrl }), ...(colorReferenceRetrievedAt === undefined ? {} : { color_reference_retrieved_at: colorReferenceRetrievedAt }), sheen, notes, sort_order: sortOrder, created_at: createdAt } : null;
}
function parseAssignment(value: unknown): HomeownerPaintRecordLocation | null {
  if (!isRecord(value)) return null;
  const paintRecordId = requiredString(value.paint_record_id); const locationId = requiredString(value.location_id);
  return paintRecordId !== null && locationId !== null ? { paint_record_id: paintRecordId, location_id: locationId } : null;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function parsePhoto(value: unknown): HomeownerGuidePhoto | null {
  if (!isRecord(value)) return null;
  const photoKeys = Object.keys(value);
  if (photoKeys.length !== 5 || !photoKeys.every(key => ["slot_id", "version_id", "placement_kind", "location_id", "paint_record_id"].includes(key))) return null;
  const { slot_id, version_id, placement_kind, location_id, paint_record_id } = value;
  if (typeof slot_id !== "string" || !UUID.test(slot_id) || typeof version_id !== "string" || !UUID.test(version_id)
    || (placement_kind !== "residence_cover" && placement_kind !== "location" && placement_kind !== "record_context" && placement_kind !== "record_formula_label")
    || !(location_id === null || (typeof location_id === "string" && UUID.test(location_id)))
    || !(paint_record_id === null || (typeof paint_record_id === "string" && UUID.test(paint_record_id)))
    || (placement_kind === "record_formula_label" && (location_id !== null || paint_record_id === null))
    || (placement_kind === "record_context" && (location_id === null || paint_record_id === null))
    || (placement_kind === "location" && (location_id === null || paint_record_id !== null))
    || (placement_kind === "residence_cover" && (location_id !== null || paint_record_id !== null))) return null;
  return { slot_id, version_id, placement_kind, location_id, paint_record_id };
}
function parseArray<T>(value: unknown, parse: (item: unknown) => T | null) {
  if (!Array.isArray(value)) return null;
  const parsed = value.map(parse);
  return parsed.every((item): item is T => item !== null) ? parsed : null;
}
export function parseHomeownerGuideDocument(value: unknown): HomeownerGuideDocumentData | null {
  if (!isRecord(value) || !isRecord(value.guide)) return null;
  const residenceName = requiredString(value.guide.residence_name); const primaryScopeNote = nullableString(value.guide.primary_scope_note); const city = nullableString(value.guide.city); const state = nullableString(value.guide.state); const propertyType = nullableString(value.guide.property_type); const locations = parseArray(value.locations, parseLocation); const records = parseArray(value.records, parseRecord); const assignments = parseArray(value.assignments, parseAssignment);
  const keys = Object.keys(value);
  const photos = value.photos === undefined ? undefined : parseArray(value.photos, parsePhoto);
  const uniquePhotoPlacements = photos === undefined ? true : photos !== null
    && new Set(photos.map(photo => `${photo.placement_kind}:${photo.location_id ?? ""}:${photo.paint_record_id ?? ""}`)).size === photos.length;
  return keys.length >= 4 && keys.length <= 5 && keys.every((key) => ["guide", "locations", "records", "assignments", "photos"].includes(key)) && (photos !== null) && uniquePhotoPlacements && residenceName !== null && primaryScopeNote !== undefined && locations !== null && records !== null && assignments !== null
    ? { guide: { residence_name: residenceName, primary_scope_note: primaryScopeNote, ...(city === undefined ? {} : { city }), ...(state === undefined ? {} : { state }), ...(propertyType === undefined ? {} : { property_type: propertyType }) }, locations, records, assignments, ...(photos === undefined ? {} : { photos }) }
    : null;
}
