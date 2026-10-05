-- Metadata-only staff status. Existing token/session grants and RPCs are unchanged.
begin;

create function paint_guide_private.homeowner_access_status(
  p_guide_id uuid, p_actor_id uuid
)
returns jsonb
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  v_status jsonb;
begin
  -- Same lock namespace/order as recover; revalidate staff after any wait.
  perform paint_guide_private.lock_homeowner_guide(p_guide_id, true);
  perform paint_guide_private.require_homeowner_staff(p_actor_id, false);
  -- One fresh snapshot for lifecycle and access metadata, never recovery material.
  select jsonb_build_object(
    'guide_id', g.id,
    'guide_status', g.status,
    'access_state', case when t.guide_id is null then 'absent'
      when t.revoked_at is not null then 'revoked' else 'active' end,
    'token_generation', t.token_generation,
    'session_epoch', t.session_epoch,
    'homeowner_exchange_available',
      g.status = 'published' and t.guide_id is not null and t.revoked_at is null
  ) into v_status
  from public.paint_guides as g
  left join paint_guide_private.homeowner_access_tokens as t on t.guide_id = g.id
  where g.id = p_guide_id;
  return v_status; -- SQL NULL for a missing guide, only after staff authorization.
end;
$$;

create function public.paint_guide_homeowner_access_status(
  p_guide_id uuid, p_actor_id uuid
)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$
  select paint_guide_private.homeowner_access_status(p_guide_id, p_actor_id);
$$;

alter function paint_guide_private.homeowner_access_status(uuid, uuid) owner to postgres;
revoke all on function paint_guide_private.homeowner_access_status(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function paint_guide_private.homeowner_access_status(uuid, uuid) to service_role;

alter function public.paint_guide_homeowner_access_status(uuid, uuid) owner to postgres;
revoke all on function public.paint_guide_homeowner_access_status(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.paint_guide_homeowner_access_status(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
commit;
