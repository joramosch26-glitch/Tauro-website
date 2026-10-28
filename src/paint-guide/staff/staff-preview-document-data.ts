import type { GuideLocation, PaintGuide, PaintRecord, PaintRecordLocation } from "../data/types.js";
import type { HomeownerGuideDocumentData } from "../presentation/types.js";

export function buildStaffPreviewDocumentData(
  guide: PaintGuide,
  locations: readonly GuideLocation[],
  records: readonly PaintRecord[],
  assignments: readonly PaintRecordLocation[],
): HomeownerGuideDocumentData {
  return {
    guide: {
      residence_name: guide.residence_name,
      primary_scope_note: guide.primary_scope_note,
    },
    locations: locations.map(({ id, parent_id, name, sort_order, created_at }) => ({
      id, parent_id, name, sort_order, created_at,
    })),
    records: records.map(({
      id, section, surface, brand, product, color_name, color_code,
      color_origin_brand, color_reference_hex, color_reference_provider,
      color_reference_url, color_reference_retrieved_at,
      sheen, notes, sort_order, created_at,
    }) => ({
      id, section, surface, brand, product, color_name, color_code,
      color_origin_brand, color_reference_hex, color_reference_provider,
      color_reference_url, color_reference_retrieved_at,
      sheen, notes, sort_order, created_at,
    })),
    assignments: assignments.map(({ paint_record_id, location_id }) => ({
      paint_record_id, location_id,
    })),
  };
}
