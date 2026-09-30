create table public.paint_guides (
  id uuid primary key default gen_random_uuid(),
  residence_name text not null
    constraint paint_guides_residence_name_not_blank
    check (residence_name ~ '[^[:space:]]'),
  status text not null default 'draft'
    constraint paint_guides_status_check
    check (status in ('draft', 'published', 'archived')),
  primary_scope_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.guide_locations (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null
    references public.paint_guides (id) on delete cascade,
  parent_id uuid,
  location_type text not null
    constraint guide_locations_location_type_check
    check (
      location_type in ('structure', 'floor', 'room', 'area', 'exterior', 'custom')
    ),
  name text not null
    constraint guide_locations_name_not_blank
    check (name ~ '[^[:space:]]'),
  sort_order integer not null default 0
    constraint guide_locations_sort_order_nonnegative
    check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guide_locations_guide_id_id_key unique (guide_id, id),
  constraint guide_locations_parent_same_guide_fkey
    foreign key (guide_id, parent_id)
    references public.guide_locations (guide_id, id)
    on delete cascade
);

create table public.paint_records (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null
    references public.paint_guides (id) on delete cascade,
  section text not null
    constraint paint_records_section_check
    check (section in ('primary', 'exception', 'additional')),
  surface text not null
    constraint paint_records_surface_not_blank
    check (surface ~ '[^[:space:]]'),
  brand text,
  product text,
  color_name text not null
    constraint paint_records_color_name_not_blank
    check (color_name ~ '[^[:space:]]'),
  color_code text,
  sheen text,
  notes text,
  sort_order integer not null default 0
    constraint paint_records_sort_order_nonnegative
    check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paint_records_guide_id_id_key unique (guide_id, id)
);

create table public.paint_record_locations (
  guide_id uuid not null,
  paint_record_id uuid not null,
  location_id uuid not null,
  constraint paint_record_locations_pkey
    primary key (guide_id, paint_record_id, location_id),
  constraint paint_record_locations_record_same_guide_fkey
    foreign key (guide_id, paint_record_id)
    references public.paint_records (guide_id, id)
    on delete cascade,
  constraint paint_record_locations_location_same_guide_fkey
    foreign key (guide_id, location_id)
    references public.guide_locations (guide_id, id)
    on delete cascade
);

-- The composite UNIQUE constraints above both support these foreign keys and
-- make cross-guide parent or record/location relationships impossible.
create index guide_locations_parent_idx
on public.guide_locations (guide_id, parent_id);

create index paint_record_locations_guide_location_idx
on public.paint_record_locations (guide_id, location_id);

create function paint_guide_private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_paint_guides_updated_at
before update on public.paint_guides
for each row
execute function paint_guide_private.set_updated_at();

create trigger set_guide_locations_updated_at
before update on public.guide_locations
for each row
execute function paint_guide_private.set_updated_at();

create trigger set_paint_records_updated_at
before update on public.paint_records
for each row
execute function paint_guide_private.set_updated_at();

revoke all on function paint_guide_private.set_updated_at()
from public, anon, authenticated;

alter table public.paint_guides enable row level security;
alter table public.guide_locations enable row level security;
alter table public.paint_records enable row level security;
alter table public.paint_record_locations enable row level security;

revoke all on table public.paint_guides from public, anon, authenticated;
revoke all on table public.guide_locations from public, anon, authenticated;
revoke all on table public.paint_records from public, anon, authenticated;
revoke all on table public.paint_record_locations from public, anon, authenticated;

grant select, insert, update, delete on table public.paint_guides to authenticated;
grant select, insert, update, delete on table public.guide_locations to authenticated;
grant select, insert, update, delete on table public.paint_records to authenticated;
grant select, insert, update, delete on table public.paint_record_locations
to authenticated;

create policy "Active staff can read paint guides"
on public.paint_guides
for select
to authenticated
using ((select paint_guide_private.is_paint_guide_staff()));

create policy "Active staff can create paint guides"
on public.paint_guides
for insert
to authenticated
with check ((select paint_guide_private.is_paint_guide_staff()));

create policy "Active staff can update paint guides"
on public.paint_guides
for update
to authenticated
using ((select paint_guide_private.is_paint_guide_staff()))
with check ((select paint_guide_private.is_paint_guide_staff()));

create policy "Active owners can delete paint guides"
on public.paint_guides
for delete
to authenticated
using ((select paint_guide_private.is_paint_guide_owner()));

create policy "Active staff can read guide locations"
on public.guide_locations
for select
to authenticated
using ((select paint_guide_private.is_paint_guide_staff()));

create policy "Active staff can create guide locations"
on public.guide_locations
for insert
to authenticated
with check ((select paint_guide_private.is_paint_guide_staff()));

create policy "Active staff can update guide locations"
on public.guide_locations
for update
to authenticated
using ((select paint_guide_private.is_paint_guide_staff()))
with check ((select paint_guide_private.is_paint_guide_staff()));

create policy "Active staff can delete guide locations"
on public.guide_locations
for delete
to authenticated
using ((select paint_guide_private.is_paint_guide_staff()));

create policy "Active staff can read paint records"
on public.paint_records
for select
to authenticated
using ((select paint_guide_private.is_paint_guide_staff()));

create policy "Active staff can create paint records"
on public.paint_records
for insert
to authenticated
with check ((select paint_guide_private.is_paint_guide_staff()));

create policy "Active staff can update paint records"
on public.paint_records
for update
to authenticated
using ((select paint_guide_private.is_paint_guide_staff()))
with check ((select paint_guide_private.is_paint_guide_staff()));

create policy "Active staff can delete paint records"
on public.paint_records
for delete
to authenticated
using ((select paint_guide_private.is_paint_guide_staff()));

create policy "Active staff can read paint record locations"
on public.paint_record_locations
for select
to authenticated
using ((select paint_guide_private.is_paint_guide_staff()));

create policy "Active staff can create paint record locations"
on public.paint_record_locations
for insert
to authenticated
with check ((select paint_guide_private.is_paint_guide_staff()));

create policy "Active staff can delete paint record locations"
on public.paint_record_locations
for delete
to authenticated
using ((select paint_guide_private.is_paint_guide_staff()));
