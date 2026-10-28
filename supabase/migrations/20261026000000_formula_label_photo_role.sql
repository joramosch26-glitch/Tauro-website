-- REVIEW PROPOSAL ONLY. Not installed or executed.
-- Forward delta for the locally inspected C3 private photo lifecycle migration.
-- Requires transactional review against the exact deployed migration/schema before use.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

alter table public.paint_guide_photo_slots
  drop constraint paint_guide_photo_slots_placement_kind_check,
  drop constraint pgps_shape;
alter table public.paint_guide_photo_slots
  add constraint paint_guide_photo_slots_placement_kind_check
    check (placement_kind in ('residence_cover','location','record_context','record_formula_label')),
  add constraint pgps_shape check (
    (placement_kind='residence_cover' and location_id is null and paint_record_id is null) or
    (placement_kind='location' and location_id is not null and paint_record_id is null) or
    (placement_kind='record_context' and location_id is not null and paint_record_id is not null) or
    (placement_kind='record_formula_label' and location_id is null and paint_record_id is not null)
  );
create unique index pgps_one_formula_label
  on public.paint_guide_photo_slots(guide_id,paint_record_id)
  where placement_kind='record_formula_label';

-- Bounded headroom for up to 20 MP oriented, lossless full images. The handler
-- enforces the 20 MP product and 20 MiB bytes bounds; no silent resize fallback.
alter table public.paint_guide_photo_versions
  drop constraint paint_guide_photo_versions_width_check,
  drop constraint paint_guide_photo_versions_height_check,
  drop constraint paint_guide_photo_versions_full_bytes_check;
alter table public.paint_guide_photo_versions
  add constraint paint_guide_photo_versions_width_check check (width is null or width between 1 and 20000),
  add constraint paint_guide_photo_versions_height_check check (height is null or height between 1 and 20000),
  add constraint paint_guide_photo_versions_full_bytes_check check (full_bytes is null or full_bytes between 1 and 20971520);
create or replace function paint_guide_private.paint_guide_photo_reserve(
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
     (p_placement='record_formula_label' and p_location is not null) or
     p_placement not in ('residence_cover','location','record_context','record_formula_label') then
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
  elsif p_placement='record_formula_label' then
    if p_location is not null or p_record is null or not exists(
      select 1 from public.paint_records r where r.guide_id=p_guide and r.id=p_record
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
create or replace function paint_guide_private.paint_guide_photo_promote(
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
     or p_thumb_bytes not between 1 and 1048576
     or p_width::bigint*p_height::bigint > 20000000
     or (s.placement_kind='record_formula_label' and (p_width not between 1 and 20000 or p_height not between 1 and 20000 or p_full_bytes not between 1 and 20971520))
     or (s.placement_kind<>'record_formula_label' and (p_width not between 1 and 2400 or p_height not between 1 and 2400 or p_full_bytes not between 1 and 4194304)) then
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

commit;



