import type { HomeownerGuide, HomeownerGuideLocation, HomeownerPaintRecord } from "./types.js";

export function propertyMetadata(guide: HomeownerGuide) {
  const place = [guide.city?.trim(), guide.state?.trim()].filter((value): value is string => Boolean(value));
  const propertyType = guide.property_type?.trim() || null;
  return { place: place.join(", ") || null, propertyType };
}

export function verifiedSwatchForRecord(record: HomeownerPaintRecord) {
  const hex = record.swatch_hex?.trim() ?? "";
  const provenance = record.swatch_provenance?.trim() ?? "";
  return /^#[\da-f]{6}$/i.test(hex) && provenance ? { hex, provenance } : null;
}

export function approximateCatalogSwatchForRecord(record: HomeownerPaintRecord) {
  const hex = record.color_reference_hex?.trim() ?? "";
  const brand = record.color_origin_brand?.trim() ?? "";
  const provider = record.color_reference_provider?.trim() ?? "";
  const url = record.color_reference_url?.trim() ?? "";
  const retrievedAt = record.color_reference_retrieved_at?.trim() ?? "";
  return /^#[\da-f]{6}$/i.test(hex) && ["Sherwin-Williams", "Benjamin Moore", "Farrow & Ball"].includes(brand) && provider === "PaintDB"
    && /^https:\/\/paintdb\.com\/colors\/\S+$/i.test(url) && Number.isFinite(Date.parse(retrievedAt))
    ? { hex, brand, provider, url, retrievedAt, provenance: `Approximate digital color reference from ${provider}, retrieved ${retrievedAt.slice(0, 10)}; not manufacturer-verified. Verify with a physical sample.` }
    : null;
}

export function roomNotesForLocation(location: HomeownerGuideLocation) {
  return location.room_notes?.trim() || null;
}

export function propertyFieldsToPersist(input: { city?: string; state?: string; propertyType?: string }) {
  return {
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    property_type: input.propertyType?.trim() || null,
  };
}

export function roomNotesFieldToPersist(roomNotes: string) {
  return roomNotes.trim() || null;
}

export function verifiedSwatchFieldsToPersist(input: { swatchHex: string; swatchProvenance: string }) {
  const swatchHex = input.swatchHex.trim();
  const swatchProvenance = input.swatchProvenance.trim();
  if (Boolean(swatchHex) !== Boolean(swatchProvenance) || (swatchHex && !/^#[\da-f]{6}$/i.test(swatchHex))) {
    throw new Error("A verified swatch needs a six-digit hex and its source.");
  }
  return { swatch_hex: swatchHex || null, swatch_provenance: swatchProvenance || null };
}
