-- LOCAL-ONLY pgTAP tests/spec. NEVER run against a linked/cloud database.
-- Uses only synthetic 71000000-* fixtures; never Ramos Residence.
-- Prerequisite in a separately authorized local validation phase: all local
-- migrations applied to an isolated disposable Supabase PostgreSQL database.
-- This turn does NOT apply migrations, start a database, or run this file.
-- Assertions roll back fixtures, extension installation, and all security writes.
begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

create temporary table homeowner_test_results (name text primary key, value jsonb);
grant select, insert on table pg_temp.homeowner_test_results to service_role;

insert into auth.users (id, aud, role, email) values
  ('71000000-0000-4000-8000-000000000001'::uuid, 'authenticated', 'authenticated', 'owner@homeowner-local.invalid'),
  ('71000000-0000-4000-8000-000000000002'::uuid, 'authenticated', 'authenticated', 'supervisor@homeowner-local.invalid'),
  ('71000000-0000-4000-8000-000000000003'::uuid, 'authenticated', 'authenticated', 'inactive@homeowner-local.invalid');
insert into public.profiles (user_id, role, active) values
  ('71000000-0000-4000-8000-000000000001'::uuid, 'owner', true), ('71000000-0000-4000-8000-000000000002'::uuid, 'supervisor', true),
  ('71000000-0000-4000-8000-000000000003'::uuid, 'owner', false);
insert into public.paint_guides (id, residence_name, status, primary_scope_note) values
  ('71000000-0000-4000-8000-000000000101'::uuid, 'LOCAL TEST Published Guide', 'published', 'LOCAL TEST scope'),
  ('71000000-0000-4000-8000-000000000102'::uuid, 'LOCAL TEST Draft Guide', 'draft', null),
  ('71000000-0000-4000-8000-000000000103'::uuid, 'LOCAL TEST Archived Guide', 'archived', null),
  ('71000000-0000-4000-8000-000000000104'::uuid, 'LOCAL TEST Collision Guide', 'published', null),
  ('71000000-0000-4000-8000-000000000105'::uuid, 'LOCAL TEST Invalid Material Guide', 'published', null);
insert into public.guide_locations (id, guide_id, parent_id, location_type, name) values
  ('71000000-0000-4000-8000-000000000201'::uuid, '71000000-0000-4000-8000-000000000101'::uuid, null, 'floor', 'LOCAL TEST Parent'),
  ('71000000-0000-4000-8000-000000000202'::uuid, '71000000-0000-4000-8000-000000000101'::uuid, '71000000-0000-4000-8000-000000000201'::uuid, 'room', 'LOCAL TEST Child');
insert into public.paint_records (id, guide_id, section, surface, color_name) values
  ('71000000-0000-4000-8000-000000000301'::uuid, '71000000-0000-4000-8000-000000000101'::uuid, 'primary', 'LOCAL TEST Walls', 'LOCAL TEST Color'),
  ('71000000-0000-4000-8000-000000000302'::uuid, '71000000-0000-4000-8000-000000000101'::uuid, 'exception', 'LOCAL TEST Trim', 'LOCAL TEST Accent'),
  ('71000000-0000-4000-8000-000000000303'::uuid, '71000000-0000-4000-8000-000000000102'::uuid, 'primary', 'LOCAL TEST Private Surface', 'LOCAL TEST Private Color');
insert into public.paint_record_locations (guide_id, paint_record_id, location_id)
values ('71000000-0000-4000-8000-000000000101'::uuid, '71000000-0000-4000-8000-000000000301'::uuid, '71000000-0000-4000-8000-000000000202'::uuid);

-- Catalog assertions cover both tables and every new helper/entry point.
select extensions.ok(not has_table_privilege(browser_role, table_name, operation),
  browser_role || ' has no ' || operation || ' on ' || table_name)
from unnest(array['anon', 'authenticated']) as browser_role
cross join unnest(array[
  'paint_guide_private.homeowner_access_tokens',
  'paint_guide_private.homeowner_sessions'
]) as table_name
cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as operation;

select extensions.ok(c.relrowsecurity, 'RLS enabled on ' || c.relname)
from pg_catalog.pg_class as c
join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
where n.nspname = 'paint_guide_private'
  and c.relname in ('homeowner_access_tokens', 'homeowner_sessions');
select extensions.is((
  select count(*)::integer from pg_catalog.pg_policies
  where schemaname = 'paint_guide_private'
    and tablename in ('homeowner_access_tokens', 'homeowner_sessions')
), 0, 'No browser policies on security tables');
select extensions.ok(has_schema_privilege('authenticated', 'paint_guide_private', 'USAGE'),
  'Existing authenticated helper schema USAGE preserved');

select extensions.ok(exists (
  select 1
  from pg_catalog.pg_class as i
  join pg_catalog.pg_namespace as n on n.oid = i.relnamespace
  join pg_catalog.pg_index as ix on ix.indexrelid = i.oid
  join pg_catalog.pg_class as t on t.oid = ix.indrelid
  join pg_catalog.pg_namespace as tn on tn.oid = t.relnamespace
  join pg_catalog.pg_am as am on am.oid = i.relam
  join pg_catalog.pg_attribute as a on a.attrelid = t.oid and a.attnum = ix.indkey[0]
  where n.nspname = 'paint_guide_private'
    and i.relname = 'homeowner_access_tokens_created_by_idx'
    and tn.nspname = 'paint_guide_private'
    and t.relname = 'homeowner_access_tokens'
    and am.amname = 'btree' and ix.indnatts = 1 and a.attname = 'created_by'
), 'Created-by FK has a covering B-tree index');
select extensions.ok(exists (
  select 1
  from pg_catalog.pg_class as i
  join pg_catalog.pg_namespace as n on n.oid = i.relnamespace
  join pg_catalog.pg_index as ix on ix.indexrelid = i.oid
  join pg_catalog.pg_class as t on t.oid = ix.indrelid
  join pg_catalog.pg_namespace as tn on tn.oid = t.relnamespace
  join pg_catalog.pg_am as am on am.oid = i.relam
  join pg_catalog.pg_attribute as a on a.attrelid = t.oid and a.attnum = ix.indkey[0]
  where n.nspname = 'paint_guide_private'
    and i.relname = 'homeowner_access_tokens_rotated_by_idx'
    and tn.nspname = 'paint_guide_private'
    and t.relname = 'homeowner_access_tokens'
    and am.amname = 'btree' and ix.indnatts = 1 and a.attname = 'rotated_by'
), 'Rotated-by FK has a covering B-tree index');
select extensions.ok(exists (
  select 1
  from pg_catalog.pg_class as i
  join pg_catalog.pg_namespace as n on n.oid = i.relnamespace
  join pg_catalog.pg_index as ix on ix.indexrelid = i.oid
  join pg_catalog.pg_class as t on t.oid = ix.indrelid
  join pg_catalog.pg_namespace as tn on tn.oid = t.relnamespace
  join pg_catalog.pg_am as am on am.oid = i.relam
  join pg_catalog.pg_attribute as a on a.attrelid = t.oid and a.attnum = ix.indkey[0]
  where n.nspname = 'paint_guide_private'
    and i.relname = 'homeowner_access_tokens_revoked_by_idx'
    and tn.nspname = 'paint_guide_private'
    and t.relname = 'homeowner_access_tokens'
    and am.amname = 'btree' and ix.indnatts = 1 and a.attname = 'revoked_by'
), 'Revoked-by FK has a covering B-tree index');

select extensions.ok(has_table_privilege('service_role', table_name, 'SELECT'),
  'Explicit core service SELECT: ' || table_name)
from unnest(array['public.paint_guides', 'public.guide_locations',
  'public.paint_records', 'public.paint_record_locations', 'public.profiles']) as table_name;

select extensions.ok(not has_function_privilege(browser_role, p.oid, 'EXECUTE'),
  browser_role || ' cannot execute ' || p.oid::regprocedure::text)
from pg_catalog.pg_proc as p
join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
cross join unnest(array['anon', 'authenticated']) as browser_role
where (n.nspname = 'public' and p.proname like 'paint_guide_homeowner_%')
  or (n.nspname = 'paint_guide_private' and p.proname in (
    'set_homeowner_access_updated_at', 'require_homeowner_staff',
    'validate_homeowner_token_material', 'lock_homeowner_guide',
    'homeowner_access_material', 'invalidate_homeowner_sessions_on_unpublish',
    'homeowner_access_issue', 'homeowner_access_recover', 'homeowner_access_rotate',
    'homeowner_access_revoke', 'homeowner_session_exchange', 'homeowner_document_read'
  ));

select extensions.ok(p.prosecdef = (p.proname = 'invalidate_homeowner_sessions_on_unpublish'),
  'Definer restricted to status trigger: ' || p.oid::regprocedure::text)
from pg_catalog.pg_proc as p
join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
where (n.nspname = 'public' and p.proname like 'paint_guide_homeowner_%')
  or (n.nspname = 'paint_guide_private' and p.proname in (
    'set_homeowner_access_updated_at', 'require_homeowner_staff',
    'validate_homeowner_token_material', 'lock_homeowner_guide',
    'homeowner_access_material', 'invalidate_homeowner_sessions_on_unpublish',
    'homeowner_access_issue', 'homeowner_access_recover', 'homeowner_access_rotate',
    'homeowner_access_revoke', 'homeowner_session_exchange', 'homeowner_document_read'
  ));

select extensions.is(pg_catalog.pg_get_userbyid(p.proowner), 'postgres', 'Explicit postgres owner')
from pg_catalog.pg_proc as p
join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
where (n.nspname = 'public' and p.proname like 'paint_guide_homeowner_%')
  or (n.nspname = 'paint_guide_private' and p.proname in (
    'set_homeowner_access_updated_at', 'require_homeowner_staff',
    'validate_homeowner_token_material', 'lock_homeowner_guide',
    'homeowner_access_material', 'invalidate_homeowner_sessions_on_unpublish',
    'homeowner_access_issue', 'homeowner_access_recover', 'homeowner_access_rotate',
    'homeowner_access_revoke', 'homeowner_session_exchange', 'homeowner_document_read'
  ));

select extensions.ok('search_path=""' = any(p.proconfig), 'Empty search_path')
from pg_catalog.pg_proc as p
join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
where (n.nspname = 'public' and p.proname like 'paint_guide_homeowner_%')
  or (n.nspname = 'paint_guide_private' and p.proname in (
    'set_homeowner_access_updated_at', 'require_homeowner_staff',
    'validate_homeowner_token_material', 'lock_homeowner_guide',
    'homeowner_access_material', 'invalidate_homeowner_sessions_on_unpublish',
    'homeowner_access_issue', 'homeowner_access_recover', 'homeowner_access_rotate',
    'homeowner_access_revoke', 'homeowner_session_exchange', 'homeowner_document_read'
  ));

-- Actual denied reads, not just catalog claims.
set local role anon;
select extensions.throws_ok('select guide_id from paint_guide_private.homeowner_access_tokens', '42501', null, 'anon token read denied');

select extensions.throws_ok('select id from paint_guide_private.homeowner_sessions', '42501', null, 'anon session read denied');

select extensions.throws_ok('select public.paint_guide_homeowner_document_read(1::smallint, decode(repeat(''11'', 32), ''hex''))', '42501', null, 'anon document RPC denied');

reset role;
set local role authenticated;
select extensions.throws_ok('select guide_id from paint_guide_private.homeowner_access_tokens', '42501', null, 'authenticated token read denied');

select extensions.throws_ok('select id from paint_guide_private.homeowner_sessions', '42501', null, 'authenticated session read denied');

select extensions.throws_ok('select public.paint_guide_homeowner_access_recover(''71000000-0000-4000-8000-000000000101''::uuid, ''71000000-0000-4000-8000-000000000001''::uuid)', '42501', null, 'authenticated staff RPC denied');

reset role;

set local role service_role;
insert into pg_temp.homeowner_test_results (name, value) values ('issued', public.paint_guide_homeowner_access_issue('71000000-0000-4000-8000-000000000101'::uuid, '71000000-0000-4000-8000-000000000002'::uuid, 1::smallint, 1::smallint, decode(repeat('11', 32), 'hex'), 1::smallint, decode(repeat('cc', 47), 'hex'), decode(repeat('a1', 12), 'hex'), decode(repeat('ff', 16), 'hex')));

select extensions.is((select value from pg_temp.homeowner_test_results where name = 'issued')->>'outcome', 'issued', 'Supervisor initially issues');
insert into pg_temp.homeowner_test_results (name, value) values ('duplicate', public.paint_guide_homeowner_access_issue('71000000-0000-4000-8000-000000000101'::uuid, '71000000-0000-4000-8000-000000000002'::uuid, 1::smallint, 1::smallint, decode(repeat('12', 32), 'hex'), 1::smallint, decode(repeat('cc', 47), 'hex'), decode(repeat('a2', 12), 'hex'), decode(repeat('ff', 16), 'hex')));

select extensions.is((select value from pg_temp.homeowner_test_results where name = 'duplicate')->>'outcome', 'existing', 'Repeat issue returns existing');
select extensions.ok((select value from pg_temp.homeowner_test_results where name = 'duplicate')->'access' = (select value from pg_temp.homeowner_test_results where name = 'issued')->'access', 'Repeat issue preserves authoritative material');

insert into pg_temp.homeowner_test_results (name, value) values ('recovered', public.paint_guide_homeowner_access_recover('71000000-0000-4000-8000-000000000101'::uuid, '71000000-0000-4000-8000-000000000002'::uuid));

select extensions.ok((select value from pg_temp.homeowner_test_results where name = 'recovered')->'access' = (select value from pg_temp.homeowner_test_results where name = 'issued')->'access', 'Supervisor recovers exact active material');

select extensions.throws_ok('select public.paint_guide_homeowner_access_rotate(''71000000-0000-4000-8000-000000000101''::uuid, ''71000000-0000-4000-8000-000000000002''::uuid, 1::bigint, 1::bigint, 1::smallint, 1::smallint, decode(repeat(''55'', 32), ''hex''), 1::smallint, decode(repeat(''cc'', 47), ''hex''), decode(repeat(''b5'', 12), ''hex''), decode(repeat(''ff'', 16), ''hex''))', '42501', null, 'Supervisor cannot rotate');

select extensions.throws_ok('select public.paint_guide_homeowner_access_revoke(''71000000-0000-4000-8000-000000000101''::uuid, ''71000000-0000-4000-8000-000000000002''::uuid, 1::bigint, 1::bigint)', '42501', null, 'Supervisor cannot revoke');

select extensions.throws_ok('select public.paint_guide_homeowner_access_issue(''71000000-0000-4000-8000-000000000105''::uuid, ''71000000-0000-4000-8000-000000000003''::uuid, 1::smallint, 1::smallint, decode(repeat(''77'', 32), ''hex''), 1::smallint, decode(repeat(''cc'', 47), ''hex''), decode(repeat(''c7'', 12), ''hex''), decode(repeat(''ff'', 16), ''hex''))', '42501', null, 'Inactive actor cannot issue');

select extensions.throws_ok('select public.paint_guide_homeowner_access_recover(''71000000-0000-4000-8000-000000000101''::uuid, ''71000000-0000-4000-8000-000000000004''::uuid)', '42501', null, 'Missing actor cannot recover');

select extensions.throws_ok('select public.paint_guide_homeowner_access_issue(''71000000-0000-4000-8000-000000000199''::uuid, ''71000000-0000-4000-8000-000000000001''::uuid, 1::smallint, 1::smallint, decode(repeat(''77'', 32), ''hex''), 1::smallint, decode(repeat(''cc'', 47), ''hex''), decode(repeat(''c7'', 12), ''hex''), decode(repeat(''ff'', 16), ''hex''))', 'P0002', null, 'Missing guide cannot issue');

select extensions.throws_ok('select public.paint_guide_homeowner_access_issue(''71000000-0000-4000-8000-000000000105''::uuid, ''71000000-0000-4000-8000-000000000001''::uuid, 1::smallint, 1::smallint, decode(repeat(''77'', 31), ''hex''), 1::smallint, decode(repeat(''cc'', 47), ''hex''), decode(repeat(''c7'', 12), ''hex''), decode(repeat(''ff'', 16), ''hex''))', '22023', null, 'Malformed token HMAC rejected');

select extensions.throws_ok('select public.paint_guide_homeowner_access_issue(''71000000-0000-4000-8000-000000000105''::uuid, ''71000000-0000-4000-8000-000000000001''::uuid, 1::smallint, 1::smallint, decode(repeat(''77'', 32), ''hex''), 1::smallint, decode(repeat(''cc'', 47), ''hex''), decode(repeat(''c7'', 11), ''hex''), decode(repeat(''ff'', 16), ''hex''))', '22023', null, 'Malformed nonce rejected');

select extensions.throws_ok('select public.paint_guide_homeowner_access_issue(''71000000-0000-4000-8000-000000000105''::uuid, ''71000000-0000-4000-8000-000000000001''::uuid, 1::smallint, 1::smallint, decode(repeat(''77'', 32), ''hex''), 1::smallint, decode(repeat(''cc'', 47), ''hex''), decode(repeat(''c7'', 12), ''hex''), decode(repeat(''ff'', 15), ''hex''))', '22023', null, 'Malformed tag rejected');

select extensions.throws_ok('select public.paint_guide_homeowner_access_issue(''71000000-0000-4000-8000-000000000104''::uuid, ''71000000-0000-4000-8000-000000000001''::uuid, 1::smallint, 1::smallint, decode(repeat(''11'', 32), ''hex''), 1::smallint, decode(repeat(''cc'', 47), ''hex''), decode(repeat(''a4'', 12), ''hex''), decode(repeat(''ff'', 16), ''hex''))', '23505', null, 'Duplicate token HMAC rejected across guides');

select extensions.throws_ok('select public.paint_guide_homeowner_access_issue(''71000000-0000-4000-8000-000000000104''::uuid, ''71000000-0000-4000-8000-000000000001''::uuid, 1::smallint, 1::smallint, decode(repeat(''44'', 32), ''hex''), 1::smallint, decode(repeat(''cc'', 47), ''hex''), decode(repeat(''a1'', 12), ''hex''), decode(repeat(''ff'', 16), ''hex''))', '23505', null, 'Duplicate encryption nonce rejected across guides');

insert into pg_temp.homeowner_test_results (name, value) values ('draft_issue', public.paint_guide_homeowner_access_issue('71000000-0000-4000-8000-000000000102'::uuid, '71000000-0000-4000-8000-000000000001'::uuid, 1::smallint, 1::smallint, decode(repeat('22', 32), 'hex'), 1::smallint, decode(repeat('cc', 47), 'hex'), decode(repeat('a2', 12), 'hex'), decode(repeat('ff', 16), 'hex')));

insert into pg_temp.homeowner_test_results (name, value) values ('archived_issue', public.paint_guide_homeowner_access_issue('71000000-0000-4000-8000-000000000103'::uuid, '71000000-0000-4000-8000-000000000001'::uuid, 1::smallint, 1::smallint, decode(repeat('33', 32), 'hex'), 1::smallint, decode(repeat('cc', 47), 'hex'), decode(repeat('a3', 12), 'hex'), decode(repeat('ff', 16), 'hex')));

insert into pg_temp.homeowner_test_results (name, value) values ('other_issue', public.paint_guide_homeowner_access_issue('71000000-0000-4000-8000-000000000104'::uuid, '71000000-0000-4000-8000-000000000002'::uuid, 1::smallint, 1::smallint, decode(repeat('44', 32), 'hex'), 1::smallint, decode(repeat('cc', 47), 'hex'), decode(repeat('a4', 12), 'hex'), decode(repeat('ff', 16), 'hex')));

select extensions.ok(public.paint_guide_homeowner_session_exchange(1::smallint, decode(repeat('00', 32), 'hex'), 1::smallint, decode(repeat('01', 32), 'hex'), clock_timestamp() + interval '10 minutes') is null, 'Unknown token denied generically');

select extensions.ok(public.paint_guide_homeowner_session_exchange(1::smallint, decode(repeat('22', 32), 'hex'), 1::smallint, decode(repeat('02', 32), 'hex'), clock_timestamp() + interval '10 minutes') is null, 'Draft token denied generically');

select extensions.ok(public.paint_guide_homeowner_session_exchange(1::smallint, decode(repeat('33', 32), 'hex'), 1::smallint, decode(repeat('03', 32), 'hex'), clock_timestamp() + interval '10 minutes') is null, 'Archived token denied generically');

insert into pg_temp.homeowner_test_results (name, value) values ('exchange', public.paint_guide_homeowner_session_exchange(1::smallint, decode(repeat('11', 32), 'hex'), 1::smallint, decode(repeat('11', 32), 'hex'), clock_timestamp() + interval '10 minutes'));

select extensions.ok((select value from pg_temp.homeowner_test_results where name = 'exchange') is not null, 'Published token exchanges successfully');

select extensions.throws_ok('select public.paint_guide_homeowner_session_exchange(1::smallint, decode(repeat(''11'', 32), ''hex''), 1::smallint, decode(repeat(''11'', 32), ''hex''), clock_timestamp() + interval ''10 minutes'')', '23505', null, 'Duplicate session HMAC rejected');

select extensions.throws_ok('select public.paint_guide_homeowner_session_exchange(1::smallint, decode(repeat(''11'', 32), ''hex''), 1::smallint, decode(repeat(''12'', 32), ''hex''), clock_timestamp() - interval ''1 minute'')', '22023', null, 'Past expiry rejected');

select extensions.throws_ok('select public.paint_guide_homeowner_session_exchange(1::smallint, decode(repeat(''11'', 32), ''hex''), 1::smallint, decode(repeat(''12'', 32), ''hex''), clock_timestamp() + interval ''31 minutes'')', '22023', null, 'Expiry over thirty minutes rejected');

select extensions.throws_ok('select public.paint_guide_homeowner_session_exchange(1::smallint, decode(repeat(''11'', 32), ''hex''), 1::smallint, decode(repeat(''12'', 32), ''hex''), ''infinity''::timestamptz)', '22023', null, 'Infinite expiry rejected');

select extensions.throws_ok('select public.paint_guide_homeowner_session_exchange(1::smallint, decode(repeat(''11'', 32), ''hex''), 1::smallint, decode(repeat(''12'', 31), ''hex''), clock_timestamp() + interval ''10 minutes'')', '22023', null, 'Malformed session HMAC rejected');

insert into pg_temp.homeowner_test_results (name, value) values ('document', public.paint_guide_homeowner_document_read(1::smallint, decode(repeat('11', 32), 'hex')));

select extensions.is((select value from pg_temp.homeowner_test_results where name = 'document')->'guide'->>'residence_name',
  'LOCAL TEST Published Guide', 'Session determines the correct guide');
select extensions.is((select value from pg_temp.homeowner_test_results where name = 'document')->>'schema_version', '1', 'Payload version one');
select extensions.is((
  select array_agg(k order by k) from jsonb_object_keys((select value from pg_temp.homeowner_test_results where name = 'document')) as k
), array['assignments','guide','locations','records','schema_version']::text[], 'Exact payload root');
select extensions.is((
  select array_agg(k order by k) from jsonb_object_keys((select value from pg_temp.homeowner_test_results where name = 'document')->'guide') as k
), array['primary_scope_note','residence_name']::text[], 'Exact guide projection');
select extensions.is((
  select array_agg(k order by k) from jsonb_object_keys((select value from pg_temp.homeowner_test_results where name = 'document')->'locations'->0) as k
), array['created_at','id','name','parent_id','sort_order']::text[], 'Exact location projection');
select extensions.is((
  select array_agg(k order by k) from jsonb_object_keys((select value from pg_temp.homeowner_test_results where name = 'document')->'records'->0) as k
), array['brand','color_code','color_name','created_at','id','notes','product','section','sheen','sort_order','surface']::text[],
  'Exact record projection');
select extensions.is((
  select array_agg(k order by k) from jsonb_object_keys((select value from pg_temp.homeowner_test_results where name = 'document')->'assignments'->0) as k
), array['location_id','paint_record_id']::text[], 'Exact assignment projection');
select extensions.is(jsonb_array_length((select value from pg_temp.homeowner_test_results where name = 'document')->'records'), 2,
  'Other guide records excluded');
select extensions.is(jsonb_array_length((select value from pg_temp.homeowner_test_results where name = 'document')->'assignments'), 1,
  'Only explicit assignment returned');
select extensions.throws_ok('select public.paint_guide_homeowner_document_read(1::smallint, decode(repeat(''11'', 32), ''hex''), ''71000000-0000-4000-8000-000000000102''::uuid)', '42883', null, 'Document RPC accepts no arbitrary guide UUID');

select extensions.ok(public.paint_guide_homeowner_document_read(1::smallint, decode(repeat('00', 32), 'hex')) is null, 'Unknown session denied generically');


-- Expired and explicitly revoked sessions cannot authorize even if their snapshots match.
insert into paint_guide_private.homeowner_sessions
  (guide_id, token_generation, session_epoch, session_key_version, session_hmac, created_at, expires_at)
values ('71000000-0000-4000-8000-000000000101'::uuid, 1, 1, 1, decode(repeat('ee', 32), 'hex'), clock_timestamp() - interval '1 hour',
  clock_timestamp() - interval '50 minutes');
select extensions.ok(public.paint_guide_homeowner_document_read(1::smallint, decode(repeat('ee', 32), 'hex')) is null, 'Expired session denied');

insert into paint_guide_private.homeowner_sessions
  (guide_id, token_generation, session_epoch, session_key_version, session_hmac, expires_at, revoked_at)
values ('71000000-0000-4000-8000-000000000101'::uuid, 1, 1, 1, decode(repeat('dd', 32), 'hex'), clock_timestamp() + interval '10 minutes', clock_timestamp());
select extensions.ok(public.paint_guide_homeowner_document_read(1::smallint, decode(repeat('dd', 32), 'hex')) is null, 'Revoked session denied');


-- Exercise the invariant through the EXISTING authenticated staff status path.
reset role;
set local "request.jwt.claims" = '{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
update public.paint_guides set status = 'draft' where id = '71000000-0000-4000-8000-000000000101'::uuid;
reset role;
set local role service_role;
select extensions.is((select session_epoch from paint_guide_private.homeowner_access_tokens
  where guide_id = '71000000-0000-4000-8000-000000000101'::uuid), 2::bigint, 'Unpublish increments epoch');
select extensions.is((select token_generation from paint_guide_private.homeowner_access_tokens
  where guide_id = '71000000-0000-4000-8000-000000000101'::uuid), 1::bigint, 'Unpublish preserves QR generation');
select extensions.ok(public.paint_guide_homeowner_document_read(1::smallint, decode(repeat('11', 32), 'hex')) is null, 'Unpublish denies existing session');

select extensions.ok(public.paint_guide_homeowner_session_exchange(1::smallint, decode(repeat('11', 32), 'hex'), 1::smallint, decode(repeat('21', 32), 'hex'), clock_timestamp() + interval '10 minutes') is null, 'Unpublished guide denies exchange');

reset role;
set local role authenticated;
update public.paint_guides set status = 'published' where id = '71000000-0000-4000-8000-000000000101'::uuid;
reset role;
set local role service_role;
select extensions.is((select token_generation from paint_guide_private.homeowner_access_tokens
  where guide_id = '71000000-0000-4000-8000-000000000101'::uuid), 1::bigint, 'Republish preserves QR generation');
select extensions.is((select token_hmac from paint_guide_private.homeowner_access_tokens
  where guide_id = '71000000-0000-4000-8000-000000000101'::uuid), decode(repeat('11', 32), 'hex'), 'Republish preserves exact token HMAC');
select extensions.ok(public.paint_guide_homeowner_document_read(1::smallint, decode(repeat('11', 32), 'hex')) is null, 'Republish does not resurrect stale epoch session');

insert into pg_temp.homeowner_test_results (name, value) values ('republished_exchange', public.paint_guide_homeowner_session_exchange(1::smallint, decode(repeat('11', 32), 'hex'), 1::smallint, decode(repeat('22', 32), 'hex'), clock_timestamp() + interval '10 minutes'));

select extensions.ok((select value from pg_temp.homeowner_test_results where name = 'republished_exchange') is not null, 'Same QR exchanges after republish');


insert into pg_temp.homeowner_test_results (name, value) values ('rotated', public.paint_guide_homeowner_access_rotate('71000000-0000-4000-8000-000000000101'::uuid, '71000000-0000-4000-8000-000000000001'::uuid, 1::bigint, 2::bigint, 1::smallint, 1::smallint, decode(repeat('55', 32), 'hex'), 1::smallint, decode(repeat('cc', 47), 'hex'), decode(repeat('b5', 12), 'hex'), decode(repeat('ff', 16), 'hex')));

select extensions.is((select value from pg_temp.homeowner_test_results where name = 'rotated')->>'outcome', 'rotated', 'Owner rotates');
select extensions.is((select value from pg_temp.homeowner_test_results where name = 'rotated')->'access'->>'token_generation', '2', 'Rotation increments generation');
select extensions.is((select value from pg_temp.homeowner_test_results where name = 'rotated')->'access'->>'session_epoch', '3', 'Rotation increments epoch');
select extensions.ok(public.paint_guide_homeowner_document_read(1::smallint, decode(repeat('22', 32), 'hex')) is null, 'Rotation invalidates stale generation session');

select extensions.ok(public.paint_guide_homeowner_session_exchange(1::smallint, decode(repeat('11', 32), 'hex'), 1::smallint, decode(repeat('31', 32), 'hex'), clock_timestamp() + interval '10 minutes') is null, 'Old long token unusable after rotation');

insert into pg_temp.homeowner_test_results (name, value) values ('rotated_exchange', public.paint_guide_homeowner_session_exchange(1::smallint, decode(repeat('55', 32), 'hex'), 1::smallint, decode(repeat('33', 32), 'hex'), clock_timestamp() + interval '10 minutes'));

select extensions.ok((select value from pg_temp.homeowner_test_results where name = 'rotated_exchange') is not null, 'New token exchanges');

insert into pg_temp.homeowner_test_results (name, value) values ('revoked', public.paint_guide_homeowner_access_revoke('71000000-0000-4000-8000-000000000101'::uuid, '71000000-0000-4000-8000-000000000001'::uuid, 2::bigint, 3::bigint));

select extensions.is((select value from pg_temp.homeowner_test_results where name = 'revoked')->>'outcome', 'revoked', 'Owner revokes');
select extensions.ok(public.paint_guide_homeowner_document_read(1::smallint, decode(repeat('33', 32), 'hex')) is null, 'Revoke invalidates old epoch session');

select extensions.ok(public.paint_guide_homeowner_session_exchange(1::smallint, decode(repeat('55', 32), 'hex'), 1::smallint, decode(repeat('41', 32), 'hex'), clock_timestamp() + interval '10 minutes') is null, 'Revoked token exchange denied');

insert into pg_temp.homeowner_test_results (name, value) values ('revoked_recover', public.paint_guide_homeowner_access_recover('71000000-0000-4000-8000-000000000101'::uuid, '71000000-0000-4000-8000-000000000002'::uuid));

select extensions.ok(not ((select value from pg_temp.homeowner_test_results where name = 'revoked_recover') ? 'access'), 'Supervisor receives no revoked material');

insert into pg_temp.homeowner_test_results (name, value) values ('revoked_owner_recover', public.paint_guide_homeowner_access_recover('71000000-0000-4000-8000-000000000101'::uuid, '71000000-0000-4000-8000-000000000001'::uuid));

select extensions.ok(not ((select value from pg_temp.homeowner_test_results where name = 'revoked_owner_recover') ? 'access'), 'Owner recovery also denies revoked material');

insert into pg_temp.homeowner_test_results (name, value) values ('revoked_issue', public.paint_guide_homeowner_access_issue('71000000-0000-4000-8000-000000000101'::uuid, '71000000-0000-4000-8000-000000000002'::uuid, 1::smallint, 1::smallint, decode(repeat('77', 32), 'hex'), 1::smallint, decode(repeat('cc', 47), 'hex'), decode(repeat('c7', 12), 'hex'), decode(repeat('ff', 16), 'hex')));

select extensions.is((select value from pg_temp.homeowner_test_results where name = 'revoked_issue')->>'outcome', 'revoked', 'Issue cannot reactivate revoked access');
insert into pg_temp.homeowner_test_results (name, value) values ('repeat_revoke', public.paint_guide_homeowner_access_revoke('71000000-0000-4000-8000-000000000101'::uuid, '71000000-0000-4000-8000-000000000001'::uuid, 2::bigint, 3::bigint));

select extensions.is((select value from pg_temp.homeowner_test_results where name = 'repeat_revoke')->>'outcome', 'already_revoked', 'Repeat revoke is idempotent');
select extensions.is((select session_epoch from paint_guide_private.homeowner_access_tokens
  where guide_id = '71000000-0000-4000-8000-000000000101'::uuid), 4::bigint, 'Repeat revoke does not increment epoch again');
select extensions.is((select token_ciphertext from paint_guide_private.homeowner_access_tokens
  where guide_id = '71000000-0000-4000-8000-000000000101'::uuid), decode(repeat('cc', 47), 'hex'), 'Revoke preserves ciphertext');
insert into pg_temp.homeowner_test_results (name, value) values ('owner_replace_revoked', public.paint_guide_homeowner_access_rotate('71000000-0000-4000-8000-000000000101'::uuid, '71000000-0000-4000-8000-000000000001'::uuid, 2::bigint, 4::bigint, 1::smallint, 1::smallint, decode(repeat('66', 32), 'hex'), 1::smallint, decode(repeat('cc', 47), 'hex'), decode(repeat('b6', 12), 'hex'), decode(repeat('ff', 16), 'hex')));

select extensions.ok((select value from pg_temp.homeowner_test_results where name = 'owner_replace_revoked')->'access' is not null, 'Explicit owner rotation replaces revoked access');

select extensions.throws_ok('select public.paint_guide_homeowner_access_rotate(''71000000-0000-4000-8000-000000000101''::uuid, ''71000000-0000-4000-8000-000000000001''::uuid, 2::bigint, 4::bigint, 1::smallint, 1::smallint, decode(repeat(''77'', 32), ''hex''), 1::smallint, decode(repeat(''cc'', 47), ''hex''), decode(repeat(''c7'', 12), ''hex''), decode(repeat(''ff'', 16), ''hex''))', '40001', null, 'Stale rotation CAS fails');

select extensions.throws_ok('select public.paint_guide_homeowner_access_revoke(''71000000-0000-4000-8000-000000000101''::uuid, ''71000000-0000-4000-8000-000000000001''::uuid, 2::bigint, 4::bigint)', '40001', null, 'Stale revoke cannot revoke newer generation');

select extensions.throws_ok('select public.paint_guide_homeowner_access_rotate(''71000000-0000-4000-8000-000000000101''::uuid, ''71000000-0000-4000-8000-000000000001''::uuid, 3::bigint, 4::bigint, 1::smallint, 1::smallint, decode(repeat(''77'', 32), ''hex''), 1::smallint, decode(repeat(''cc'', 47), ''hex''), decode(repeat(''c7'', 12), ''hex''), decode(repeat(''ff'', 16), ''hex''))', '40001', null, 'Stale epoch CAS fails');

select extensions.throws_ok('select public.paint_guide_homeowner_access_rotate(''71000000-0000-4000-8000-000000000101''::uuid, ''71000000-0000-4000-8000-000000000001''::uuid, 3::bigint, 5::bigint, 1::smallint, 1::smallint, decode(repeat(''66'', 32), ''hex''), 1::smallint, decode(repeat(''cc'', 47), ''hex''), decode(repeat(''b6'', 12), ''hex''), decode(repeat(''ff'', 16), ''hex''))', '22023', null, 'Rotation rejects reused current material');


-- Isolate the two stale-snapshot checks, not just a combined invalid state.
insert into paint_guide_private.homeowner_sessions
  (guide_id, token_generation, session_epoch, session_key_version, session_hmac, expires_at)
values
  ('71000000-0000-4000-8000-000000000101'::uuid, 2, 5, 1, decode(repeat('a8', 32), 'hex'), clock_timestamp() + interval '10 minutes'),
  ('71000000-0000-4000-8000-000000000101'::uuid, 3, 4, 1, decode(repeat('a9', 32), 'hex'), clock_timestamp() + interval '10 minutes');
select extensions.ok(public.paint_guide_homeowner_document_read(1::smallint, decode(repeat('a8', 32), 'hex')) is null, 'Stale generation alone denied');

select extensions.ok(public.paint_guide_homeowner_document_read(1::smallint, decode(repeat('a9', 32), 'hex')) is null, 'Stale epoch alone denied');


-- FK and actor deletion safety with synthetic local fixtures only.
insert into pg_temp.homeowner_test_results (name, value) values ('other_session', public.paint_guide_homeowner_session_exchange(1::smallint, decode(repeat('44', 32), 'hex'), 1::smallint, decode(repeat('44', 32), 'hex'), clock_timestamp() + interval '10 minutes'));

reset role;
delete from public.profiles where user_id = '71000000-0000-4000-8000-000000000002'::uuid;
select extensions.ok((select created_by is null from paint_guide_private.homeowner_access_tokens
  where guide_id = '71000000-0000-4000-8000-000000000104'::uuid), 'Deleted profile audit FK becomes null');
set local role service_role;
select extensions.throws_ok('select public.paint_guide_homeowner_access_recover(''71000000-0000-4000-8000-000000000104''::uuid, ''71000000-0000-4000-8000-000000000002''::uuid)', '42501', null, 'Deleted actor cannot recover');

reset role;
delete from public.paint_guides where id = '71000000-0000-4000-8000-000000000104'::uuid;
select extensions.is((select count(*)::integer from paint_guide_private.homeowner_access_tokens
  where guide_id = '71000000-0000-4000-8000-000000000104'::uuid), 0, 'Guide deletion cascades access row');
select extensions.is((select count(*)::integer from paint_guide_private.homeowner_sessions
  where guide_id = '71000000-0000-4000-8000-000000000104'::uuid), 0, 'Guide deletion cascades sessions');
set local role service_role;
select extensions.ok(public.paint_guide_homeowner_document_read(1::smallint, decode(repeat('44', 32), 'hex')) is null, 'Deleted guide session denied');

reset role;

select extensions.finish();
rollback;

-- CONCURRENCY SPEC: must be run separately on a DISPOSABLE LOCAL DB with
-- committed synthetic fixtures; this rollback suite is single-connection.
-- Never interpret the following schedules as executed tests.
--
-- 1. Initial issuance: A BEGIN -> issue(g, actor, material A), hold transaction;
--    B issue(same g, actor, material B) waits. A COMMIT; B returns existing A,
--    never B; exactly one access row. If A ROLLBACK, B may issue its own material.
-- 2. Rotation: A and B use the same expected generation+epoch. First wins;
--    second waits then gets 40001. No mixed HMAC/ciphertext/nonce/tag is persisted.
-- 3. Rotation vs revoke: serialize on the same lock. Revoke-first increments
--    epoch, making stale rotate CAS fail; rotate-first makes stale revoke
--    generation CAS fail. Do not blindly auto-retry 40001 with newer snapshots.
-- 4. Exchange vs rotation: exchange-first creates old snapshot, which is
--    invalid after rotation commits. Rotation-first means exchange re-reads
--    the old digest after its lock wait and returns NULL, creates no session.
-- 5. Exchange vs unpublish: exchange-first may return before status commits,
--    but the AFTER trigger waits then increments epoch before status COMMIT.
--    Unpublish-first makes waiting exchange re-read nonpublished and deny.
--    No session valid after the committed unpublish/republish sequence.
-- 6. Read vs unpublish/revoke/rotate: a document snapshot started before
--    invalidation may complete; a new READ COMMITTED request after COMMIT must
--    return NULL. No multi-call authorization/data fetch gap. Do not use replica
--    or long-running REPEATABLE READ snapshots as a security source of truth.
-- 7. Guide deletion vs issue/exchange: FK enforcement must roll back any
--    insert whose guide/access row was deleted; no orphan sessions/access rows.
-- 8. Profile removal/deactivation concurrent with staff operation: actor is
--    revalidated after lock wait. If demotion commits before that check, deny.
--    Operations already authorized may linearize before a concurrent demotion;
--    insert/update actor FKs cannot persist references to deleted profiles.
-- 9. Collision schedules: different guides with the same (key version,HMAC)
--    or (encryption key version,nonce) yield one success and 23505 for the other.
--    Two exchanges with the same session HMAC yield one session and 23505.
--    The server must suppress SQL DETAIL and map credential denial generically.
--
-- FUTURE SERVER CRYPTO TESTS (outside this SQL phase):
-- HMAC domain separation/key versioning; fresh 256-bit random tokens/sessions;
-- AES-GCM fresh nonce across ALL historical encryptions (the current-row
-- unique constraint is not a historical nonce ledger); correct AAD using
-- project/environment, guide_id, next token_generation, format/encryption
-- versions; no credential/key/body logging; AES-GCM authentication before use.
