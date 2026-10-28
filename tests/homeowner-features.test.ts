import test from "node:test";
import assert from "node:assert/strict";
import { approximateCatalogSwatchForRecord, propertyFieldsToPersist, propertyMetadata, roomNotesFieldToPersist, roomNotesForLocation, verifiedSwatchFieldsToPersist, verifiedSwatchForRecord } from "../src/paint-guide/presentation/homeowner-features.js";
import { assertHomeownerDesignSchemaAvailable, HomeownerDesignMigrationRequiredError, homeownerDesignErrorMessage, normalizeHomeownerDesignDatabaseError, queryWithLegacyDesignColumns } from "../src/paint-guide/data/homeowner-design-schema.js";

test("property row uses only configured values and keeps legacy documents empty", () => {
  assert.deepEqual(propertyMetadata({ residence_name: "Sample", primary_scope_note: null }), { place: null, propertyType: null });
  assert.deepEqual(propertyMetadata({ residence_name: "Sample", primary_scope_note: null, city: " Provo ", state: "UT", property_type: "Residence" }), { place: "Provo, UT", propertyType: "Residence" });
});

test("swatches require both a valid digital color and a stated source", () => {
  const record = { id: "r1", section: "primary" as const, surface: "Walls", brand: null, product: null, color_name: "Sample White", color_code: null, sheen: null, notes: null, sort_order: 0, created_at: "2026-01-01" };
  assert.equal(verifiedSwatchForRecord(record), null);
  assert.equal(verifiedSwatchForRecord({ ...record, swatch_hex: "red", swatch_provenance: "guess" }), null);
  assert.deepEqual(verifiedSwatchForRecord({ ...record, swatch_hex: "#f0e8d0", swatch_provenance: "Staff verified from the recorded product label" }), { hex: "#f0e8d0", provenance: "Staff verified from the recorded product label" });
});

test("catalog swatch is separately labeled approximate and requires a valid provider and origin", () => {
  const record = { id: "r1", section: "primary" as const, surface: "Walls", brand: "Sherwin-Williams", product: "SuperPaint", color_name: "White Dove", color_code: "OC-17", sheen: "Satin", notes: null, sort_order: 0, created_at: "2026-01-01", color_origin_brand: "Benjamin Moore", color_reference_hex: "#EFEEE5", color_reference_provider: "PaintDB", color_reference_url: "https://paintdb.com/colors/benjamin-moore/bm-oc-17-white-dove", color_reference_retrieved_at: "2026-10-28T12:00:00.000Z" };
  assert.deepEqual(approximateCatalogSwatchForRecord(record), {
    hex: "#EFEEE5", brand: "Benjamin Moore", provider: "PaintDB",
    url: "https://paintdb.com/colors/benjamin-moore/bm-oc-17-white-dove",
    retrievedAt: "2026-10-28T12:00:00.000Z",
    provenance: "Approximate digital color reference from PaintDB, retrieved 2026-10-28; not manufacturer-verified. Verify with a physical sample.",
  });
  assert.equal(approximateCatalogSwatchForRecord({ ...record, color_reference_hex: "ivory" }), null);
  assert.equal(approximateCatalogSwatchForRecord({ ...record, color_reference_provider: null }), null);
});

test("room notes stay attached to their own location and empty notes stay absent", () => {
  const room = { id: "r1", parent_id: null, name: "Kitchen", sort_order: 0, created_at: "2026-01-01", room_notes: "Keep the trim satin." };
  const hall = { ...room, id: "r2", name: "Hall", room_notes: null };
  assert.equal(roomNotesForLocation(room), "Keep the trim satin.");
  assert.equal(roomNotesForLocation(hall), null);
});

test("staff field serialization roundtrips property, room notes, and verified swatch values", () => {
  const persistedGuide = { residence_name: "Sample", primary_scope_note: null, ...propertyFieldsToPersist({ city: " Sample City ", state: " UT ", propertyType: " Sample Residence " }) };
  const persistedRoom = { id: "room-a", parent_id: null, name: "Kitchen", sort_order: 0, created_at: "2026-01-01", room_notes: roomNotesFieldToPersist(" Keep trim satin. ") };
  const persistedRecord = { id: "record-a", section: "primary" as const, surface: "Walls", brand: null, product: null, color_name: "Sample", color_code: null, sheen: null, notes: null, sort_order: 0, created_at: "2026-01-01", ...verifiedSwatchFieldsToPersist({ swatchHex: " #d9c8a8 ", swatchProvenance: " Staff label verification " }) };
  assert.equal(propertyMetadata(persistedGuide).place, "Sample City, UT");
  assert.equal(propertyMetadata(persistedGuide).propertyType, "Sample Residence");
  assert.equal(roomNotesForLocation(persistedRoom), "Keep trim satin.");
  assert.deepEqual(verifiedSwatchForRecord(persistedRecord), { hex: "#d9c8a8", provenance: "Staff label verification" });
  assert.throws(() => verifiedSwatchFieldsToPersist({ swatchHex: "red", swatchProvenance: "guess" }));
});

test("missing new design columns fail closed with a migration-required message", () => {
  const error = { code: "42703", message: "column guide_locations.room_notes does not exist" };
  assert.ok(normalizeHomeownerDesignDatabaseError(error) instanceof HomeownerDesignMigrationRequiredError);
  assert.match(homeownerDesignErrorMessage(error, "generic"), /apply the homeowner design migration/i);
  const permissionError = { code: "42501", message: "permission denied" };
  assert.equal(normalizeHomeownerDesignDatabaseError(permissionError), permissionError);
});

test("schema preflight checks all new columns before a caller can mutate", async () => {
  const probed: string[] = [];
  let mutationCount = 0;
  const mock = { from(table: string) { probed.push(table); return { select() { return { async limit() { return { error: table === "paint_records" ? { code: "PGRST204", message: "Could not find the 'swatch_hex' column in schema cache" } : null }; } }; } }; } };
  await assert.rejects(async () => { await assertHomeownerDesignSchemaAvailable(mock); mutationCount++; }, HomeownerDesignMigrationRequiredError);
  assert.deepEqual(probed.sort(), ["guide_locations", "paint_guides", "paint_records"]);
  assert.equal(mutationCount, 0);
});

test("legacy reads retry only missing-column errors and preserve permission failures", async () => {
  let legacyReads = 0;
  type QueryResult = { data: Array<{ residence_name: string }> | null; error: { code: string; message: string } | null };
  const fallback = await queryWithLegacyDesignColumns<QueryResult>(
    async () => ({ data: null, error: { code: "42703", message: "column paint_guides.city does not exist" } }),
    async () => { legacyReads++; return { data: [{ residence_name: "Existing synthetic guide" }], error: null }; },
  );
  assert.equal(fallback.designFieldsAvailable, false);
  assert.equal(fallback.result.data?.[0]?.residence_name, "Existing synthetic guide");
  assert.equal(legacyReads, 1);

  const permissionRead = queryWithLegacyDesignColumns<QueryResult>(
    async () => ({ data: null, error: { code: "42501", message: "permission denied" } }),
    async () => { legacyReads++; return { data: [], error: null }; },
  );
  await assert.rejects(permissionRead, (error: { code?: string }) => error.code === "42501");
  assert.equal(legacyReads, 1);
});
