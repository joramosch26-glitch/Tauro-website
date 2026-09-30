import { supabase } from "../lib/supabase";
import type { PaintGuide, PaintGuideStatus } from "./types";

const PAINT_GUIDE_COLUMNS =
  "id, residence_name, status, primary_scope_note, created_at, updated_at";

export type CreatePaintGuideInput = {
  residenceName: string;
  primaryScopeNote: string;
};

export type UpdatePaintGuideInput = {
  residenceName: string;
  primaryScopeNote: string;
  status: PaintGuideStatus;
};

function requireSupabase() {
  if (!supabase) {
    throw new Error("Paint Guide is not configured.");
  }

  return supabase;
}

export async function listPaintGuides(): Promise<PaintGuide[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("paint_guides")
    .select(PAINT_GUIDE_COLUMNS)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as PaintGuide[];
}

export async function getPaintGuide(guideId: string): Promise<PaintGuide | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("paint_guides")
    .select(PAINT_GUIDE_COLUMNS)
    .eq("id", guideId)
    .maybeSingle();

  if (error) throw error;

  return (data as PaintGuide | null) ?? null;
}

export async function createPaintGuide(
  input: CreatePaintGuideInput,
): Promise<PaintGuide> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("paint_guides")
    .insert({
      residence_name: input.residenceName,
      primary_scope_note: input.primaryScopeNote || null,
      status: "draft",
    })
    .select(PAINT_GUIDE_COLUMNS)
    .single();

  if (error || !data) throw error ?? new Error("Could not create Paint Guide.");

  return data as PaintGuide;
}

export async function updatePaintGuide(
  guideId: string,
  input: UpdatePaintGuideInput,
): Promise<PaintGuide> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("paint_guides")
    .update({
      residence_name: input.residenceName,
      primary_scope_note: input.primaryScopeNote || null,
      status: input.status,
    })
    .eq("id", guideId)
    .select(PAINT_GUIDE_COLUMNS)
    .maybeSingle();

  if (error || !data) throw error ?? new Error("Could not save Paint Guide.");

  return data as PaintGuide;
}
