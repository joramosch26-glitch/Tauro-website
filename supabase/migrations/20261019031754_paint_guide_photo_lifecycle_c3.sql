-- C3 photo lifecycle. Locally implemented, migration-tested on a disposable PostgreSQL 17.6 instance.
begin;

create table public.paint_guide_photo_slots (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.paint_guides(id) on delete cascade,
  placement_kind text not null check (placement_kind in ('residence_cover','location','record_context')),
  location_id uuid,
  paint_record_id uuid,
  current_version_id uuid,
  write_generation bigint not null default 0 check (write_generation >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guide_id, id),
  constraint pgps_location_same_guide foreign key (guide_id, location_id)
    references public.guide_locations(guide_id,id) on delete cascade,
  constraint pgps_record_same_guide foreign key (guide_id, paint_record_id)
    references public.paint_records(guide_id,id) on delete cascade,
  constraint pgps_assignment_same_guide foreign key (guide_id, paint_record_id, location_id)
    references public.paint_record_locations(guide_id,paint_record_id,location_id) on delete cascade,
  constraint pgps_shape check (
    (placement_kind='residence_cover' and location_id is null and paint_record_id is null) or
    (placement_kind='location' and location_id is not null and paint_record_id is null) or
    (placement_kind='record_context' and location_id is not null and paint_record_id is not null)
  )
);
create unique index pgps_one_cover on public.paint_guide_photo_slots(guide_id)
  where placement_kind='residence_cover';
create unique index pgps_one_location on public.paint_guide_photo_slots(guide_id,location_id)
  where placement_kind='location';
create unique index pgps_one_record_context on public.paint_guide_photo_slots(guide_id,location_id,paint_record_id)
  where placement_kind='record_context';
create index pgps_guide_location_idx on public.paint_guide_photo_slots(guide_id,location_id)
  where location_id is not null;
create index pgps_guide_record_idx on public.paint_guide_photo_slots(guide_id,paint_record_id)
  where paint_record_id is not null;

create table public.paint_guide_photo_versions (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null,
  slot_id uuid not null,
  version_number integer not null check (version_number > 0),
  attempt_id uuid not null unique,
  generation bigint not null check (generation > 0),
  state text not null check (state in ('uploading','ready','retained','cleanup_pending','failed')),
  created_by uuid references auth.users(id) on delete set null,
  lease_expires_at timestamptz not null,
  quarantine_key text unique,
  full_key text unique,
  thumbnail_key text unique,
  mime_type text,
  width integer check (width is null or width between 1 and 2400),
  height integer check (height is null or height between 1 and 2400),
  full_bytes bigint check (full_bytes is null or full_bytes between 1 and 4194304),
  thumbnail_bytes bigint check (thumbnail_bytes is null or thumbnail_bytes between 1 and 1048576),
  failure_code text,
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  superseded_at timestamptz,
  purge_after timestamptz,
  unique (slot_id,id),
  unique (slot_id,version_number),
  foreign key (guide_id,slot_id) references public.paint_guide_photo_slots(guide_id,id) on delete cascade,
  check (mime_type is null or mime_type='image/webp'),
  check (full_key is null or full_key is distinct from quarantine_key),
  check (thumbnail_key is null or thumbnail_key is distinct from quarantine_key),
  check (state <> 'ready' or (ready_at is not null and full_key is not null and thumbnail_key is not null and mime_type is not null and mime_type='image/webp' and width is not null and height is not null and full_bytes is not null and thumbnail_bytes is not null)),
  check (state <> 'retained' or (superseded_at is not null and purge_after is not null and purge_after >= superseded_at + interval '30 days'))
);
create index pgpv_slot_state_idx on public.paint_guide_photo_versions(slot_id,state);
create index pgpv_retention_idx on public.paint_guide_photo_versions(purge_after)
  where state='retained';
create index pgpv_guide_idx on public.paint_guide_photo_versions(guide_id);
-- Pointer ownership is additionally enforced by the deferred composite FK below.
create index pgps_current_version_idx on public.paint_guide_photo_slots(current_version_id)
  where current_version_id is not null;
alter table public.paint_guide_photo_slots add constraint pgps_current_version_same_slot_fk
  foreign key (id,current_version_id) references public.paint_guide_photo_versions(slot_id,id)
  deferrable initially deferred;

create schema if not exists paint_guide_private;
create table paint_guide_private.photo_cleanup_outbox (
  id bigint generated always as identity primary key,
  bucket_id text not null check (bucket_id in ('paint-guide-quarantine','paint-guide-private')),
  object_key text not null,
  version_id uuid,
  reason text not null check (reason in ('replacement_retention','owner_delete','parent_delete','failed_upload','orphan','processed_original')),
  next_attempt_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  claim_generation bigint not null default 0 check (claim_generation >= 0),
  lease_until timestamptz,
  last_absent_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  unique(bucket_id,object_key)
);
create index pgpco_due_idx on paint_guide_private.photo_cleanup_outbox(next_attempt_at,id);

create function paint_guide_private.queue_photo_object(
  p_bucket text,p_key text,p_version uuid,p_reason text,p_due timestamptz
) returns void language sql security definer set search_path=''
as $$
  insert into paint_guide_private.photo_cleanup_outbox(bucket_id,object_key,version_id,reason,next_attempt_at)
  values (p_bucket,p_key,p_version,p_reason,p_due)
  on conflict (bucket_id,object_key) do update set
    version_id=coalesce(paint_guide_private.photo_cleanup_outbox.version_id,excluded.version_id),
    reason=case when paint_guide_private.photo_cleanup_outbox.reason='processed_original'
      and paint_guide_private.photo_cleanup_outbox.last_absent_at is null
      and paint_guide_private.photo_cleanup_outbox.next_attempt_at>now()
      then paint_guide_private.photo_cleanup_outbox.reason else excluded.reason end,
    next_attempt_at=case when paint_guide_private.photo_cleanup_outbox.reason='processed_original'
      and paint_guide_private.photo_cleanup_outbox.last_absent_at is null
      and paint_guide_private.photo_cleanup_outbox.next_attempt_at>now()
      then paint_guide_private.photo_cleanup_outbox.next_attempt_at
      else least(paint_guide_private.photo_cleanup_outbox.next_attempt_at,excluded.next_attempt_at) end,
    last_absent_at=null;
$$;

create function paint_guide_private.enqueue_photo_version_objects()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_due timestamptz := now(); v_reason text := 'parent_delete';
begin
  if old.quarantine_key is not null then perform paint_guide_private.queue_photo_object('paint-guide-quarantine',old.quarantine_key,old.id,v_reason,v_due); end if;
  if old.full_key is not null then perform paint_guide_private.queue_photo_object('paint-guide-private',old.full_key,old.id,v_reason,v_due); end if;
  if old.thumbnail_key is not null then perform paint_guide_private.queue_photo_object('paint-guide-private',old.thumbnail_key,old.id,v_reason,v_due); end if;
  return old;
end $$;
create trigger pgpv_enqueue_before_delete before delete on public.paint_guide_photo_versions
for each row execute function paint_guide_private.enqueue_photo_version_objects();

create function paint_guide_private.assert_current_photo_ready()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare v_bad boolean;
begin
  if tg_table_name='paint_guide_photo_slots' then
    select exists(
      select 1 from public.paint_guide_photo_slots s
      left join public.paint_guide_photo_versions v on v.slot_id=s.id and v.id=s.current_version_id
      where s.id=new.id and s.current_version_id is not null and v.state is distinct from 'ready'
    ) into v_bad;
  else
    select exists(
      select 1 from public.paint_guide_photo_slots s
      join public.paint_guide_photo_versions v on v.slot_id=s.id and v.id=s.current_version_id
      where v.id=new.id and v.state is distinct from 'ready'
    ) into v_bad;
  end if;
  if v_bad then raise exception using errcode='23514',message='A current photo must be a ready version in the same slot.'; end if;
  return null;
end $$;
create constraint trigger pgps_current_photo_ready_from_slot
after insert or update on public.paint_guide_photo_slots
deferrable initially deferred for each row execute function paint_guide_private.assert_current_photo_ready();
create constraint trigger pgpv_current_photo_ready_from_version
after insert or update on public.paint_guide_photo_versions
deferrable initially deferred for each row execute function paint_guide_private.assert_current_photo_ready();

create function paint_guide_private.photo_cleanup_claim(p_batch integer default 50)
returns table(id bigint,bucket_id text,object_key text,claim_generation bigint)
language sql volatile security invoker set search_path=''
as $$
  with picked as (
    select o.id from paint_guide_private.photo_cleanup_outbox o
    where o.next_attempt_at<=now() and (o.lease_until is null or o.lease_until<now())
    order by o.next_attempt_at,o.id limit least(greatest(coalesce(p_batch,50),1),50) for update skip locked
  )
  update paint_guide_private.photo_cleanup_outbox o
    set lease_until=now()+interval '5 minutes',attempts=o.attempts+1,claim_generation=o.claim_generation+1,last_attempt_at=now()
    from picked where o.id=picked.id returning o.id,o.bucket_id,o.object_key,o.claim_generation;
$$;

create function paint_guide_private.photo_cleanup_complete(p_id bigint,p_claim_generation bigint,p_delete_succeeded boolean)
returns boolean language plpgsql volatile security invoker set search_path=''
as $$
begin
  if p_id is null or p_claim_generation is null or p_delete_succeeded is not true then return false; end if;
  update paint_guide_private.photo_cleanup_outbox
    set lease_until=null,last_absent_at=now(),last_error_code=null,next_attempt_at=now()+interval '1 day'
    where id=p_id and claim_generation=p_claim_generation and lease_until>now();
  return found;
end $$;

create function paint_guide_private.photo_cleanup_fail(p_id bigint,p_claim_generation bigint,p_error_code text)
returns boolean language plpgsql volatile security invoker set search_path=''
as $$
begin
  if p_id is null or p_claim_generation is null or p_error_code is null or p_error_code !~ '^[a-z0-9_]{1,64}$' then return false; end if;
  update paint_guide_private.photo_cleanup_outbox
    set lease_until=null,last_error_code=p_error_code,
        next_attempt_at=now()+least(interval '6 hours',interval '5 minutes'*power(2,least(attempts-1,7)))
    where id=p_id and claim_generation=p_claim_generation and lease_until>now();
  return found;
end $$;

create function paint_guide_private.photo_cleanup_sweep()
returns integer language plpgsql volatile security invoker set search_path=''
as $$
declare v record; v_slot uuid; v_count integer := 0;
begin
  for v_slot in select distinct slot_id from public.paint_guide_photo_versions
    where state='uploading' and lease_expires_at<now()
    order by slot_id limit 50
  loop
    perform 1 from public.paint_guide_photo_slots where id=v_slot for update;
    if not found then continue; end if;
    for v in select * from public.paint_guide_photo_versions
      where slot_id=v_slot and state='uploading' and lease_expires_at<now() order by id for update
    loop
      if v.quarantine_key is not null then perform paint_guide_private.queue_photo_object('paint-guide-quarantine',v.quarantine_key,v.id,'failed_upload',now()); end if;
      if v.full_key is not null then perform paint_guide_private.queue_photo_object('paint-guide-private',v.full_key,v.id,'failed_upload',now()); end if;
      if v.thumbnail_key is not null then perform paint_guide_private.queue_photo_object('paint-guide-private',v.thumbnail_key,v.id,'failed_upload',now()); end if;
      update public.paint_guide_photo_versions set state='cleanup_pending' where id=v.id;
      v_count := v_count+1;
    end loop;
  end loop;
  return v_count;
end $$;

alter function paint_guide_private.queue_photo_object(text,text,uuid,text,timestamptz) owner to postgres;
alter function paint_guide_private.enqueue_photo_version_objects() owner to postgres;
alter function paint_guide_private.assert_current_photo_ready() owner to postgres;
alter function paint_guide_private.photo_cleanup_claim(integer) owner to postgres;
alter function paint_guide_private.photo_cleanup_complete(bigint,bigint,boolean) owner to postgres;
alter function paint_guide_private.photo_cleanup_fail(bigint,bigint,text) owner to postgres;
alter function paint_guide_private.photo_cleanup_sweep() owner to postgres;
revoke all on function paint_guide_private.queue_photo_object(text,text,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function paint_guide_private.enqueue_photo_version_objects() from public,anon,authenticated;
revoke all on function paint_guide_private.assert_current_photo_ready() from public,anon,authenticated;
revoke all on function paint_guide_private.photo_cleanup_claim(integer) from public,anon,authenticated;
revoke all on function paint_guide_private.photo_cleanup_complete(bigint,bigint,boolean) from public,anon,authenticated;
revoke all on function paint_guide_private.photo_cleanup_fail(bigint,bigint,text) from public,anon,authenticated;
revoke all on function paint_guide_private.photo_cleanup_sweep() from public,anon,authenticated;
grant execute on function paint_guide_private.queue_photo_object(text,text,uuid,text,timestamptz) to service_role;
grant execute on function paint_guide_private.photo_cleanup_claim(integer) to service_role;
grant execute on function paint_guide_private.photo_cleanup_complete(bigint,bigint,boolean) to service_role;
grant execute on function paint_guide_private.photo_cleanup_fail(bigint,bigint,text) to service_role;
grant execute on function paint_guide_private.photo_cleanup_sweep() to service_role;

alter table public.paint_guide_photo_slots enable row level security;
alter table public.paint_guide_photo_versions enable row level security;
alter table paint_guide_private.photo_cleanup_outbox enable row level security;
revoke all on public.paint_guide_photo_slots,public.paint_guide_photo_versions from public,anon,authenticated;
revoke all on paint_guide_private.photo_cleanup_outbox from public,anon,authenticated;
grant usage on schema paint_guide_private to service_role;
grant select,insert,update,delete on public.paint_guide_photo_slots,public.paint_guide_photo_versions to service_role;
grant select,insert,update,delete on paint_guide_private.photo_cleanup_outbox to service_role;
grant usage,select on sequence paint_guide_private.photo_cleanup_outbox_id_seq to service_role;
-- Trusted service_role direct DML is also possible under these grants; route code is part of the security boundary.

create function paint_guide_private.paint_guide_photo_reserve(
  p_actor uuid,p_guide uuid,p_placement text,p_location uuid,p_record uuid,p_attempt uuid
) returns jsonb language plpgsql volatile security invoker set search_path=''
as $$
declare v_slot uuid; v_gen bigint; v_version uuid; v_number integer; v_key text; v_lease timestamptz; v_existing record;
begin
  if p_actor is null or p_guide is null or p_attempt is null or p_placement is null then
    raise exception using errcode='22023',message='Required upload reservation fields are missing.';
  end if;
  perform paint_guide_private.require_homeowner_staff(p_actor,true);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tauro.pg.photo.attempt:'||p_attempt::text,0));
  select v.id,v.slot_id,v.generation,v.quarantine_key,v.full_key,v.thumbnail_key,v.created_by,v.state,v.lease_expires_at,
    s.guide_id,s.placement_kind,s.location_id,s.paint_record_id,s.current_version_id,s.write_generation into v_existing
    from public.paint_guide_photo_versions v join public.paint_guide_photo_slots s on s.id=v.slot_id where v.attempt_id=p_attempt;
  if found then
    perform 1 from public.paint_guide_photo_slots where id=v_existing.slot_id for update;
    select v.id,v.slot_id,v.generation,v.quarantine_key,v.full_key,v.thumbnail_key,v.created_by,v.state,v.lease_expires_at,
      s.guide_id,s.placement_kind,s.location_id,s.paint_record_id,s.current_version_id,s.write_generation into v_existing
      from public.paint_guide_photo_versions v join public.paint_guide_photo_slots s on s.id=v.slot_id
      where v.attempt_id=p_attempt for update of v;
    if not found or v_existing.created_by is distinct from p_actor or v_existing.guide_id is distinct from p_guide
       or v_existing.placement_kind is distinct from p_placement or v_existing.location_id is distinct from p_location
       or v_existing.paint_record_id is distinct from p_record then raise exception using errcode='42501',message='Not authorized.'; end if;
    if v_existing.state='uploading' and v_existing.lease_expires_at>now()
       and v_existing.generation=v_existing.write_generation then
      return jsonb_build_object('attempt_id',p_attempt,'version_id',v_existing.id,'slot_id',v_existing.slot_id,
        'generation',v_existing.generation,'lease_expires_at',v_existing.lease_expires_at,'state',v_existing.state,
        'quarantine_key',v_existing.quarantine_key,'full_key',v_existing.full_key,'thumbnail_key',v_existing.thumbnail_key,
        'is_current',false,'newly_reserved',false);
    elsif v_existing.state='ready' then
      return jsonb_build_object('attempt_id',p_attempt,'version_id',v_existing.id,'slot_id',v_existing.slot_id,
        'generation',v_existing.generation,'lease_expires_at',v_existing.lease_expires_at,'state',v_existing.state,
        'quarantine_key',v_existing.quarantine_key,'full_key',v_existing.full_key,'thumbnail_key',v_existing.thumbnail_key,
        'is_current',v_existing.current_version_id=v_existing.id,'newly_reserved',false);
    else
      raise exception using errcode='40001',message='Upload attempt expired or is terminal.';
    end if;
  end if;
  if (p_placement='residence_cover' and (p_location is not null or p_record is not null)) or
     (p_placement='location' and (p_location is null or p_record is not null)) or
     (p_placement='record_context' and (p_location is null or p_record is null)) or
     p_placement not in ('residence_cover','location','record_context') then
    raise exception using errcode='22023',message='Invalid placement.';
  end if;
  if not exists(select 1 from public.paint_guides g where g.id=p_guide) then
    raise exception using errcode='P0002',message='Guide not found.';
  end if;
  if p_placement='residence_cover' then
    if p_location is not null or p_record is not null then raise exception using errcode='22023',message='Invalid placement.'; end if;
  elsif p_placement='location' then
    if p_location is null or p_record is not null or not exists(select 1 from public.guide_locations l where l.guide_id=p_guide and l.id=p_location) then
      raise exception using errcode='22023',message='Invalid placement.';
    end if;
  elsif p_placement='record_context' then
    if p_location is null or p_record is null or not exists(
      select 1 from public.paint_record_locations a where a.guide_id=p_guide and a.location_id=p_location and a.paint_record_id=p_record
    ) then raise exception using errcode='22023',message='Invalid placement.'; end if;
  else raise exception using errcode='22023',message='Invalid placement.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'tauro.pg.photo:'||p_guide::text||':'||p_placement||':'||coalesce(p_location::text,'')||':'||coalesce(p_record::text,''),0));
  select s.id into v_slot from public.paint_guide_photo_slots s
   where s.guide_id=p_guide and s.placement_kind=p_placement
     and s.location_id is not distinct from p_location and s.paint_record_id is not distinct from p_record
   for update;
  if v_slot is null then
    insert into public.paint_guide_photo_slots(guide_id,placement_kind,location_id,paint_record_id)
      values(p_guide,p_placement,p_location,p_record) returning id into v_slot;
  end if;
  -- Recheck attempt idempotency after taking placement and slot locks.
  if exists(select 1 from public.paint_guide_photo_versions where attempt_id=p_attempt) then
    -- Defensive serialization failure for a row inserted outside this RPC protocol.
    -- Retry with the same ID: the first branch returns its canonical state/lease.
    raise exception using errcode='40001',message='Retry this reservation with the same attempt ID.';
  end if;
  -- A newer reservation fences every in-flight writer for this slot. Keep delayed
  -- tombstones for all candidate objects so writes arriving after cancellation
  -- are still discovered and removed after the lease and late-write grace.
  for v_existing in select id,quarantine_key,full_key,thumbnail_key,lease_expires_at
    from public.paint_guide_photo_versions where slot_id=v_slot and state='uploading' for update
  loop
    if v_existing.quarantine_key is not null then
      perform paint_guide_private.queue_photo_object('paint-guide-quarantine',v_existing.quarantine_key,v_existing.id,
        'processed_original',v_existing.lease_expires_at+interval '31 minutes');
    end if;
    if v_existing.full_key is not null then
      perform paint_guide_private.queue_photo_object('paint-guide-private',v_existing.full_key,v_existing.id,
        'processed_original',v_existing.lease_expires_at+interval '31 minutes');
    end if;
    if v_existing.thumbnail_key is not null then
      perform paint_guide_private.queue_photo_object('paint-guide-private',v_existing.thumbnail_key,v_existing.id,
        'processed_original',v_existing.lease_expires_at+interval '31 minutes');
    end if;
    update public.paint_guide_photo_versions set state='cleanup_pending' where id=v_existing.id;
  end loop;
  update public.paint_guide_photo_slots set write_generation=write_generation+1,updated_at=now()
    where id=v_slot returning write_generation into v_gen;
  v_version := gen_random_uuid();
  v_lease := now()+interval '30 minutes';
  select coalesce(max(version_number),0)+1 into v_number from public.paint_guide_photo_versions where slot_id=v_slot;
  v_key := p_guide::text||'/'||v_slot::text||'/'||v_version::text;
  insert into public.paint_guide_photo_versions(id,guide_id,slot_id,version_number,attempt_id,generation,state,created_by,lease_expires_at,quarantine_key,full_key,thumbnail_key)
    values(v_version,p_guide,v_slot,v_number,p_attempt,v_gen,'uploading',p_actor,v_lease,
      'quarantine/'||v_key,'full/'||v_key||'.webp','thumb/'||v_key||'.webp');
  return jsonb_build_object('attempt_id',p_attempt,'version_id',v_version,'slot_id',v_slot,'generation',v_gen,
    'lease_expires_at',v_lease,'state','uploading','newly_reserved',true,
    'quarantine_key','quarantine/'||v_key,'full_key','full/'||v_key||'.webp',
    'thumbnail_key','thumb/'||v_key||'.webp','is_current',false);
end $$;

create function paint_guide_private.paint_guide_photo_promote(
  p_actor uuid,p_attempt uuid,p_generation bigint,p_width integer,p_height integer,
  p_full_bytes bigint,p_thumb_bytes bigint,p_outputs_verified boolean,p_original_deleted boolean
) returns uuid language plpgsql volatile security invoker set search_path=''
as $$
declare v public.paint_guide_photo_versions%rowtype; s public.paint_guide_photo_slots%rowtype; old public.paint_guide_photo_versions%rowtype; v_slot uuid;
begin
  if p_actor is null or p_attempt is null or p_generation is null or p_width is null or p_height is null
     or p_full_bytes is null or p_thumb_bytes is null or p_outputs_verified is not true or p_original_deleted is not true then
    raise exception using errcode='22023',message='Required promotion fields are missing or invalid.';
  end if;
  perform paint_guide_private.require_homeowner_staff(p_actor,true);
  select slot_id into v_slot from public.paint_guide_photo_versions where attempt_id=p_attempt;
  if not found then raise exception using errcode='P0002',message='Upload attempt unavailable.'; end if;
  select * into s from public.paint_guide_photo_slots where id=v_slot for update;
  if not found then raise exception using errcode='P0002',message='Upload slot unavailable.'; end if;
  select * into v from public.paint_guide_photo_versions where attempt_id=p_attempt and slot_id=s.id for update;
  if not found or v.created_by is distinct from p_actor then raise exception using errcode='P0002',message='Upload attempt unavailable.'; end if;
  -- A lost response after commit is safe to retry; never switch the pointer again.
  if v.state in ('ready','retained') then return v.id; end if;
  if v.state<>'uploading' or s.write_generation<>p_generation or v.generation<>p_generation or v.lease_expires_at<=now()
     or p_width not between 1 and 2400 or p_height not between 1 and 2400
     or p_full_bytes not between 1 and 4194304 or p_thumb_bytes not between 1 and 1048576 then
    raise exception using errcode='40001',message='Upload candidate is stale or invalid.';
  end if;
  if s.current_version_id is not null then
    select * into old from public.paint_guide_photo_versions where id=s.current_version_id and slot_id=s.id for update;
    if not found or old.state<>'ready' then raise exception using errcode='40001',message='Current photo invariant failed.'; end if;
    update public.paint_guide_photo_versions set state='retained',superseded_at=now(),purge_after=now()+interval '30 days' where id=old.id;
    if old.full_key is not null then perform paint_guide_private.queue_photo_object('paint-guide-private',old.full_key,old.id,'replacement_retention',now()+interval '30 days'); end if;
    if old.thumbnail_key is not null then perform paint_guide_private.queue_photo_object('paint-guide-private',old.thumbnail_key,old.id,'replacement_retention',now()+interval '30 days'); end if;
  end if;
  -- Preserve a tombstone for duplicate in-flight reservations that finish an original write late.
  -- Keep the tombstone beyond the maximum reservation lease and late-write grace.
  if v.quarantine_key is not null then
    perform paint_guide_private.queue_photo_object('paint-guide-quarantine',v.quarantine_key,v.id,
      'processed_original',v.lease_expires_at+interval '31 minutes');
  end if;
  update public.paint_guide_photo_versions set state='ready',ready_at=now(),mime_type='image/webp',width=p_width,height=p_height,
    full_bytes=p_full_bytes,thumbnail_bytes=p_thumb_bytes,quarantine_key=null,
    full_key='full/'||v.guide_id::text||'/'||v.slot_id::text||'/'||v.id::text||'.webp',
    thumbnail_key='thumb/'||v.guide_id::text||'/'||v.slot_id::text||'/'||v.id::text||'.webp'
    where id=v.id;
  update public.paint_guide_photo_slots set current_version_id=v.id,updated_at=now() where id=s.id;
  return v.id;
end $$;

create function paint_guide_private.paint_guide_photo_delete(p_actor uuid,p_slot uuid)
returns void language plpgsql volatile security invoker set search_path=''
as $$
declare s public.paint_guide_photo_slots%rowtype; v record; v_due timestamptz;
begin
  if p_actor is null or p_slot is null then raise exception using errcode='22023',message='Required delete fields are missing.'; end if;
  perform paint_guide_private.require_homeowner_staff(p_actor,true);
  select * into s from public.paint_guide_photo_slots where id=p_slot for update;
  if not found then return; end if;
  update public.paint_guide_photo_slots set current_version_id=null,write_generation=write_generation+1,updated_at=now() where id=p_slot;
  for v in select * from public.paint_guide_photo_versions where slot_id=p_slot for update loop
    v_due := now();
    if v.quarantine_key is not null then perform paint_guide_private.queue_photo_object('paint-guide-quarantine',v.quarantine_key,v.id,'owner_delete',v_due); end if;
    if v.full_key is not null then perform paint_guide_private.queue_photo_object('paint-guide-private',v.full_key,v.id,'owner_delete',v_due); end if;
    if v.thumbnail_key is not null then perform paint_guide_private.queue_photo_object('paint-guide-private',v.thumbnail_key,v.id,'owner_delete',v_due); end if;
    update public.paint_guide_photo_versions set state='cleanup_pending' where id=v.id;
  end loop;
end $$;

create function paint_guide_private.paint_guide_homeowner_photo_read(
  p_session_key_version smallint,p_session_hmac bytea,p_version uuid,p_variant text
) returns table(guide_id uuid,object_key text,content_length bigint,width integer,height integer) language sql stable security invoker set search_path=''
as $$
  select s.guide_id,
    case p_variant when 'full' then v.full_key else v.thumbnail_key end,
    case p_variant when 'full' then v.full_bytes else v.thumbnail_bytes end,
    case p_variant when 'full' then v.width else least(v.width,480) end,
    case p_variant when 'full' then v.height else least(v.height,480) end
  from paint_guide_private.homeowner_sessions hs
  join paint_guide_private.homeowner_access_tokens t on t.guide_id=hs.guide_id
  join public.paint_guides g on g.id=hs.guide_id
  join public.paint_guide_photo_slots s on s.guide_id=g.id and s.current_version_id=p_version
  join public.paint_guide_photo_versions v on v.slot_id=s.id and v.id=p_version and v.state='ready'
  where p_session_key_version is not null and p_session_hmac is not null and p_version is not null and p_variant is not null
    and p_variant in ('full','thumb') and p_session_key_version>=1 and octet_length(p_session_hmac)=32
    and hs.session_key_version=p_session_key_version and hs.session_hmac=p_session_hmac
    and hs.revoked_at is null and hs.expires_at>statement_timestamp()
    and hs.token_generation=t.token_generation and hs.session_epoch=t.session_epoch and t.revoked_at is null
    and g.status='published';
$$;

create function paint_guide_private.paint_guide_homeowner_photo_list(
  p_session_key_version smallint,p_session_hmac bytea
) returns table(slot_id uuid,version_id uuid,placement_kind text,location_id uuid,paint_record_id uuid)
language sql stable security invoker set search_path=''
as $$
  select s.id,s.current_version_id,s.placement_kind,s.location_id,s.paint_record_id
  from paint_guide_private.homeowner_sessions hs
  join paint_guide_private.homeowner_access_tokens t on t.guide_id=hs.guide_id
  join public.paint_guides g on g.id=hs.guide_id
  join public.paint_guide_photo_slots s on s.guide_id=g.id and s.current_version_id is not null
  join public.paint_guide_photo_versions v on v.slot_id=s.id and v.id=s.current_version_id and v.state='ready'
  where p_session_key_version is not null and p_session_hmac is not null
    and p_session_key_version>=1 and octet_length(p_session_hmac)=32
    and hs.session_key_version=p_session_key_version and hs.session_hmac=p_session_hmac
    and hs.revoked_at is null and hs.expires_at>statement_timestamp()
    and hs.token_generation=t.token_generation and hs.session_epoch=t.session_epoch and t.revoked_at is null
    and g.status='published'
  order by s.placement_kind,s.location_id,s.paint_record_id,s.id;
$$;

create function paint_guide_private.paint_guide_photo_fail(p_actor uuid,p_attempt uuid,p_generation bigint,p_failure_code text)
returns boolean language plpgsql volatile security invoker set search_path=''
as $$
declare v public.paint_guide_photo_versions%rowtype; s public.paint_guide_photo_slots%rowtype;
begin
  if p_actor is null or p_attempt is null or p_generation is null
    or p_failure_code is null or p_failure_code !~ '^[a-z0-9_]{1,64}$' then
    raise exception using errcode='22023',message='Required failure fields are missing or invalid.';
  end if;
  perform paint_guide_private.require_homeowner_staff(p_actor,true);
  select slot_id into v.slot_id from public.paint_guide_photo_versions where attempt_id=p_attempt;
  if not found then return false; end if;
  select * into s from public.paint_guide_photo_slots where id=v.slot_id for update;
  if not found then return false; end if;
  select * into v from public.paint_guide_photo_versions where slot_id=s.id and attempt_id=p_attempt for update;
  if not found or v.created_by is distinct from p_actor then return false; end if;
  if v.state <> 'uploading' then return v.state='failed' or v.state='cleanup_pending'; end if;
  if v.quarantine_key is not null then perform paint_guide_private.queue_photo_object('paint-guide-quarantine',v.quarantine_key,v.id,'failed_upload',now()); end if;
  if v.full_key is not null then perform paint_guide_private.queue_photo_object('paint-guide-private',v.full_key,v.id,'failed_upload',now()); end if;
  if v.thumbnail_key is not null then perform paint_guide_private.queue_photo_object('paint-guide-private',v.thumbnail_key,v.id,'failed_upload',now()); end if;
  update public.paint_guide_photo_versions set state='failed',failure_code=p_failure_code where id=v.id;
  if s.write_generation=p_generation then
    update public.paint_guide_photo_slots set write_generation=write_generation+1,updated_at=now() where id=s.id;
  end if;
  return true;
end $$;

create function paint_guide_private.paint_guide_staff_photo_read(p_actor uuid,p_version uuid,p_variant text)
returns table(guide_id uuid,object_key text,content_length bigint,width integer,height integer)
language plpgsql stable security invoker set search_path=''
as $$
begin
  if p_actor is null or p_version is null or p_variant not in ('full','thumb') then return; end if;
  if not exists(select 1 from public.profiles p where p.user_id=p_actor and p.active and p.role in ('owner','supervisor')) then
    raise exception using errcode='42501',message='Staff authorization required.';
  end if;
  return query
    select s.guide_id,
      case p_variant when 'full' then v.full_key else v.thumbnail_key end,
      case p_variant when 'full' then v.full_bytes else v.thumbnail_bytes end,
      case p_variant when 'full' then v.width else least(v.width,480) end,
      case p_variant when 'full' then v.height else least(v.height,480) end
    from public.paint_guide_photo_slots s
    join public.paint_guide_photo_versions v on v.slot_id=s.id and v.id=s.current_version_id and v.state='ready'
    where v.id=p_version;
end $$;

create function public.paint_guide_photo_fail(p_actor uuid,p_attempt uuid,p_generation bigint,p_failure_code text)
returns boolean language sql volatile security invoker set search_path=''
as $$ select paint_guide_private.paint_guide_photo_fail(p_actor,p_attempt,p_generation,p_failure_code); $$;
create function public.paint_guide_staff_photo_read(p_actor uuid,p_version uuid,p_variant text)
returns table(guide_id uuid,object_key text,content_length bigint,width integer,height integer)
language sql stable security invoker set search_path=''
as $$ select * from paint_guide_private.paint_guide_staff_photo_read(p_actor,p_version,p_variant); $$;

create function public.paint_guide_photo_reserve(p_actor uuid,p_guide uuid,p_placement text,p_location uuid,p_record uuid,p_attempt uuid)
returns jsonb language sql volatile security invoker set search_path=''
as $$ select paint_guide_private.paint_guide_photo_reserve(p_actor,p_guide,p_placement,p_location,p_record,p_attempt); $$;
create function public.paint_guide_photo_promote(p_actor uuid,p_attempt uuid,p_generation bigint,p_width integer,p_height integer,p_full_bytes bigint,p_thumb_bytes bigint,p_outputs_verified boolean,p_original_deleted boolean)
returns uuid language sql volatile security invoker set search_path=''
as $$ select paint_guide_private.paint_guide_photo_promote(p_actor,p_attempt,p_generation,p_width,p_height,p_full_bytes,p_thumb_bytes,p_outputs_verified,p_original_deleted); $$;
create function public.paint_guide_photo_delete(p_actor uuid,p_slot uuid)
returns void language sql volatile security invoker set search_path=''
as $$ select paint_guide_private.paint_guide_photo_delete(p_actor,p_slot); $$;
create function public.paint_guide_homeowner_photo_read(p_session_key_version smallint,p_session_hmac bytea,p_version uuid,p_variant text)
returns table(guide_id uuid,object_key text,content_length bigint,width integer,height integer) language sql stable security invoker set search_path=''
as $$ select * from paint_guide_private.paint_guide_homeowner_photo_read(p_session_key_version,p_session_hmac,p_version,p_variant); $$;
create function public.paint_guide_homeowner_photo_list(p_session_key_version smallint,p_session_hmac bytea)
returns table(slot_id uuid,version_id uuid,placement_kind text,location_id uuid,paint_record_id uuid)
language sql stable security invoker set search_path=''
as $$ select * from paint_guide_private.paint_guide_homeowner_photo_list(p_session_key_version,p_session_hmac); $$;
create function public.paint_guide_photo_cleanup_claim(p_batch integer default 50)
returns table(id bigint,bucket_id text,object_key text,claim_generation bigint) language sql volatile security invoker set search_path=''
as $$ select * from paint_guide_private.photo_cleanup_claim(p_batch); $$;
create function public.paint_guide_photo_cleanup_complete(p_id bigint,p_claim_generation bigint,p_delete_succeeded boolean)
returns boolean language sql volatile security invoker set search_path=''
as $$ select paint_guide_private.photo_cleanup_complete(p_id,p_claim_generation,p_delete_succeeded); $$;
create function public.paint_guide_photo_cleanup_fail(p_id bigint,p_claim_generation bigint,p_error_code text)
returns boolean language sql volatile security invoker set search_path=''
as $$ select paint_guide_private.photo_cleanup_fail(p_id,p_claim_generation,p_error_code); $$;
create function public.paint_guide_photo_cleanup_sweep()
returns integer language sql volatile security invoker set search_path=''
as $$ select paint_guide_private.photo_cleanup_sweep(); $$;

alter function paint_guide_private.paint_guide_photo_reserve(uuid,uuid,text,uuid,uuid,uuid) owner to postgres;
alter function paint_guide_private.paint_guide_photo_promote(uuid,uuid,bigint,integer,integer,bigint,bigint,boolean,boolean) owner to postgres;
alter function paint_guide_private.paint_guide_photo_delete(uuid,uuid) owner to postgres;
alter function paint_guide_private.paint_guide_photo_fail(uuid,uuid,bigint,text) owner to postgres;
alter function paint_guide_private.paint_guide_staff_photo_read(uuid,uuid,text) owner to postgres;
alter function paint_guide_private.paint_guide_homeowner_photo_read(smallint,bytea,uuid,text) owner to postgres;
alter function paint_guide_private.paint_guide_homeowner_photo_list(smallint,bytea) owner to postgres;
alter function paint_guide_private.photo_cleanup_claim(integer) owner to postgres;
alter function paint_guide_private.photo_cleanup_complete(bigint,bigint,boolean) owner to postgres;
alter function paint_guide_private.photo_cleanup_fail(bigint,bigint,text) owner to postgres;
alter function paint_guide_private.photo_cleanup_sweep() owner to postgres;
alter function public.paint_guide_photo_reserve(uuid,uuid,text,uuid,uuid,uuid) owner to postgres;
alter function public.paint_guide_photo_promote(uuid,uuid,bigint,integer,integer,bigint,bigint,boolean,boolean) owner to postgres;
alter function public.paint_guide_photo_delete(uuid,uuid) owner to postgres;
alter function public.paint_guide_photo_fail(uuid,uuid,bigint,text) owner to postgres;
alter function public.paint_guide_staff_photo_read(uuid,uuid,text) owner to postgres;
alter function public.paint_guide_homeowner_photo_read(smallint,bytea,uuid,text) owner to postgres;
alter function public.paint_guide_homeowner_photo_list(smallint,bytea) owner to postgres;
alter function public.paint_guide_photo_cleanup_claim(integer) owner to postgres;
alter function public.paint_guide_photo_cleanup_complete(bigint,bigint,boolean) owner to postgres;
alter function public.paint_guide_photo_cleanup_fail(bigint,bigint,text) owner to postgres;
alter function public.paint_guide_photo_cleanup_sweep() owner to postgres;
revoke all on function paint_guide_private.paint_guide_photo_reserve(uuid,uuid,text,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function paint_guide_private.paint_guide_photo_promote(uuid,uuid,bigint,integer,integer,bigint,bigint,boolean,boolean) from public,anon,authenticated;
revoke all on function paint_guide_private.paint_guide_photo_delete(uuid,uuid) from public,anon,authenticated;
revoke all on function paint_guide_private.paint_guide_photo_fail(uuid,uuid,bigint,text) from public,anon,authenticated;
revoke all on function paint_guide_private.paint_guide_staff_photo_read(uuid,uuid,text) from public,anon,authenticated;
revoke all on function paint_guide_private.paint_guide_homeowner_photo_read(smallint,bytea,uuid,text) from public,anon,authenticated;
revoke all on function paint_guide_private.paint_guide_homeowner_photo_list(smallint,bytea) from public,anon,authenticated;
grant execute on function paint_guide_private.paint_guide_photo_reserve(uuid,uuid,text,uuid,uuid,uuid) to service_role;
grant execute on function paint_guide_private.paint_guide_photo_promote(uuid,uuid,bigint,integer,integer,bigint,bigint,boolean,boolean) to service_role;
grant execute on function paint_guide_private.paint_guide_photo_delete(uuid,uuid) to service_role;
grant execute on function paint_guide_private.paint_guide_photo_fail(uuid,uuid,bigint,text) to service_role;
grant execute on function paint_guide_private.paint_guide_staff_photo_read(uuid,uuid,text) to service_role;
grant execute on function paint_guide_private.paint_guide_homeowner_photo_read(smallint,bytea,uuid,text) to service_role;
grant execute on function paint_guide_private.paint_guide_homeowner_photo_list(smallint,bytea) to service_role;
revoke all on function public.paint_guide_photo_reserve(uuid,uuid,text,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.paint_guide_photo_promote(uuid,uuid,bigint,integer,integer,bigint,bigint,boolean,boolean) from public,anon,authenticated;
revoke all on function public.paint_guide_photo_delete(uuid,uuid) from public,anon,authenticated;
revoke all on function public.paint_guide_photo_fail(uuid,uuid,bigint,text) from public,anon,authenticated;
revoke all on function public.paint_guide_staff_photo_read(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.paint_guide_homeowner_photo_read(smallint,bytea,uuid,text) from public,anon,authenticated;
revoke all on function public.paint_guide_homeowner_photo_list(smallint,bytea) from public,anon,authenticated;
revoke all on function public.paint_guide_photo_cleanup_claim(integer) from public,anon,authenticated;
revoke all on function public.paint_guide_photo_cleanup_complete(bigint,bigint,boolean) from public,anon,authenticated;
revoke all on function public.paint_guide_photo_cleanup_fail(bigint,bigint,text) from public,anon,authenticated;
revoke all on function public.paint_guide_photo_cleanup_sweep() from public,anon,authenticated;
grant execute on function public.paint_guide_photo_reserve(uuid,uuid,text,uuid,uuid,uuid) to service_role;
grant execute on function public.paint_guide_photo_promote(uuid,uuid,bigint,integer,integer,bigint,bigint,boolean,boolean) to service_role;
grant execute on function public.paint_guide_photo_delete(uuid,uuid) to service_role;
grant execute on function public.paint_guide_photo_fail(uuid,uuid,bigint,text) to service_role;
grant execute on function public.paint_guide_staff_photo_read(uuid,uuid,text) to service_role;
grant execute on function public.paint_guide_homeowner_photo_read(smallint,bytea,uuid,text) to service_role;
grant execute on function public.paint_guide_homeowner_photo_list(smallint,bytea) to service_role;
grant execute on function public.paint_guide_photo_cleanup_claim(integer) to service_role;
grant execute on function public.paint_guide_photo_cleanup_complete(bigint,bigint,boolean) to service_role;
grant execute on function public.paint_guide_photo_cleanup_fail(bigint,bigint,text) to service_role;
grant execute on function public.paint_guide_photo_cleanup_sweep() to service_role;

-- Bucket-scoped restrictive denial. Preserve all existing global Storage grants and other policies.
create policy "Deny client access to Paint Guide photo buckets"
on storage.objects as restrictive for all to anon,authenticated
using (bucket_id not in ('paint-guide-quarantine','paint-guide-private'))
with check (bucket_id not in ('paint-guide-quarantine','paint-guide-private'));

commit;

