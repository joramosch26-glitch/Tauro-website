import type { GuideLocation } from "./types";

type OrderedLocation = Pick<GuideLocation, "id" | "sort_order" | "created_at">;

// A final unique key keeps persisted rows and local editor updates in the same
// order when concurrent locations share a sort position and creation timestamp.
export function compareGuideLocations(a: OrderedLocation, b: OrderedLocation) {
  return a.sort_order - b.sort_order
    || a.created_at.localeCompare(b.created_at)
    || a.id.localeCompare(b.id);
}
