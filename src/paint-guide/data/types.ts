export type PaintGuideStatus = "draft" | "published" | "archived";

export type GuideLocationType =
  | "structure"
  | "floor"
  | "room"
  | "area"
  | "exterior"
  | "custom";

export type PaintRecordSection = "primary" | "exception" | "additional";

export type PaintGuide = {
  id: string;
  residence_name: string;
  status: PaintGuideStatus;
  primary_scope_note: string | null;
  created_at: string;
  updated_at: string;
};

export type GuideLocation = {
  id: string;
  guide_id: string;
  parent_id: string | null;
  location_type: GuideLocationType;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PaintRecord = {
  id: string;
  guide_id: string;
  section: PaintRecordSection;
  surface: string;
  brand: string | null;
  product: string | null;
  color_name: string;
  color_code: string | null;
  sheen: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PaintRecordLocation = {
  guide_id: string;
  paint_record_id: string;
  location_id: string;
};
