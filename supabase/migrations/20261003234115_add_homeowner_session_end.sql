-- Persistently revoke one homeowner session without exposing its existence.
-- This is service-role-only through the public RPC wrapper below.
begin;

create function paint_guide_private.homeowner_session_end(
  p_session_key_version smallint,
  p_session_hmac bytea
)
returns boolean
language plpgsql volatile security invoker set search_path = ''
as $$
begin
  -- Keep the public result non-enumerating even for malformed/unknown values.
  if p_session_key_version is null or p_session_key_version < 1
    or p_session_hmac is null or octet_length(p_session_hmac) <> 32 then
    return true;
  end if;

  update paint_guide_private.homeowner_sessions as s
  set revoked_at = clock_timestamp()
  where s.session_key_version = p_session_key_version
    and s.session_hmac = p_session_hmac
    and s.revoked_at is null;

  -- Unknown and previously revoked sessions intentionally have the same result.
  return true;
end;
$$;

create function public.paint_guide_homeowner_session_end(
  p_session_key_version smallint,
  p_session_hmac bytea
)
returns boolean
language sql volatile security invoker set search_path = ''
as $$
  select paint_guide_private.homeowner_session_end(p_session_key_version, p_session_hmac);
$$;

-- The SECURITY INVOKER helper executes as service_role through the wrapper.
grant update on table paint_guide_private.homeowner_sessions to service_role;

alter function paint_guide_private.homeowner_session_end(smallint, bytea) owner to postgres;
revoke all on function paint_guide_private.homeowner_session_end(smallint, bytea)
  from public, anon, authenticated, service_role;
grant execute on function paint_guide_private.homeowner_session_end(smallint, bytea) to service_role;

alter function public.paint_guide_homeowner_session_end(smallint, bytea) owner to postgres;
revoke all on function public.paint_guide_homeowner_session_end(smallint, bytea)
  from public, anon, authenticated, service_role;
grant execute on function public.paint_guide_homeowner_session_end(smallint, bytea) to service_role;

commit;
