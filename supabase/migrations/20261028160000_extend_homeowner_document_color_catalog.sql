-- Stage B: expose optional color-reference metadata after compatible application
-- code has been deployed. Keep this RPC contract unchanged until that point.
begin;

create or replace function paint_guide_private.homeowner_document_read(
  p_session_key_version smallint, p_session_hmac bytea
)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'schema_version', 1,
    'guide', jsonb_build_object(
      'residence_name', g.residence_name, 'primary_scope_note', g.primary_scope_note,
      'city', g.city, 'state', g.state, 'property_type', g.property_type
    ),
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'parent_id', l.parent_id, 'name', l.name,
        'room_notes', l.room_notes, 'sort_order', l.sort_order, 'created_at', l.created_at
      )
        order by l.sort_order, l.created_at, l.id)
      from public.guide_locations as l where l.guide_id = g.id
    ), '[]'::jsonb),
    'records', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'section', r.section, 'surface', r.surface, 'brand', r.brand,
        'product', r.product, 'color_name', r.color_name, 'color_code', r.color_code,
        'swatch_hex', r.swatch_hex, 'swatch_provenance', r.swatch_provenance,
        'color_origin_brand', r.color_origin_brand, 'color_reference_hex', r.color_reference_hex,
        'color_reference_provider', r.color_reference_provider, 'color_reference_url', r.color_reference_url,
        'color_reference_retrieved_at', r.color_reference_retrieved_at,
        'sheen', r.sheen, 'notes', r.notes, 'sort_order', r.sort_order, 'created_at', r.created_at
      ) order by case r.section when 'primary' then 0 when 'exception' then 1 else 2 end,
        r.sort_order, r.created_at, r.id)
      from public.paint_records as r where r.guide_id = g.id
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object('paint_record_id', a.paint_record_id, 'location_id', a.location_id)
        order by a.location_id, a.paint_record_id)
      from public.paint_record_locations as a where a.guide_id = g.id
    ), '[]'::jsonb),
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slot_id', photo_slot.id, 'version_id', photo_version.id,
        'placement_kind', photo_slot.placement_kind, 'location_id', photo_slot.location_id,
        'paint_record_id', photo_slot.paint_record_id
      ) order by photo_slot.placement_kind, photo_slot.location_id, photo_slot.paint_record_id, photo_slot.id)
      from public.paint_guide_photo_slots as photo_slot
      join public.paint_guide_photo_versions as photo_version
        on photo_version.guide_id = photo_slot.guide_id
        and photo_version.slot_id = photo_slot.id
        and photo_version.id = photo_slot.current_version_id
        and photo_version.state = 'ready'
      where photo_slot.guide_id = g.id
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

commit;
