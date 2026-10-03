-- Phase 3H.2A: LOCAL migration only. Target: Tauro Paint Guide Dev
-- (hgfgnfhfqqetxjhasbbe). Apply only in a separately authorized phase.
-- No plaintext QR/session credentials or cryptographic keys enter these functions.
-- All bytea inputs are server-computed HMACs or AES-256-GCM ciphertext/material.
-- The future server MUST authenticate its staff JWT before supplying p_actor_id.
-- Function ACLs trust service_role as the backend boundary, not browser identity.
-- Keep paint_guide_private OUTSIDE PostgREST exposed schemas. This migration
-- does not alter exposed-schema configuration or existing browser helper USAGE.
begin;

create table paint_guide_private.homeowner_access_tokens (
  guide_id uuid primary key references public.paint_guides (id) on delete cascade,
  format_version smallint not null default 1 check (format_version = 1),
  token_generation bigint not null default 1 check (token_generation >= 1),
  session_epoch bigint not null default 1 check (session_epoch >= 1),
  lookup_key_version smallint not null check (lookup_key_version >= 1),
  token_hmac bytea not null check (octet_length(token_hmac) = 32),
  encryption_key_version smallint not null check (encryption_key_version >= 1),
  -- Ciphertext representation belongs to the versioned server contract.
  -- Do not constrain its length to today's canonical token representation.
  token_ciphertext bytea not null,
  encryption_nonce bytea not null check (octet_length(encryption_nonce) = 12),
  encryption_tag bytea not null check (octet_length(encryption_tag) = 16),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now() check (updated_at >= created_at),
  created_by uuid references public.profiles (user_id) on delete set null,
  rotated_at timestamptz check (rotated_at is null or rotated_at >= created_at),
  rotated_by uuid references public.profiles (user_id) on delete set null,
  revoked_at timestamptz check (revoked_at is null or revoked_at >= created_at),
  revoked_by uuid references public.profiles (user_id) on delete set null,
  unique (lookup_key_version, token_hmac),
  unique (encryption_key_version, encryption_nonce)
);

create table paint_guide_private.homeowner_sessions (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references
    paint_guide_private.homeowner_access_tokens (guide_id) on delete cascade,
  token_generation bigint not null check (token_generation >= 1),
  session_epoch bigint not null check (session_epoch >= 1),
  session_key_version smallint not null check (session_key_version >= 1),
  session_hmac bytea not null check (octet_length(session_hmac) = 32),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz check (revoked_at is null or revoked_at >= created_at),
  unique (session_key_version, session_hmac),
  check (expires_at > created_at),
  check (expires_at <= created_at + interval '30 minutes')
);

create index homeowner_access_tokens_created_by_idx
  on paint_guide_private.homeowner_access_tokens (created_by);
create index homeowner_access_tokens_rotated_by_idx
  on paint_guide_private.homeowner_access_tokens (rotated_by);
create index homeowner_access_tokens_revoked_by_idx
  on paint_guide_private.homeowner_access_tokens (revoked_by);

create index homeowner_sessions_expires_at_idx
  on paint_guide_private.homeowner_sessions (expires_at);
create index homeowner_sessions_guide_generation_epoch_idx
  on paint_guide_private.homeowner_sessions (guide_id, token_generation, session_epoch);

alter table paint_guide_private.homeowner_access_tokens owner to postgres;
alter table paint_guide_private.homeowner_sessions owner to postgres;
alter table paint_guide_private.homeowner_access_tokens enable row level security;
alter table paint_guide_private.homeowner_sessions enable row level security;
-- No policies: browser roles are denied even if an object is exposed accidentally.
revoke all on table paint_guide_private.homeowner_access_tokens
  from public, anon, authenticated, service_role;
revoke all on table paint_guide_private.homeowner_sessions
  from public, anon, authenticated, service_role;

grant usage on schema paint_guide_private to service_role;
-- Core data is read-only for the new backend grant; do not broaden core writes.
grant select on table public.paint_guides, public.guide_locations,
  public.paint_records, public.paint_record_locations, public.profiles to service_role;
-- Access material is issued/rotated/revoked, never deleted by these RPCs.
grant select, insert, update on table
  paint_guide_private.homeowner_access_tokens to service_role;
-- Sessions are issued/read here. Per-session logout and cleanup are later phases.
grant select, insert on table paint_guide_private.homeowner_sessions to service_role;

-- Dedicated timestamp maintenance, consistent with the repository's triggers.
create function paint_guide_private.set_homeowner_access_updated_at()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;
create trigger set_homeowner_access_updated_at
before update on paint_guide_private.homeowner_access_tokens
for each row execute function paint_guide_private.set_homeowner_access_updated_at();

-- SQL-side role revalidation, in the same RPC transaction. No role parameter
-- or user_metadata is trusted. FK audit columns also protect against deletion.
create function paint_guide_private.require_homeowner_staff(
  p_actor_id uuid, p_owner_only boolean
)
returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles as p
    where p.user_id = p_actor_id and p.active
      and (p.role = 'owner' or (not p_owner_only and p.role = 'supervisor'))
  ) then
    raise exception using errcode = '42501', message = 'Staff authorization required.';
  end if;
end;
$$;

create function paint_guide_private.validate_homeowner_token_material(
  p_format_version smallint, p_lookup_key_version smallint, p_token_hmac bytea,
  p_encryption_key_version smallint, p_token_ciphertext bytea,
  p_encryption_nonce bytea, p_encryption_tag bytea
)
returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  if p_format_version is distinct from 1
    or p_lookup_key_version is null or p_lookup_key_version < 1
    or p_encryption_key_version is null or p_encryption_key_version < 1
    or p_token_hmac is null or octet_length(p_token_hmac) <> 32
    or p_token_ciphertext is null or octet_length(p_token_ciphertext) = 0
    or p_encryption_nonce is null or octet_length(p_encryption_nonce) <> 12
    or p_encryption_tag is null or octet_length(p_encryption_tag) <> 16 then
    raise exception using errcode = '22023', message = 'Invalid access material.';
  end if;
end;
$$;

-- All credential mutations and issuance take the same exclusive advisory lock;
-- exchange takes it shared. No UPDATE grant on core tables is needed for locks.
-- Hash collisions only serialize unrelated guides; they cannot grant access.
-- Volatile RPCs re-read authoritative rows AFTER acquiring a lock, including
-- after a wait. Do not reuse a candidate row fetched before the lock.
-- Status UPDATE owns a guide row lock before its AFTER trigger takes this lock.
-- These RPCs deliberately do NOT then lock that guide row (avoids lock inversion).
create function paint_guide_private.lock_homeowner_guide(
  p_guide_id uuid, p_shared boolean
)
returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  if p_guide_id is null then
    raise exception using errcode = '22023', message = 'Guide required.';
  end if;
  if p_shared then
    perform pg_catalog.pg_advisory_xact_lock_shared(
      pg_catalog.hashtextextended('tauro.pg.homeowner:' || p_guide_id::text, 0)
    );
  else
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('tauro.pg.homeowner:' || p_guide_id::text, 0)
    );
  end if;
end;
$$;

-- This PRIVATE service-only helper returns server recovery material only.
-- JSON bytea values use PostgreSQL's hex representation, not decrypted tokens.
create function paint_guide_private.homeowner_access_material(p_guide_id uuid)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'guide_id', t.guide_id,
    'format_version', t.format_version,
    'token_generation', t.token_generation,
    'session_epoch', t.session_epoch,
    'lookup_key_version', t.lookup_key_version,
    'token_hmac', t.token_hmac,
    'encryption_key_version', t.encryption_key_version,
    'token_ciphertext', t.token_ciphertext,
    'encryption_nonce', t.encryption_nonce,
    'encryption_tag', t.encryption_tag
  )
  from paint_guide_private.homeowner_access_tokens as t
  where t.guide_id = p_guide_id and t.revoked_at is null;
$$;

create function paint_guide_private.homeowner_access_issue(
  p_guide_id uuid, p_actor_id uuid, p_format_version smallint,
  p_lookup_key_version smallint, p_token_hmac bytea,
  p_encryption_key_version smallint, p_token_ciphertext bytea,
  p_encryption_nonce bytea, p_encryption_tag bytea
)
returns jsonb
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  v_revoked_at timestamptz;
begin
  perform paint_guide_private.lock_homeowner_guide(p_guide_id, false);
  perform paint_guide_private.require_homeowner_staff(p_actor_id, false);
  if not exists (select 1 from public.paint_guides as g where g.id = p_guide_id) then
    raise exception using errcode = 'P0002', message = 'Guide not found.';
  end if;
  select t.revoked_at into v_revoked_at
  from paint_guide_private.homeowner_access_tokens as t where t.guide_id = p_guide_id;
  if found then
    if v_revoked_at is not null then
      -- Neither owner nor supervisor receives revoked recovery material here.
      return jsonb_build_object('outcome', 'revoked');
    end if;
    return jsonb_build_object('outcome', 'existing', 'access',
      paint_guide_private.homeowner_access_material(p_guide_id));
  end if;
  perform paint_guide_private.validate_homeowner_token_material(
    p_format_version, p_lookup_key_version, p_token_hmac,
    p_encryption_key_version, p_token_ciphertext, p_encryption_nonce, p_encryption_tag);
  insert into paint_guide_private.homeowner_access_tokens (
    guide_id, format_version, lookup_key_version, token_hmac,
    encryption_key_version, token_ciphertext, encryption_nonce, encryption_tag,
    created_by
  ) values (
    p_guide_id, p_format_version, p_lookup_key_version, p_token_hmac,
    p_encryption_key_version, p_token_ciphertext, p_encryption_nonce, p_encryption_tag,
    p_actor_id
  );
  -- PK/advisory lock prevent concurrent initial overwrite. Other unique material
  -- collisions raise 23505, roll back this call, and MUST NOT be called success.
  return jsonb_build_object('outcome', 'issued', 'access',
    paint_guide_private.homeowner_access_material(p_guide_id));
end;
$$;

create function paint_guide_private.homeowner_access_recover(
  p_guide_id uuid, p_actor_id uuid
)
returns jsonb
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  v_material jsonb;
begin
  perform paint_guide_private.lock_homeowner_guide(p_guide_id, true);
  perform paint_guide_private.require_homeowner_staff(p_actor_id, false);
  v_material := paint_guide_private.homeowner_access_material(p_guide_id);
  -- Absent/revoked are unavailable for both roles: no SQL decryption, no
  -- implicit reactivation. Explicit owner rotation below can replace a revoked QR.
  if v_material is null then
    return jsonb_build_object('outcome', 'unavailable');
  end if;
  return jsonb_build_object('outcome', 'recovered', 'access', v_material);
end;
$$;

create function paint_guide_private.homeowner_access_rotate(
  p_guide_id uuid, p_actor_id uuid,
  p_expected_token_generation bigint, p_expected_session_epoch bigint,
  p_format_version smallint, p_lookup_key_version smallint, p_token_hmac bytea,
  p_encryption_key_version smallint, p_token_ciphertext bytea,
  p_encryption_nonce bytea, p_encryption_tag bytea
)
returns jsonb
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  v_generation bigint;
  v_epoch bigint;
  v_old_hmac bytea;
  v_old_lookup_version smallint;
  v_old_nonce bytea;
  v_old_encryption_version smallint;
begin
  perform paint_guide_private.lock_homeowner_guide(p_guide_id, false);
  perform paint_guide_private.require_homeowner_staff(p_actor_id, true);
  select t.token_generation, t.session_epoch, t.token_hmac, t.lookup_key_version,
    t.encryption_nonce, t.encryption_key_version
  into v_generation, v_epoch, v_old_hmac, v_old_lookup_version,
    v_old_nonce, v_old_encryption_version
  from paint_guide_private.homeowner_access_tokens as t where t.guide_id = p_guide_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Access not found.';
  end if;
  if v_generation is distinct from p_expected_token_generation
    or v_epoch is distinct from p_expected_session_epoch then
    raise exception using errcode = '40001', message = 'Access changed; reload before retrying.';
  end if;
  perform paint_guide_private.validate_homeowner_token_material(
    p_format_version, p_lookup_key_version, p_token_hmac,
    p_encryption_key_version, p_token_ciphertext, p_encryption_nonce, p_encryption_tag);
  if (p_lookup_key_version = v_old_lookup_version and p_token_hmac = v_old_hmac)
    or (p_encryption_key_version = v_old_encryption_version and p_encryption_nonce = v_old_nonce) then
    raise exception using errcode = '22023', message = 'Rotation requires fresh material.';
  end if;
  update paint_guide_private.homeowner_access_tokens as t set
    format_version = p_format_version,
    lookup_key_version = p_lookup_key_version, token_hmac = p_token_hmac,
    encryption_key_version = p_encryption_key_version, token_ciphertext = p_token_ciphertext,
    encryption_nonce = p_encryption_nonce, encryption_tag = p_encryption_tag,
    token_generation = t.token_generation + 1, session_epoch = t.session_epoch + 1,
    rotated_at = clock_timestamp(), rotated_by = p_actor_id,
    revoked_at = null, revoked_by = null
  where t.guide_id = p_guide_id;
  return jsonb_build_object('outcome', 'rotated', 'access',
    paint_guide_private.homeowner_access_material(p_guide_id));
end;
$$;

create function paint_guide_private.homeowner_access_revoke(
  p_guide_id uuid, p_actor_id uuid,
  p_expected_token_generation bigint, p_expected_session_epoch bigint
)
returns jsonb
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  v_generation bigint;
  v_epoch bigint;
  v_revoked_at timestamptz;
begin
  perform paint_guide_private.lock_homeowner_guide(p_guide_id, false);
  perform paint_guide_private.require_homeowner_staff(p_actor_id, true);
  select t.token_generation, t.session_epoch, t.revoked_at
  into v_generation, v_epoch, v_revoked_at
  from paint_guide_private.homeowner_access_tokens as t where t.guide_id = p_guide_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Access not found.';
  end if;
  if v_generation is distinct from p_expected_token_generation then
    raise exception using errcode = '40001', message = 'Access changed; reload before retrying.';
  end if;
  -- Repeat revoke of the SAME generation is idempotent; audit actor/time and
  -- epoch are not rewritten. A stale request cannot revoke a newer generation.
  if v_revoked_at is not null then
    return jsonb_build_object('outcome', 'already_revoked',
      'token_generation', v_generation, 'session_epoch', v_epoch);
  end if;
  if v_epoch is distinct from p_expected_session_epoch then
    raise exception using errcode = '40001', message = 'Access changed; reload before retrying.';
  end if;
  update paint_guide_private.homeowner_access_tokens as t set
    revoked_at = clock_timestamp(), revoked_by = p_actor_id,
    session_epoch = t.session_epoch + 1
  where t.guide_id = p_guide_id;
  return jsonb_build_object('outcome', 'revoked',
    'token_generation', v_generation, 'session_epoch', v_epoch + 1);
end;
$$;

create function paint_guide_private.homeowner_session_exchange(
  p_lookup_key_version smallint, p_token_hmac bytea,
  p_session_key_version smallint, p_session_hmac bytea,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  v_guide_id uuid;
  v_generation bigint;
  v_epoch bigint;
  v_now timestamptz;
begin
  -- A denied capability returns SQL NULL, irrespective of its failure reason.
  if p_lookup_key_version is null or p_lookup_key_version < 1
    or p_token_hmac is null or octet_length(p_token_hmac) <> 32 then
    return null;
  end if;
  select t.guide_id into v_guide_id
  from paint_guide_private.homeowner_access_tokens as t
  where t.lookup_key_version = p_lookup_key_version and t.token_hmac = p_token_hmac;
  if not found then return null; end if;
  perform paint_guide_private.lock_homeowner_guide(v_guide_id, true);
  -- VOLATILE gives this statement a fresh READ COMMITTED snapshot after any wait.
  select t.token_generation, t.session_epoch into v_generation, v_epoch
  from paint_guide_private.homeowner_access_tokens as t
  join public.paint_guides as g on g.id = t.guide_id
  where t.guide_id = v_guide_id
    and t.lookup_key_version = p_lookup_key_version and t.token_hmac = p_token_hmac
    and t.revoked_at is null and g.status = 'published';
  if not found then return null; end if;
  v_now := clock_timestamp();
  if p_session_key_version is null or p_session_key_version < 1
    or p_session_hmac is null or octet_length(p_session_hmac) <> 32
    or p_expires_at is null or not isfinite(p_expires_at)
    or p_expires_at <= v_now or p_expires_at > v_now + interval '30 minutes' then
    raise exception using errcode = '22023', message = 'Invalid session material.';
  end if;
  insert into paint_guide_private.homeowner_sessions (
    guide_id, token_generation, session_epoch, session_key_version, session_hmac,
    created_at, expires_at
  ) values (
    v_guide_id, v_generation, v_epoch, p_session_key_version, p_session_hmac,
    v_now, p_expires_at
  );
  -- No guide identity or document content on exchange; only confirmed expiry.
  return jsonb_build_object('expires_at', p_expires_at);
end;
$$;

-- One statement, one MVCC snapshot: no authorize-then-fetch race.
-- Reads starting after committed invalidation fail; an already-authorized
-- in-flight snapshot may complete (downloaded content cannot be retracted).
-- Use the primary, normal READ COMMITTED RPC requests, not stale replicas or
-- long-lived REPEATABLE READ transactions. Expiry uses request/statement time,
-- never the beginning of a potentially long-running transaction.
create function paint_guide_private.homeowner_document_read(
  p_session_key_version smallint, p_session_hmac bytea
)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'schema_version', 1,
    'guide', jsonb_build_object(
      'residence_name', g.residence_name,
      'primary_scope_note', g.primary_scope_note
    ),
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'parent_id', l.parent_id, 'name', l.name,
        'sort_order', l.sort_order, 'created_at', l.created_at
      ) order by l.sort_order, l.created_at, l.id)
      from public.guide_locations as l where l.guide_id = g.id
    ), '[]'::jsonb),
    'records', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'section', r.section, 'surface', r.surface,
        'brand', r.brand, 'product', r.product, 'color_name', r.color_name,
        'color_code', r.color_code, 'sheen', r.sheen, 'notes', r.notes,
        'sort_order', r.sort_order, 'created_at', r.created_at
      ) order by case r.section when 'primary' then 0 when 'exception' then 1 else 2 end,
        r.sort_order, r.created_at, r.id)
      from public.paint_records as r where r.guide_id = g.id
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'paint_record_id', a.paint_record_id, 'location_id', a.location_id
      ) order by a.location_id, a.paint_record_id)
      from public.paint_record_locations as a where a.guide_id = g.id
    ), '[]'::jsonb)
  )
  from paint_guide_private.homeowner_sessions as s
  join paint_guide_private.homeowner_access_tokens as t on t.guide_id = s.guide_id
  join public.paint_guides as g on g.id = s.guide_id
  where p_session_key_version >= 1 and octet_length(p_session_hmac) = 32
    and s.session_key_version = p_session_key_version and s.session_hmac = p_session_hmac
    and s.revoked_at is null and s.expires_at > statement_timestamp()
    and t.revoked_at is null
    and s.token_generation = t.token_generation and s.session_epoch = t.session_epoch
    and g.status = 'published';
$$;

-- The ONLY new SECURITY DEFINER function. Existing authenticated staff may
-- update guide status but cannot update private tokens. This trigger enforces
-- epoch invalidation inside THAT status transaction. Owner postgres matches
-- current migration convention; EXECUTE is removed from all API roles.
-- It only runs in its bound AFTER UPDATE trigger, uses no dynamic SQL, and
-- changes only session_epoch (timestamp maintenance is a separate trigger).
create function paint_guide_private.invalidate_homeowner_sessions_on_unpublish()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_schema <> 'public' or tg_table_name <> 'paint_guides'
    or tg_op <> 'UPDATE' or tg_when <> 'AFTER' or tg_nargs <> 0 then
    raise exception using errcode = '42501', message = 'Invalid trigger context.';
  end if;
  if old.status = 'published' and new.status <> 'published' then
    -- Same lock namespace as the RPCs; inline so this function has no dependency
    -- on a callable backend helper or a broader authorization API.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('tauro.pg.homeowner:' || new.id::text, 0)
    );
    update paint_guide_private.homeowner_access_tokens as t
      set session_epoch = t.session_epoch + 1
      where t.guide_id = new.id;
  end if;
  return new;
end;
$$;
create trigger invalidate_homeowner_sessions_on_unpublish
after update of status on public.paint_guides
for each row
when (old.status = 'published' and new.status <> 'published')
execute function paint_guide_private.invalidate_homeowner_sessions_on_unpublish();

-- Thin wrappers in the exposed public schema; all private implementations
-- remain invoker/service-only. POST is required for the mutating RPCs.
create function public.paint_guide_homeowner_access_issue(
  p_guide_id uuid, p_actor_id uuid, p_format_version smallint, p_lookup_key_version smallint, p_token_hmac bytea, p_encryption_key_version smallint, p_token_ciphertext bytea, p_encryption_nonce bytea, p_encryption_tag bytea
)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$
  select paint_guide_private.homeowner_access_issue(p_guide_id, p_actor_id, p_format_version, p_lookup_key_version, p_token_hmac, p_encryption_key_version, p_token_ciphertext, p_encryption_nonce, p_encryption_tag);
$$;

create function public.paint_guide_homeowner_access_recover(
  p_guide_id uuid, p_actor_id uuid
)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$
  select paint_guide_private.homeowner_access_recover(p_guide_id, p_actor_id);
$$;

create function public.paint_guide_homeowner_access_rotate(
  p_guide_id uuid, p_actor_id uuid, p_expected_token_generation bigint, p_expected_session_epoch bigint, p_format_version smallint, p_lookup_key_version smallint, p_token_hmac bytea, p_encryption_key_version smallint, p_token_ciphertext bytea, p_encryption_nonce bytea, p_encryption_tag bytea
)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$
  select paint_guide_private.homeowner_access_rotate(p_guide_id, p_actor_id, p_expected_token_generation, p_expected_session_epoch, p_format_version, p_lookup_key_version, p_token_hmac, p_encryption_key_version, p_token_ciphertext, p_encryption_nonce, p_encryption_tag);
$$;

create function public.paint_guide_homeowner_access_revoke(
  p_guide_id uuid, p_actor_id uuid, p_expected_token_generation bigint, p_expected_session_epoch bigint
)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$
  select paint_guide_private.homeowner_access_revoke(p_guide_id, p_actor_id, p_expected_token_generation, p_expected_session_epoch);
$$;

create function public.paint_guide_homeowner_session_exchange(
  p_lookup_key_version smallint, p_token_hmac bytea, p_session_key_version smallint, p_session_hmac bytea, p_expires_at timestamptz
)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$
  select paint_guide_private.homeowner_session_exchange(p_lookup_key_version, p_token_hmac, p_session_key_version, p_session_hmac, p_expires_at);
$$;

create function public.paint_guide_homeowner_document_read(
  p_session_key_version smallint, p_session_hmac bytea
)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select paint_guide_private.homeowner_document_read(p_session_key_version, p_session_hmac);
$$;

-- Set ownership and ACLs for EVERY new function, individually. No blanket
-- privilege changes to existing staff helpers or existing public functions.
alter function paint_guide_private.set_homeowner_access_updated_at() owner to postgres;
revoke all on function paint_guide_private.set_homeowner_access_updated_at()
  from public, anon, authenticated, service_role;

alter function paint_guide_private.require_homeowner_staff(uuid, boolean) owner to postgres;
revoke all on function paint_guide_private.require_homeowner_staff(uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function paint_guide_private.require_homeowner_staff(uuid, boolean) to service_role;

alter function paint_guide_private.validate_homeowner_token_material(smallint, smallint, bytea, smallint, bytea, bytea, bytea) owner to postgres;
revoke all on function paint_guide_private.validate_homeowner_token_material(smallint, smallint, bytea, smallint, bytea, bytea, bytea)
  from public, anon, authenticated, service_role;
grant execute on function paint_guide_private.validate_homeowner_token_material(smallint, smallint, bytea, smallint, bytea, bytea, bytea) to service_role;

alter function paint_guide_private.lock_homeowner_guide(uuid, boolean) owner to postgres;
revoke all on function paint_guide_private.lock_homeowner_guide(uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function paint_guide_private.lock_homeowner_guide(uuid, boolean) to service_role;

alter function paint_guide_private.homeowner_access_material(uuid) owner to postgres;
revoke all on function paint_guide_private.homeowner_access_material(uuid)
  from public, anon, authenticated, service_role;
grant execute on function paint_guide_private.homeowner_access_material(uuid) to service_role;

alter function paint_guide_private.invalidate_homeowner_sessions_on_unpublish() owner to postgres;
revoke all on function paint_guide_private.invalidate_homeowner_sessions_on_unpublish()
  from public, anon, authenticated, service_role;

alter function paint_guide_private.homeowner_access_issue(uuid, uuid, smallint, smallint, bytea, smallint, bytea, bytea, bytea) owner to postgres;
revoke all on function paint_guide_private.homeowner_access_issue(uuid, uuid, smallint, smallint, bytea, smallint, bytea, bytea, bytea)
  from public, anon, authenticated, service_role;
grant execute on function paint_guide_private.homeowner_access_issue(uuid, uuid, smallint, smallint, bytea, smallint, bytea, bytea, bytea) to service_role;

alter function paint_guide_private.homeowner_access_recover(uuid, uuid) owner to postgres;
revoke all on function paint_guide_private.homeowner_access_recover(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function paint_guide_private.homeowner_access_recover(uuid, uuid) to service_role;

alter function paint_guide_private.homeowner_access_rotate(uuid, uuid, bigint, bigint, smallint, smallint, bytea, smallint, bytea, bytea, bytea) owner to postgres;
revoke all on function paint_guide_private.homeowner_access_rotate(uuid, uuid, bigint, bigint, smallint, smallint, bytea, smallint, bytea, bytea, bytea)
  from public, anon, authenticated, service_role;
grant execute on function paint_guide_private.homeowner_access_rotate(uuid, uuid, bigint, bigint, smallint, smallint, bytea, smallint, bytea, bytea, bytea) to service_role;

alter function paint_guide_private.homeowner_access_revoke(uuid, uuid, bigint, bigint) owner to postgres;
revoke all on function paint_guide_private.homeowner_access_revoke(uuid, uuid, bigint, bigint)
  from public, anon, authenticated, service_role;
grant execute on function paint_guide_private.homeowner_access_revoke(uuid, uuid, bigint, bigint) to service_role;

alter function paint_guide_private.homeowner_session_exchange(smallint, bytea, smallint, bytea, timestamptz) owner to postgres;
revoke all on function paint_guide_private.homeowner_session_exchange(smallint, bytea, smallint, bytea, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function paint_guide_private.homeowner_session_exchange(smallint, bytea, smallint, bytea, timestamptz) to service_role;

alter function paint_guide_private.homeowner_document_read(smallint, bytea) owner to postgres;
revoke all on function paint_guide_private.homeowner_document_read(smallint, bytea)
  from public, anon, authenticated, service_role;
grant execute on function paint_guide_private.homeowner_document_read(smallint, bytea) to service_role;

alter function public.paint_guide_homeowner_access_issue(uuid, uuid, smallint, smallint, bytea, smallint, bytea, bytea, bytea) owner to postgres;
revoke all on function public.paint_guide_homeowner_access_issue(uuid, uuid, smallint, smallint, bytea, smallint, bytea, bytea, bytea)
  from public, anon, authenticated, service_role;
grant execute on function public.paint_guide_homeowner_access_issue(uuid, uuid, smallint, smallint, bytea, smallint, bytea, bytea, bytea) to service_role;

alter function public.paint_guide_homeowner_access_recover(uuid, uuid) owner to postgres;
revoke all on function public.paint_guide_homeowner_access_recover(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.paint_guide_homeowner_access_recover(uuid, uuid) to service_role;

alter function public.paint_guide_homeowner_access_rotate(uuid, uuid, bigint, bigint, smallint, smallint, bytea, smallint, bytea, bytea, bytea) owner to postgres;
revoke all on function public.paint_guide_homeowner_access_rotate(uuid, uuid, bigint, bigint, smallint, smallint, bytea, smallint, bytea, bytea, bytea)
  from public, anon, authenticated, service_role;
grant execute on function public.paint_guide_homeowner_access_rotate(uuid, uuid, bigint, bigint, smallint, smallint, bytea, smallint, bytea, bytea, bytea) to service_role;

alter function public.paint_guide_homeowner_access_revoke(uuid, uuid, bigint, bigint) owner to postgres;
revoke all on function public.paint_guide_homeowner_access_revoke(uuid, uuid, bigint, bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.paint_guide_homeowner_access_revoke(uuid, uuid, bigint, bigint) to service_role;

alter function public.paint_guide_homeowner_session_exchange(smallint, bytea, smallint, bytea, timestamptz) owner to postgres;
revoke all on function public.paint_guide_homeowner_session_exchange(smallint, bytea, smallint, bytea, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.paint_guide_homeowner_session_exchange(smallint, bytea, smallint, bytea, timestamptz) to service_role;

alter function public.paint_guide_homeowner_document_read(smallint, bytea) owner to postgres;
revoke all on function public.paint_guide_homeowner_document_read(smallint, bytea)
  from public, anon, authenticated, service_role;
grant execute on function public.paint_guide_homeowner_document_read(smallint, bytea) to service_role;

-- Generation/epoch values are snapshots, NOT a changing composite foreign key:
-- rotation and unpublish must leave old sessions present but unauthorized.
-- No cleanup cron, public policy, exposed-schema change, or crypto-in-SQL added.
-- Same-QR explicit owner reactivation is not an RPC in this A-F persistence step;
-- revoked material remains unrecoverable. Rotation is the supported explicit
-- owner operation that clears revocation while issuing a DIFFERENT capability.
commit;
