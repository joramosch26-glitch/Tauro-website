/**
 * Optional presentation-only values. These are not part of the homeowner DTO,
 * persisted data, or any database contract. Swatches require a record identity,
 * a six-digit digital color, and provenance supplied by a trusted caller.
 */
export type VerifiedRoomSwatch = {
  recordId: string;
  hex: string;
  provenance: string;
};

export function verifiedRoomSwatchFor(recordId: string, swatches: readonly VerifiedRoomSwatch[] = []) {
  return swatches.find(swatch =>
    swatch &&
    swatch.recordId === recordId &&
    typeof swatch.hex === "string" &&
    typeof swatch.provenance === "string" &&
    /^#[\da-f]{6}$/i.test(swatch.hex.trim()) &&
    swatch.provenance.trim().length > 0,
  ) ?? null;
}
