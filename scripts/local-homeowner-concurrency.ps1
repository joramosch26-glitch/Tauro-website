param(
  [ValidateSet(
    'setup', 'issue-issue', 'rotate-rotate', 'rotate-revoke',
    'revoke-rotate', 'exchange-rotate', 'exchange-revoke',
    'exchange-draft', 'document-invalidation', 'final', 'cleanup'
  )]
  [string]$Scenario = 'setup'
)

$ErrorActionPreference = 'Stop'
$DbContainer = 'supabase_db_tauro-paint-guide'

function Assert-TauroContainer {
  $names = @(docker ps --filter "name=$DbContainer" --format '{{.Names}}')
  if ($names.Count -ne 1 -or $names[0] -ne $DbContainer) {
    throw "Required running container '$DbContainer' was not found."
  }
}

function Invoke-TauroSql {
  param([Parameter(Mandatory)][string]$Sql)
  Assert-TauroContainer
  $output = $Sql | & docker exec -i $DbContainer psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres
  if ($LASTEXITCODE -ne 0) { throw "psql exited with code $LASTEXITCODE." }
  $output
}

function Start-TauroSqlJob {
  param(
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][string]$Sql
  )
  Start-Job -Name $Name -ArgumentList $DbContainer, $Sql -ScriptBlock {
    param($Container, $Query)
    $names = @(docker ps --filter "name=$Container" --format '{{.Names}}')
    if ($names.Count -ne 1 -or $names[0] -ne $Container) { throw "Required container was not found." }
    $Query | & docker exec -i $Container psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d postgres
    if ($LASTEXITCODE -ne 0) { throw "psql exited with code $LASTEXITCODE." }
  }
}

function Complete-TauroSqlJob {
  param([Parameter(Mandatory)]$Job)
  Wait-Job $Job | Out-Null
  $output = Receive-Job $Job
  Write-Host "[$($Job.Name)] $($Job.State)"
  $output
  if ($Job.State -ne 'Completed') {
    $reason = $Job.ChildJobs[0].JobStateInfo.Reason
    Remove-Job $Job -Force
    throw "Job '$($Job.Name)' failed: $reason"
  }
  Remove-Job $Job -Force
}

function Wait-TauroAdvisoryLock {
  param([Parameter(Mandatory)][string]$ApplicationName)
  foreach ($attempt in 1..100) {
    $held = Invoke-TauroSql @"
select exists (
  select 1 from pg_stat_activity a join pg_locks l using (pid)
  where a.application_name = '$ApplicationName'
    and l.locktype = 'advisory' and l.granted
);
"@
    if ($held.Trim() -eq 't') { return }
    Start-Sleep -Milliseconds 100
  }
  throw "Timed out waiting for advisory lock '$ApplicationName'."
}

function Wait-TauroSession {
  param([Parameter(Mandatory)][string]$ApplicationName)
  foreach ($attempt in 1..100) {
    $present = Invoke-TauroSql @"
select exists (select 1 from pg_stat_activity where application_name = '$ApplicationName');
"@
    if ($present.Trim() -eq 't') { return }
    Start-Sleep -Milliseconds 100
  }
  throw "Timed out waiting for session '$ApplicationName'."
}

$FixtureSql = @'
begin;
delete from public.paint_guides where id in (
  '72000000-0000-0000-0000-000000000101','72000000-0000-0000-0000-000000000102',
  '72000000-0000-0000-0000-000000000103','72000000-0000-0000-0000-000000000104',
  '72000000-0000-0000-0000-000000000105','72000000-0000-0000-0000-000000000106',
  '72000000-0000-0000-0000-000000000107'
);
delete from auth.users where id in ('72000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000002');
insert into auth.users (id,aud,role,email) values
 ('72000000-0000-0000-0000-000000000001','authenticated','authenticated','tauro-cx-owner@example.test'),
 ('72000000-0000-0000-0000-000000000002','authenticated','authenticated','tauro-cx-supervisor@example.test');
insert into public.profiles (user_id,role,active) values
 ('72000000-0000-0000-0000-000000000001','owner',true),
 ('72000000-0000-0000-0000-000000000002','supervisor',true);
insert into public.paint_guides (id,residence_name,status) values
 ('72000000-0000-0000-0000-000000000101','Concurrency Issue','published'),
 ('72000000-0000-0000-0000-000000000102','Concurrency Rotate','published'),
 ('72000000-0000-0000-0000-000000000103','Concurrency Revoke','published'),
 ('72000000-0000-0000-0000-000000000104','Concurrency Exchange Rotate','published'),
 ('72000000-0000-0000-0000-000000000105','Concurrency Exchange Revoke','published'),
 ('72000000-0000-0000-0000-000000000106','Concurrency Exchange Draft','published'),
 ('72000000-0000-0000-0000-000000000107','Concurrency Document','published');
set local role service_role;
select (public.paint_guide_homeowner_access_issue('72000000-0000-0000-0000-000000000102'::uuid,'72000000-0000-0000-0000-000000000001'::uuid,1::smallint,1::smallint,decode(repeat('21',32),'hex'),1::smallint,decode(repeat('cc',47),'hex'),decode(repeat('b1',12),'hex'),decode(repeat('ff',16),'hex'))->>'outcome');
select (public.paint_guide_homeowner_access_issue('72000000-0000-0000-0000-000000000103'::uuid,'72000000-0000-0000-0000-000000000001'::uuid,1::smallint,1::smallint,decode(repeat('31',32),'hex'),1::smallint,decode(repeat('cc',47),'hex'),decode(repeat('c1',12),'hex'),decode(repeat('ff',16),'hex'))->>'outcome');
select (public.paint_guide_homeowner_access_issue('72000000-0000-0000-0000-000000000104'::uuid,'72000000-0000-0000-0000-000000000001'::uuid,1::smallint,1::smallint,decode(repeat('41',32),'hex'),1::smallint,decode(repeat('cc',47),'hex'),decode(repeat('d1',12),'hex'),decode(repeat('ff',16),'hex'))->>'outcome');
select (public.paint_guide_homeowner_access_issue('72000000-0000-0000-0000-000000000105'::uuid,'72000000-0000-0000-0000-000000000001'::uuid,1::smallint,1::smallint,decode(repeat('51',32),'hex'),1::smallint,decode(repeat('cc',47),'hex'),decode(repeat('e1',12),'hex'),decode(repeat('ff',16),'hex'))->>'outcome');
select (public.paint_guide_homeowner_access_issue('72000000-0000-0000-0000-000000000106'::uuid,'72000000-0000-0000-0000-000000000001'::uuid,1::smallint,1::smallint,decode(repeat('61',32),'hex'),1::smallint,decode(repeat('cc',47),'hex'),decode(repeat('f1',12),'hex'),decode(repeat('ff',16),'hex'))->>'outcome');
select (public.paint_guide_homeowner_access_issue('72000000-0000-0000-0000-000000000107'::uuid,'72000000-0000-0000-0000-000000000001'::uuid,1::smallint,1::smallint,decode(repeat('71',32),'hex'),1::smallint,decode(repeat('cc',47),'hex'),decode(repeat('a7',12),'hex'),decode(repeat('ff',16),'hex'))->>'outcome');
reset role;
commit;
'@

function Reset-TauroConcurrencyFixtures { Invoke-TauroSql $FixtureSql }

function Run-TauroPair {
  param([string]$Name,[string]$SqlA,[string]$SqlB,[string]$WaitName,[switch]$WaitForSession)
  Reset-TauroConcurrencyFixtures
  $a = Start-TauroSqlJob "$Name-A" $SqlA
  if ($WaitForSession) { Wait-TauroSession $WaitName } else { Wait-TauroAdvisoryLock $WaitName }
  $b = Start-TauroSqlJob "$Name-B" $SqlB
  Complete-TauroSqlJob $a
  Complete-TauroSqlJob $b
}

$IssueA = @'
begin; set local role service_role;
select (public.paint_guide_homeowner_access_issue('72000000-0000-0000-0000-000000000101'::uuid,'72000000-0000-0000-0000-000000000002'::uuid,1::smallint,1::smallint,decode(repeat('11',32),'hex'),1::smallint,decode(repeat('cc',47),'hex'),decode(repeat('a1',12),'hex'),decode(repeat('ff',16),'hex'))->>'outcome');
reset role; set application_name='tauro-cx-issue-a-held'; select pg_sleep(15); commit;
'@
$IssueB = @'
begin; set local role service_role;
select (public.paint_guide_homeowner_access_issue('72000000-0000-0000-0000-000000000101'::uuid,'72000000-0000-0000-0000-000000000001'::uuid,1::smallint,1::smallint,decode(repeat('12',32),'hex'),1::smallint,decode(repeat('cc',47),'hex'),decode(repeat('a2',12),'hex'),decode(repeat('ff',16),'hex'))->>'outcome');
commit;
'@

$RotateARotateB = @'
begin; set local role service_role;
select (public.paint_guide_homeowner_access_rotate('72000000-0000-0000-0000-000000000102'::uuid,'72000000-0000-0000-0000-000000000001'::uuid,1::bigint,1::bigint,1::smallint,1::smallint,decode(repeat('22',32),'hex'),1::smallint,decode(repeat('cc',47),'hex'),decode(repeat('b2',12),'hex'),decode(repeat('ff',16),'hex'))->>'outcome');
reset role; set application_name='tauro-cx-rotate-a-held'; select pg_sleep(15); commit;
'@
$RotateBStale = @'
begin; set local role service_role;
do $cx$ begin
  perform public.paint_guide_homeowner_access_rotate('72000000-0000-0000-0000-000000000102'::uuid,'72000000-0000-0000-0000-000000000001'::uuid,1::bigint,1::bigint,1::smallint,1::smallint,decode(repeat('23',32),'hex'),1::smallint,decode(repeat('cc',47),'hex'),decode(repeat('b3',12),'hex'),decode(repeat('ff',16),'hex'));
  raise exception using errcode='P0001',message='UNEXPECTED_ROTATE_SUCCESS';
exception when sqlstate '40001' then null; end $cx$;
reset role; select 'EXPECTED_40001'; commit;
'@

$RotateRevokeA = @'
begin; set local role service_role;
select (public.paint_guide_homeowner_access_rotate('72000000-0000-0000-0000-000000000103'::uuid,'72000000-0000-0000-0000-000000000001'::uuid,1::bigint,1::bigint,1::smallint,1::smallint,decode(repeat('32',32),'hex'),1::smallint,decode(repeat('cc',47),'hex'),decode(repeat('c2',12),'hex'),decode(repeat('ff',16),'hex'))->>'outcome');
reset role; set application_name='tauro-cx-rotate-revoke-a-held'; select pg_sleep(15); commit;
'@
$RevokeBStale = @'
begin; set local role service_role;
do $cx$ begin
  perform public.paint_guide_homeowner_access_revoke('72000000-0000-0000-0000-000000000103'::uuid,'72000000-0000-0000-0000-000000000001'::uuid,1::bigint,1::bigint);
  raise exception using errcode='P0001',message='UNEXPECTED_REVOKE_SUCCESS';
exception when sqlstate '40001' then null; end $cx$;
reset role; select 'EXPECTED_40001'; commit;
'@

$RevokeRotateA = @'
begin; set local role service_role;
select (public.paint_guide_homeowner_access_revoke('72000000-0000-0000-0000-000000000103'::uuid,'72000000-0000-0000-0000-000000000001'::uuid,1::bigint,1::bigint)->>'outcome');
reset role; set application_name='tauro-cx-revoke-rotate-a-held'; select pg_sleep(15); commit;
'@
$RevokeRotateB = @'
begin; set local role service_role;
do $cx$ begin
  perform public.paint_guide_homeowner_access_rotate('72000000-0000-0000-0000-000000000103'::uuid,'72000000-0000-0000-0000-000000000001'::uuid,1::bigint,1::bigint,1::smallint,1::smallint,decode(repeat('33',32),'hex'),1::smallint,decode(repeat('cc',47),'hex'),decode(repeat('c3',12),'hex'),decode(repeat('ff',16),'hex'));
  raise exception using errcode='P0001',message='UNEXPECTED_ROTATE_SUCCESS';
exception when sqlstate '40001' then null; end $cx$;
reset role; select 'EXPECTED_40001'; commit;
'@

$ExchangeRotateA = @'
begin; set local role service_role;
with r as (select public.paint_guide_homeowner_session_exchange(1::smallint,decode(repeat('41',32),'hex'),1::smallint,decode(repeat('42',32),'hex'),(clock_timestamp()+interval '10 minutes')::timestamptz) response)
select case when response is null then 'DENIED' else 'EXCHANGED' end from r;
reset role; set application_name='tauro-cx-exchange-rotate-a-held'; select pg_sleep(15); commit;
'@
$ExchangeRotateB = @'
begin; set local role service_role;
select (public.paint_guide_homeowner_access_rotate('72000000-0000-0000-0000-000000000104'::uuid,'72000000-0000-0000-0000-000000000001'::uuid,1::bigint,1::bigint,1::smallint,1::smallint,decode(repeat('43',32),'hex'),1::smallint,decode(repeat('cc',47),'hex'),decode(repeat('d2',12),'hex'),decode(repeat('ff',16),'hex'))->>'outcome');
commit;
'@

$ExchangeRevokeA = @'
begin; set local role service_role;
with r as (select public.paint_guide_homeowner_session_exchange(1::smallint,decode(repeat('51',32),'hex'),1::smallint,decode(repeat('52',32),'hex'),(clock_timestamp()+interval '10 minutes')::timestamptz) response)
select case when response is null then 'DENIED' else 'EXCHANGED' end from r;
reset role; set application_name='tauro-cx-exchange-revoke-a-held'; select pg_sleep(15); commit;
'@
$ExchangeRevokeB = @'
begin; set local role service_role;
select (public.paint_guide_homeowner_access_revoke('72000000-0000-0000-0000-000000000105'::uuid,'72000000-0000-0000-0000-000000000001'::uuid,1::bigint,1::bigint)->>'outcome');
commit;
'@

$ExchangeDraftA = @'
begin; set local role service_role;
with r as (select public.paint_guide_homeowner_session_exchange(1::smallint,decode(repeat('61',32),'hex'),1::smallint,decode(repeat('62',32),'hex'),(clock_timestamp()+interval '10 minutes')::timestamptz) response)
select case when response is null then 'DENIED' else 'EXCHANGED' end from r;
reset role; set application_name='tauro-cx-exchange-draft-a-held'; select pg_sleep(15); commit;
'@
$ExchangeDraftB = @'
begin;
set local "request.jwt.claims"='{"sub":"72000000-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;
update public.paint_guides set status='draft' where id='72000000-0000-0000-0000-000000000106';
reset role; select 'DRAFTED'; commit;
'@

$DocumentA = @'
begin isolation level repeatable read;
select 1 from public.paint_guides where id='72000000-0000-0000-0000-000000000107';
set application_name='tauro-cx-document-snapshot-held'; select pg_sleep(8);
select case when public.paint_guide_homeowner_document_read(1::smallint,decode(repeat('72',32),'hex')) is null then 'UNEXPECTED_DENIED' else 'AUTHORIZED_PRECOMMIT_SNAPSHOT' end;
commit;
'@
$DocumentB = @'
begin;
set local "request.jwt.claims"='{"sub":"72000000-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;
update public.paint_guides set status='draft' where id='72000000-0000-0000-0000-000000000107';
reset role; select 'DRAFTED'; commit;
'@

$FinalSql = @'
select g.id,g.status,count(t.guide_id) access_rows,max(t.token_generation) generation,max(t.session_epoch) epoch,bool_or(t.revoked_at is not null) revoked,count(s.id) session_rows
from public.paint_guides g
left join paint_guide_private.homeowner_access_tokens t on t.guide_id=g.id
left join paint_guide_private.homeowner_sessions s on s.guide_id=g.id
where g.id between '72000000-0000-0000-0000-000000000101' and '72000000-0000-0000-0000-000000000107'
group by g.id,g.status order by g.id;
'@

$CleanupSql = @'
begin;
delete from public.paint_guides where id between '72000000-0000-0000-0000-000000000101' and '72000000-0000-0000-0000-000000000107';
delete from auth.users where id in ('72000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000002');
commit;
'@

Assert-TauroContainer
switch ($Scenario) {
  'setup' { Write-Host "Tauro local container verified: $DbContainer" }
  'issue-issue' { Write-Host '=== issue vs issue ==='; Run-TauroPair 'issue' $IssueA $IssueB 'tauro-cx-issue-a-held'; Invoke-TauroSql "select count(*),bool_or(token_hmac=decode(repeat('11',32),'hex')),bool_or(token_hmac=decode(repeat('12',32),'hex')) from paint_guide_private.homeowner_access_tokens where guide_id='72000000-0000-0000-0000-000000000101';" }
  'rotate-rotate' { Write-Host '=== rotate vs rotate ==='; Run-TauroPair 'rotate' $RotateARotateB $RotateBStale 'tauro-cx-rotate-a-held'; Invoke-TauroSql "select token_generation,session_epoch,revoked_at is null,token_hmac=decode(repeat('22',32),'hex') from paint_guide_private.homeowner_access_tokens where guide_id='72000000-0000-0000-0000-000000000102';" }
  'rotate-revoke' { Write-Host '=== rotate vs revoke ==='; Run-TauroPair 'rotate-revoke' $RotateRevokeA $RevokeBStale 'tauro-cx-rotate-revoke-a-held'; Invoke-TauroSql "select token_generation,session_epoch,revoked_at is null from paint_guide_private.homeowner_access_tokens where guide_id='72000000-0000-0000-0000-000000000103';" }
  'revoke-rotate' { Write-Host '=== revoke vs rotate ==='; Run-TauroPair 'revoke-rotate' $RevokeRotateA $RevokeRotateB 'tauro-cx-revoke-rotate-a-held'; Invoke-TauroSql "select token_generation,session_epoch,revoked_at is not null from paint_guide_private.homeowner_access_tokens where guide_id='72000000-0000-0000-0000-000000000103';" }
  'exchange-rotate' { Write-Host '=== exchange vs rotate ==='; Run-TauroPair 'exchange-rotate' $ExchangeRotateA $ExchangeRotateB 'tauro-cx-exchange-rotate-a-held'; Invoke-TauroSql "select token_generation,session_epoch,case when public.paint_guide_homeowner_document_read(1::smallint,decode(repeat('42',32),'hex')) is null then 'DENIED' else 'UNEXPECTED_AUTHORIZED' end from paint_guide_private.homeowner_access_tokens where guide_id='72000000-0000-0000-0000-000000000104'::uuid;" }
  'exchange-revoke' { Write-Host '=== exchange vs revoke ==='; Run-TauroPair 'exchange-revoke' $ExchangeRevokeA $ExchangeRevokeB 'tauro-cx-exchange-revoke-a-held'; Invoke-TauroSql "select token_generation,session_epoch,revoked_at is not null,case when public.paint_guide_homeowner_document_read(1::smallint,decode(repeat('52',32),'hex')) is null then 'DENIED' else 'UNEXPECTED_AUTHORIZED' end from paint_guide_private.homeowner_access_tokens where guide_id='72000000-0000-0000-0000-000000000105'::uuid;" }
  'exchange-draft' { Write-Host '=== exchange vs published-to-draft ==='; Run-TauroPair 'exchange-draft' $ExchangeDraftA $ExchangeDraftB 'tauro-cx-exchange-draft-a-held'; Invoke-TauroSql "select g.status,t.token_generation,t.session_epoch,t.revoked_at is null,case when public.paint_guide_homeowner_document_read(1::smallint,decode(repeat('62',32),'hex')) is null then 'DENIED' else 'UNEXPECTED_AUTHORIZED' end from public.paint_guides g join paint_guide_private.homeowner_access_tokens t on t.guide_id=g.id where g.id='72000000-0000-0000-0000-000000000106'::uuid;" }
  'document-invalidation' { Write-Host '=== document read vs invalidation ==='; Reset-TauroConcurrencyFixtures; Invoke-TauroSql "set role service_role; with r as (select public.paint_guide_homeowner_session_exchange(1::smallint,decode(repeat('71',32),'hex'),1::smallint,decode(repeat('72',32),'hex'),(clock_timestamp()+interval '10 minutes')::timestamptz) response) select case when response is null then 'DENIED' else 'EXCHANGED' end from r; reset role;"; $a=Start-TauroSqlJob 'document-A' $DocumentA; Wait-TauroSession 'tauro-cx-document-snapshot-held'; $b=Start-TauroSqlJob 'document-B' $DocumentB; Complete-TauroSqlJob $b; Complete-TauroSqlJob $a; Invoke-TauroSql "select g.status,t.token_generation,t.session_epoch,case when public.paint_guide_homeowner_document_read(1::smallint,decode(repeat('72',32),'hex')) is null then 'DENIED_FRESH_READ_COMMITTED' else 'UNEXPECTED_AUTHORIZED' end from public.paint_guides g join paint_guide_private.homeowner_access_tokens t on t.guide_id=g.id where g.id='72000000-0000-0000-0000-000000000107'::uuid;" }
  'final' { Write-Host '=== final authoritative verification ==='; Invoke-TauroSql $FinalSql }
  'cleanup' { Write-Host '=== cleanup synthetic fixtures ==='; Invoke-TauroSql $CleanupSql }
}
