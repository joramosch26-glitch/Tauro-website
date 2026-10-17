-- LOCAL ONLY: isolated 74000000-* fixtures, all writes rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
create temporary table staff_status_results (name text primary key, value jsonb);
grant select, insert on pg_temp.staff_status_results to service_role;

insert into auth.users (id, aud, role, email) values
  ('74000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'status-owner@example.test'),
  ('74000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'status-supervisor@example.test'),
  ('74000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'status-inactive@example.test'),
  ('74000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'status-no-profile@example.test');
insert into public.profiles (user_id, role, active) values
  ('74000000-0000-4000-8000-000000000001', 'owner', true),
  ('74000000-0000-4000-8000-000000000002', 'supervisor', true),
  ('74000000-0000-4000-8000-000000000003', 'owner', false);
insert into public.paint_guides (id, residence_name, status) values
  ('74000000-0000-4000-8000-000000000101', 'LOCAL Status Draft', 'draft'),
  ('74000000-0000-4000-8000-000000000102', 'LOCAL Status Published', 'published'),
  ('74000000-0000-4000-8000-000000000103', 'LOCAL Status Archived', 'archived');

select extensions.ok(to_regprocedure(function_name || '(uuid,uuid)') is not null,
  'Exact status signature: ' || function_name)
from unnest(array['public.paint_guide_homeowner_access_status',
  'paint_guide_private.homeowner_access_status']) as function_name;
select extensions.ok(not has_function_privilege(browser_role, function_name || '(uuid,uuid)', 'EXECUTE'),
  browser_role || ' has no status EXECUTE: ' || function_name)
from unnest(array['public', 'anon', 'authenticated']) as browser_role
cross join unnest(array['public.paint_guide_homeowner_access_status',
  'paint_guide_private.homeowner_access_status']) as function_name;
select extensions.ok(has_function_privilege('service_role', function_name || '(uuid,uuid)', 'EXECUTE'),
  'service_role has status EXECUTE: ' || function_name)
from unnest(array['public.paint_guide_homeowner_access_status',
  'paint_guide_private.homeowner_access_status']) as function_name;
select extensions.ok(not p.prosecdef and p.provolatile = 'v' and 'search_path=""' = any(p.proconfig),
  'Status is volatile INVOKER with empty search_path: ' || n.nspname)
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where (n.nspname = 'public' and p.proname = 'paint_guide_homeowner_access_status')
  or (n.nspname = 'paint_guide_private' and p.proname = 'homeowner_access_status');
select extensions.throws_ok($sql$insert into public.profiles (user_id,role)
  values ('74000000-0000-4000-8000-000000000004'::uuid,'admin')$sql$,
  '23514', null, 'Unsupported staff role cannot be represented by profiles constraint');

set local role anon;
select extensions.throws_ok($sql$select public.paint_guide_homeowner_access_status(
  '74000000-0000-4000-8000-000000000101'::uuid,'74000000-0000-4000-8000-000000000001'::uuid)$sql$,
  '42501', null, 'anon direct status execution denied');
reset role;
set local role authenticated;
select extensions.throws_ok($sql$select public.paint_guide_homeowner_access_status(
  '74000000-0000-4000-8000-000000000101'::uuid,'74000000-0000-4000-8000-000000000001'::uuid)$sql$,
  '42501', null, 'authenticated owner cannot execute status directly');
reset role;

set local role service_role;
select extensions.throws_ok($sql$select public.paint_guide_homeowner_access_status(
  '74000000-0000-4000-8000-000000000101'::uuid,'74000000-0000-4000-8000-000000000003'::uuid)$sql$,
  '42501', null, 'Inactive staff independently denied by DB');
select extensions.throws_ok($sql$select public.paint_guide_homeowner_access_status(
  '74000000-0000-4000-8000-000000000101'::uuid,'74000000-0000-4000-8000-000000000004'::uuid)$sql$,
  '42501', null, 'Missing profile independently denied by DB');
select extensions.throws_ok($sql$select public.paint_guide_homeowner_access_status(
  '74000000-0000-4000-8000-000000000101'::uuid,null::uuid)$sql$,
  '42501', null, 'Null actor denied');
select extensions.throws_ok($sql$select public.paint_guide_homeowner_access_status(
  null::uuid,'74000000-0000-4000-8000-000000000001'::uuid)$sql$,
  '22023', null, 'Null guide denied');
select extensions.ok(public.paint_guide_homeowner_access_status(
  '74000000-0000-4000-8000-000000000199'::uuid,'74000000-0000-4000-8000-000000000001'::uuid) is null,
  'Missing guide returns SQL NULL to authorized staff');

insert into pg_temp.staff_status_results (name,value)
select 'absent-' || g.status, public.paint_guide_homeowner_access_status(g.id,
  '74000000-0000-4000-8000-000000000001'::uuid)
from public.paint_guides g where g.id in ('74000000-0000-4000-8000-000000000101',
  '74000000-0000-4000-8000-000000000102','74000000-0000-4000-8000-000000000103');
select extensions.ok(value->>'access_state' = 'absent' and value->'token_generation' = 'null'::jsonb
  and value->'session_epoch' = 'null'::jsonb and value->'homeowner_exchange_available' = 'false'::jsonb,
  'Absent access metadata: ' || name)
from pg_temp.staff_status_results order by name;

insert into pg_temp.staff_status_results (name,value)
select 'issue-' || g.status, public.paint_guide_homeowner_access_issue(g.id,
  '74000000-0000-4000-8000-000000000002'::uuid,1::smallint,1::smallint,
  decode(repeat(case g.status when 'draft' then '91' when 'published' then '92' else '93' end,32),'hex'),
  1::smallint,decode(repeat('cc',47),'hex'),
  decode(repeat(case g.status when 'draft' then '91' when 'published' then '92' else '93' end,12),'hex'),
  decode(repeat('ff',16),'hex'))
from public.paint_guides g where g.id in ('74000000-0000-4000-8000-000000000101',
  '74000000-0000-4000-8000-000000000102','74000000-0000-4000-8000-000000000103');
insert into pg_temp.staff_status_results (name,value)
select 'active-' || g.status, public.paint_guide_homeowner_access_status(g.id,
  '74000000-0000-4000-8000-000000000002'::uuid)
from public.paint_guides g where g.id in ('74000000-0000-4000-8000-000000000101',
  '74000000-0000-4000-8000-000000000102','74000000-0000-4000-8000-000000000103');
select extensions.ok(value->>'access_state' = 'active' and value->'token_generation' = '1'::jsonb
  and value->'session_epoch' = '1'::jsonb
  and (value->>'homeowner_exchange_available')::boolean = (value->>'guide_status' = 'published'),
  'Supervisor reads correct lifecycle/generation/epoch: ' || name)
from pg_temp.staff_status_results where name like 'active-%' order by name;
select extensions.ok((select array_agg(k order by k) from jsonb_object_keys(value) k)
  = array['access_state','guide_id','guide_status','homeowner_exchange_available','session_epoch','token_generation']::text[],
  'Exactly six non-secret status fields: ' || name)
from pg_temp.staff_status_results where name like 'active-%' or name like 'absent-%' order by name;

insert into pg_temp.staff_status_results (name,value) values ('revoke', public.paint_guide_homeowner_access_revoke(
  '74000000-0000-4000-8000-000000000102'::uuid,'74000000-0000-4000-8000-000000000001'::uuid,1::bigint,1::bigint));
insert into pg_temp.staff_status_results (name,value) values ('revoked', public.paint_guide_homeowner_access_status(
  '74000000-0000-4000-8000-000000000102'::uuid,'74000000-0000-4000-8000-000000000002'::uuid));
select extensions.ok((select value from pg_temp.staff_status_results where name='revoked') = jsonb_build_object(
  'guide_id','74000000-0000-4000-8000-000000000102','guide_status','published','access_state','revoked',
  'token_generation',1,'session_epoch',2,'homeowner_exchange_available',false), 'Revoked status has correct generation/epoch and no recovery material');
select extensions.ok((select count(*) from paint_guide_private.homeowner_sessions
  where guide_id in ('74000000-0000-4000-8000-000000000101','74000000-0000-4000-8000-000000000102',
    '74000000-0000-4000-8000-000000000103'))=0, 'Issue/recover/status do not create homeowner sessions');
select extensions.ok(public.paint_guide_homeowner_access_status(
  '74000000-0000-4000-8000-000000000101'::uuid,'74000000-0000-4000-8000-000000000001'::uuid)
  = (select value from pg_temp.staff_status_results where name='active-draft'), 'Repeated owner status is non-mutating');
reset role;

-- Existing lifecycle invalidation must remain visible without rotating access.
update public.paint_guides set status='published' where id='74000000-0000-4000-8000-000000000101';
update public.paint_guides set status='draft' where id='74000000-0000-4000-8000-000000000101';
set local role service_role;
select extensions.ok(public.paint_guide_homeowner_access_status(
  '74000000-0000-4000-8000-000000000101'::uuid,'74000000-0000-4000-8000-000000000001'::uuid)
  = jsonb_build_object('guide_id','74000000-0000-4000-8000-000000000101','guide_status','draft',
    'access_state','active','token_generation',1,'session_epoch',2,'homeowner_exchange_available',false),
  'Unpublish changes epoch, not generation; draft access remains active but unusable');
reset role;
select * from extensions.finish();
rollback;
