-- Proposal only; intentionally outside supabase/migrations so it cannot be
-- picked up by a normal migration run. Do not apply until reviewed.
-- Adds the six optional columns consumed by the existing app. Existing rows
-- receive NULL values; no rows, grants, RLS policies, or RPCs are changed.

begin;

alter table public.paint_guides
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists property_type text;

alter table public.guide_locations
  add column if not exists room_notes text;

alter table public.paint_records
  add column if not exists swatch_hex text,
  add column if not exists swatch_provenance text;

commit;

