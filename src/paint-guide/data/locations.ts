import { supabase } from "../lib/supabase";
import type { GuideLocation, GuideLocationType } from "./types";

const COLUMNS = "id, guide_id, parent_id, location_type, name, sort_order, created_at, updated_at";

function client() {
  if (!supabase) throw new Error("Paint Guide is not configured.");
  return supabase;
}

export type CreateGuideLocationInput = {
  guideId: string;
  parentId: string | null;
  locationType: GuideLocationType;
  name: string;
  sortOrder: number;
};

export async function listGuideLocations(guideId: string): Promise<GuideLocation[]> {
  const { data, error } = await client().from("guide_locations").select(COLUMNS).eq("guide_id", guideId).order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as GuideLocation[];
}

export async function createGuideLocation(input: CreateGuideLocationInput): Promise<GuideLocation> {
  const { data, error } = await client().from("guide_locations").insert({ guide_id: input.guideId, parent_id: input.parentId, location_type: input.locationType, name: input.name, sort_order: input.sortOrder }).select(COLUMNS).single();
  if (error || !data) throw error ?? new Error("Could not add location.");
  return data as GuideLocation;
}

export async function updateGuideLocation(guideId: string, locationId: string, input: { name: string; locationType: GuideLocationType }): Promise<GuideLocation> {
  const { data, error } = await client().from("guide_locations").update({ name: input.name, location_type: input.locationType }).eq("id", locationId).eq("guide_id", guideId).select(COLUMNS).maybeSingle();
  if (error || !data) throw error ?? new Error("Could not save location.");
  return data as GuideLocation;
}

export async function deleteGuideLocation(guideId: string, locationId: string): Promise<void> {
  const { data, error } = await client().from("guide_locations").delete().eq("id", locationId).eq("guide_id", guideId).select("id");
  if (error || !data?.length) throw error ?? new Error("Could not delete location.");
}
