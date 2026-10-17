export type HomeownerPaintRecordSection = "primary" | "exception" | "additional";

export type HomeownerGuide = {
  residence_name: string;
  primary_scope_note: string | null;
};

export type HomeownerGuideLocation = {
  id: string;
  parent_id: string | null;
  name: string;
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
  sheen: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
};

export type HomeownerPaintRecordLocation = {
  paint_record_id: string;
  location_id: string;
};

export type HomeownerGuideDocumentData = {
  guide: HomeownerGuide;
  locations: HomeownerGuideLocation[];
  records: HomeownerPaintRecord[];
  assignments: HomeownerPaintRecordLocation[];
};
