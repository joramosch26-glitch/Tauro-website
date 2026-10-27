export type HomeownerPaintRecordSection = "primary" | "exception" | "additional";

export type HomeownerGuide = {
  residence_name: string;
  primary_scope_note: string | null;
  city?: string | null;
  state?: string | null;
  property_type?: string | null;
};

export type HomeownerGuideLocation = {
  id: string;
  parent_id: string | null;
  name: string;
  room_notes?: string | null;
  sort_order: number;
  created_at: string;
};

export type HomeownerPaintRecord = {
  id: string;
  section: HomeownerPaintRecordSection;
  surface: string;
  brand: string | null;
  product: string | null;
  color_name: string;
  color_code: string | null;
  swatch_hex?: string | null;
  swatch_provenance?: string | null;
  sheen: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
};

export type HomeownerPaintRecordLocation = {
  paint_record_id: string;
  location_id: string;
};

export type HomeownerGuidePhoto = {
  slot_id: string;
  version_id: string;
  placement_kind: "residence_cover" | "location" | "record_context" | "record_formula_label";
  location_id: string | null;
  paint_record_id: string | null;
};

export type HomeownerGuideDocumentData = {
  guide: HomeownerGuide;
  locations: HomeownerGuideLocation[];
  records: HomeownerPaintRecord[];
  assignments: HomeownerPaintRecordLocation[];
  /** Opaque IDs for current protected photos; omitted by legacy documents. */
  photos?: HomeownerGuidePhoto[];
};
