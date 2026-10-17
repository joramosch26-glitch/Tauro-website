create schema if not exists paint_guide_private;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role text not null check (role in ('owner', 'supervisor')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create function paint_guide_private.set_profiles_updated_at()
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

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function paint_guide_private.set_profiles_updated_at();

-- These helpers bypass profiles RLS only to avoid recursive policy evaluation.
-- They derive identity exclusively from auth.uid() and accept no caller-supplied user ID.
create function paint_guide_private.is_paint_guide_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles
      where user_id = (select auth.uid())
        and active
        and role in ('owner', 'supervisor')
    );
$$;

create function paint_guide_private.is_paint_guide_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles
      where user_id = (select auth.uid())
        and active
        and role = 'owner'
    );
$$;

revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;

revoke all on schema paint_guide_private from public, anon, authenticated;
grant usage on schema paint_guide_private to authenticated;

revoke all on function paint_guide_private.set_profiles_updated_at() from public, anon, authenticated;
revoke all on function paint_guide_private.is_paint_guide_staff() from public, anon, authenticated;
revoke all on function paint_guide_private.is_paint_guide_owner() from public, anon, authenticated;
grant execute on function paint_guide_private.is_paint_guide_staff() to authenticated;
grant execute on function paint_guide_private.is_paint_guide_owner() to authenticated;

create policy "Staff can read their own profile and owners can read all profiles"
on public.profiles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select paint_guide_private.is_paint_guide_owner())
);
