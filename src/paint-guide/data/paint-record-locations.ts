import { supabase } from "../lib/supabase";
import type { PaintRecordLocation } from "./types";

const COLUMNS = "guide_id, paint_record_id, location_id";

function client() {
  if (!supabase) throw new Error("Paint Guide is not configured.");
  return supabase;
}

function uniqueIds(locationIds: string[]) {
  return [...new Set(locationIds)];
}

export async function listPaintRecordLocations(
  guideId: string,
): Promise<PaintRecordLocation[]> {
  const { data, error } = await client()
    .from("paint_record_locations")
    .select(COLUMNS)
    .eq("guide_id", guideId)
    .order("paint_record_id", { ascending: true })
    .order("location_id", { ascending: true });

  if (error) throw error;
  return (data ?? []) as PaintRecordLocation[];
}

export async function savePaintRecordLocations(
  guideId: string,
  paintRecordId: string,
  currentLocationIds: string[],
  nextLocationIds: string[],
): Promise<void> {
  const current = new Set(uniqueIds(currentLocationIds));
  const next = new Set(uniqueIds(nextLocationIds));
  const additions = [...next].filter((locationId) => !current.has(locationId));
  const removals = [...current].filter((locationId) => !next.has(locationId));

  if (additions.length) {
    const { data, error } = await client()
      .from("paint_record_locations")
      .insert(
        additions.map((locationId) => ({
          guide_id: guideId,
          paint_record_id: paintRecordId,
          location_id: locationId,
        })),
      )
      .select(COLUMNS);

    if (error || data?.length !== additions.length) {
      throw error ?? new Error("Could not save paint record locations.");
    }
  }

  if (removals.length) {
    const { data, error } = await client()
      .from("paint_record_locations")
      .delete()
      .eq("guide_id", guideId)
      .eq("paint_record_id", paintRecordId)
      .in("location_id", removals)
      .select(COLUMNS);

    if (error || data?.length !== removals.length) {
      throw error ?? new Error("Could not save paint record locations.");
    }
  }
}
