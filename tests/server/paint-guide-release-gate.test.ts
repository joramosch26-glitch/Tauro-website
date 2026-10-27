import assert from 'node:assert/strict';
import test from 'node:test';
import { loadHomeownerServerEnvironment, loadPaintGuideServerEnvironment } from '../../server/paint-guide-homeowner/env.js';
import { permitsSyntheticReleaseDocument, permitsSyntheticReleaseToken, readSyntheticReleasePhotos } from '../../server/paint-guide-homeowner/release-gate.js';
import { createStaffAccessHandler } from '../../server/paint-guide-staff/access.js';
import type { HomeownerGuideDocumentData } from '../../server/paint-guide-homeowner/document.js';
import { createHomeownerExchangeHandler } from '../../server/paint-guide-homeowner/exchange.js';
import { createHomeownerDocumentHandler } from '../../server/paint-guide-homeowner/document-handler.js';
import { createHomeownerAccessToken } from '../../server/paint-guide-homeowner/crypto.js';
import { createHomeownerSessionBearer } from '../../server/paint-guide-homeowner/sessions.js';

const GUIDE='73000000-0000-4000-8000-000000000101';
const ACTOR='73000000-0000-4000-8000-000000000001';
const OTHER='73000000-0000-4000-8000-000000000102';
const source={TAURO_PG_ENVIRONMENT:'production',TAURO_PG_EXPECTED_PROJECT_REF:'abcdefghijklmnopqrst',
  TAURO_PG_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',TAURO_PG_SUPABASE_SECRET_KEY:'synthetic-only',
  TAURO_PG_HOMEOWNER_ACCESS_ENABLED:'true',TAURO_PG_ALLOWED_ORIGINS:'https://www.tauropainting.com',
  TAURO_PG_CUSTOMER_ACCESS_ENABLED:'false',TAURO_PG_SYNTHETIC_RELEASE_GUIDE_ID:GUIDE,TAURO_PG_SYNTHETIC_RELEASE_ACTOR_ID:ACTOR,
  TAURO_PG_TOKEN_LOOKUP_HMAC_ACTIVE_VERSION:'1',TAURO_PG_TOKEN_LOOKUP_HMAC_KEY_V1:Buffer.alloc(32,1).toString('base64url'),
  TAURO_PG_TOKEN_ENCRYPTION_ACTIVE_VERSION:'1',TAURO_PG_TOKEN_ENCRYPTION_KEY_V1:Buffer.alloc(32,2).toString('base64url'),
  TAURO_PG_SESSION_HMAC_ACTIVE_VERSION:'1',TAURO_PG_SESSION_HMAC_KEY_V1:Buffer.alloc(32,3).toString('base64url')};
const environment=loadHomeownerServerEnvironment(source);
test('canonical release is synthetic-only; missing/malformed activation and pins fail closed; Preview remains closed',()=>{
  assert.deepEqual(environment.syntheticRelease,{guideId:GUIDE,actorId:ACTOR});
  for(const overrides of [{TAURO_PG_CUSTOMER_ACCESS_ENABLED:undefined},{TAURO_PG_CUSTOMER_ACCESS_ENABLED:'False'},
    {TAURO_PG_SYNTHETIC_RELEASE_GUIDE_ID:undefined},{TAURO_PG_SYNTHETIC_RELEASE_ACTOR_ID:'*'},
    {TAURO_PG_SYNTHETIC_RELEASE_GUIDE_ID:GUIDE+' '},{TAURO_PG_SYNTHETIC_RELEASE_ACTOR_ID:GUIDE},
    {TAURO_PG_CUSTOMER_ACCESS_ENABLED:'true'},{TAURO_PG_ENVIRONMENT:'preview'}])
    assert.throws(()=>loadPaintGuideServerEnvironment({...source,...overrides}));
  assert.equal(loadPaintGuideServerEnvironment({...source,TAURO_PG_CUSTOMER_ACCESS_ENABLED:'true',
    TAURO_PG_SYNTHETIC_RELEASE_GUIDE_ID:undefined,TAURO_PG_SYNTHETIC_RELEASE_ACTOR_ID:undefined}).syntheticRelease,undefined);
});
test('every staff access operation denies other guides or actors before RPC or crypto',async()=>{
  for(const operation of ['status','issue','recover','rotate','revoke'] as const) for(const [guideId,actorId] of [[OTHER,ACTOR],[GUIDE,OTHER]]){
    let calls=0;
    const handler=createStaffAccessHandler(operation,{loadEnvironment:()=>environment,loadCryptoEnvironment:()=>{throw Error('CRYPTO_MUST_NOT_RUN');},
      authorize:async()=>({kind:'authorized',staff:{userId:actorId,role:'owner'}} as never),createClient:()=>{calls++;throw Error('RPC_MUST_NOT_RUN');}});
    const response=await handler(new Request('https://www.tauropainting.com/api/paint-guide/staff/access/'+operation,{method:'POST',headers:{Origin:'https://www.tauropainting.com','Content-Type':'application/json'},body:JSON.stringify({guideId,...(['rotate','revoke'].includes(operation)?{expectedTokenGeneration:1,expectedSessionEpoch:1}:{})})}));
    assert.equal(response.status,403);assert.equal(calls,0);assert.deepEqual(await response.json(),{available:false});
  }
});
test('release exchange checks exact allowlisted guide and actor, HMAC and key version through existing recovery RPC',async()=>{
  const hmac=Buffer.alloc(32,9);
  const fetcher:typeof fetch=async(input,init)=>{
    assert.match(String(input),/\/rpc\/paint_guide_homeowner_access_recover$/);
    assert.deepEqual(JSON.parse(String(init?.body)),{p_guide_id:GUIDE,p_actor_id:ACTOR});
    const hex=(n:number,v:number)=>'\\x'+Buffer.alloc(n,v).toString('hex');
    return Response.json({outcome:'recovered',access:{guide_id:GUIDE,format_version:1,token_generation:1,session_epoch:1,
      lookup_key_version:1,token_hmac:hex(32,9),encryption_key_version:1,token_ciphertext:hex(32,4),encryption_nonce:hex(12,5),encryption_tag:hex(16,6)}});
  };
  assert.equal(await permitsSyntheticReleaseToken(environment,{lookupKeyVersion:1,tokenHmac:hmac},fetcher),true);
  assert.equal(await permitsSyntheticReleaseToken(environment,{lookupKeyVersion:2,tokenHmac:hmac},fetcher),false);
  assert.equal(await permitsSyntheticReleaseToken(environment,{lookupKeyVersion:1,tokenHmac:Buffer.alloc(32,8)},fetcher),false);
  assert.equal(await permitsSyntheticReleaseToken(environment,{lookupKeyVersion:1,tokenHmac:hmac},async()=>Response.json(null)),false);
});
test('release document rejects foreign/empty data and verifies record and location provenance',async()=>{
  const doc:HomeownerGuideDocumentData={guide:{residence_name:'SYNTHETIC',primary_scope_note:null},
    records:[{id:GUIDE,section:'primary',surface:'Walls',brand:null,product:null,color_name:'Synthetic',color_code:null,sheen:null,notes:null,sort_order:0,created_at:'2026-10-17T00:00:00Z'}],
    locations:[{id:ACTOR,parent_id:null,name:'Synthetic Room',sort_order:0,created_at:'2026-10-17T00:00:00Z'}],assignments:[]};
  const fetcher:typeof fetch=async(input)=>{
    const url=new URL(String(input));assert.equal(url.searchParams.get(url.pathname.endsWith('paint_guides')?'id':'guide_id'),'eq.'+GUIDE);
    return Response.json(url.pathname.endsWith('paint_guides')?{residence_name:'SYNTHETIC',primary_scope_note:null,status:'published'}:[{id:url.pathname.endsWith('paint_records')?GUIDE:ACTOR}]);
  };
  assert.equal(await permitsSyntheticReleaseDocument(environment,doc,fetcher),true);
  assert.equal(await permitsSyntheticReleaseDocument(environment,{...doc,records:[{...doc.records[0],id:OTHER}]},fetcher),false);
  assert.equal(await permitsSyntheticReleaseDocument(environment,{...doc,locations:[{...doc.locations[0],id:OTHER}]},fetcher),false);
  assert.equal(await permitsSyntheticReleaseDocument(environment,{...doc,records:[],locations:[]},fetcher),false);
  assert.equal(await permitsSyntheticReleaseDocument(environment,{...doc,guide:{...doc.guide,residence_name:'OTHER'}},fetcher),false);
});
test('synthetic Preview document photo metadata is pinned to the configured guide and current ready slot only',async()=>{
  const version='73000000-0000-4000-8000-000000000202';
  const slot='73000000-0000-4000-8000-000000000203';
  const record='73000000-0000-4000-8000-000000000204';
  const preview={...environment,environment:'preview' as const};
  let calls=0;
  const fetcher:typeof fetch=async(input)=>{
    calls++;
    const url=new URL(String(input));
    if(url.pathname.endsWith('/paint_guide_photo_slots')){
      assert.equal(url.searchParams.get('guide_id'),'eq.'+GUIDE);
      assert.equal(url.searchParams.get('select'),'id,placement_kind,location_id,paint_record_id,current_version_id');
      return Response.json([{id:slot,placement_kind:'record_formula_label',location_id:null,paint_record_id:record,current_version_id:version}]);
    }
    assert.ok(url.pathname.endsWith('/paint_guide_photo_versions'));
    assert.ok(url.searchParams.get('id')?.includes(version));
    assert.equal(url.searchParams.get('state'),'eq.ready');
    return Response.json([{id:version,slot_id:slot,state:'ready'}]);
  };
  assert.equal(await readSyntheticReleasePhotos(environment,fetcher),null);
  assert.equal(calls,0);
  assert.deepEqual(await readSyntheticReleasePhotos(preview,fetcher),[{slot_id:slot,version_id:version,
    placement_kind:'record_formula_label',location_id:null,paint_record_id:record}]);
  assert.equal(calls,2);
});
test('homeowner Preview document handler attaches photo metadata only after synthetic-document approval',async()=>{
  const session=createHomeownerSessionBearer(1);
  const preview={...environment,environment:'preview' as const};
  const handlerDocument:HomeownerGuideDocumentData={guide:{residence_name:'Synthetic',primary_scope_note:null},
    locations:[{id:ACTOR,parent_id:null,name:'Synthetic Room',sort_order:0,created_at:'2026-10-17T00:00:00Z'}],
    records:[{id:GUIDE,section:'primary',surface:'Wall',brand:'Synthetic',product:'Test',color_name:'Synthetic',color_code:null,sheen:null,notes:null,sort_order:0,created_at:'2026-10-17T00:00:00Z'}],
    assignments:[{paint_record_id:GUIDE,location_id:ACTOR}]};
  const photo={slot_id:'73000000-0000-4000-8000-000000000203',version_id:'73000000-0000-4000-8000-000000000202',
    placement_kind:'record_formula_label' as const,location_id:null,paint_record_id:'73000000-0000-4000-8000-000000000204'};
  let photoReads=0;
  const handler=createHomeownerDocumentHandler({loadEnvironment:()=>preview,
    readDocument:async()=>({kind:'document',document:handlerDocument}),
    permitsReleaseDocument:async()=>true,
    readSyntheticPhotos:async()=>{photoReads++;return [photo];}});
  const response=await handler(new Request('https://www.tauropainting.com/api/paint-guide/homeowner/document',
    {headers:{cookie:'tauro_paint_guide_session='+session.canonical}}));
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{...handlerDocument,photos:[photo]});
  assert.equal(photoReads,1);
});
test('production homeowner document handler does not query the synthetic Preview photo path',async()=>{
  const session=createHomeownerSessionBearer(1);
  const handlerDocument:HomeownerGuideDocumentData={guide:{residence_name:'Existing',primary_scope_note:null},records:[],locations:[],assignments:[]};
  let photoReads=0;
  const handler=createHomeownerDocumentHandler({loadEnvironment:()=>environment,
    readDocument:async()=>({kind:'document',document:handlerDocument}),
    permitsReleaseDocument:async()=>true,
    readSyntheticPhotos:async()=>{photoReads++;return [];}});
  const response=await handler(new Request('https://www.tauropainting.com/api/paint-guide/homeowner/document',
    {headers:{cookie:'tauro_paint_guide_session='+session.canonical}}));
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),handlerDocument);
  assert.equal(photoReads,0);
});
test('allowed synthetic actor and guide reach the existing RPC, not a parallel authorization path',async()=>{
  let calls=0;
  const handler=createStaffAccessHandler('status',{loadEnvironment:()=>environment,
    authorize:async()=>({kind:'authorized',staff:{userId:ACTOR,role:'owner'}} as never),
    createClient:()=>({rpc:async()=>{calls++;return {data:null,error:null};}})});
  const response=await handler(new Request('https://www.tauropainting.com/api/paint-guide/staff/access/status',{
    method:'POST',headers:{Origin:'https://www.tauropainting.com','Content-Type':'application/json'},body:JSON.stringify({guideId:GUIDE})}));
  assert.equal(calls,1);assert.equal(response.status,404);
});
test('exchange release rejection precedes session creation and clears any existing cookie',async()=>{
  let exchanges=0;const token=createHomeownerAccessToken(1);
  const handler=createHomeownerExchangeHandler({loadEnvironment:()=>environment,permitsReleaseToken:async()=>false,
    exchangeSession:async()=>{exchanges++;return {kind:'exchanged'};}});
  const response=await handler(new Request('https://www.tauropainting.com/api/paint-guide/homeowner/exchange',{
    method:'POST',headers:{Origin:'https://www.tauropainting.com','Content-Type':'application/json'},body:JSON.stringify({token:token.canonical})}));
  assert.equal(response.status,404);assert.equal(exchanges,0);assert.match(response.headers.get('set-cookie')??'',/Max-Age=0/);token.secret.fill(0);
});
test('document release rejection returns no document and clears the cookie',async()=>{
  const session=createHomeownerSessionBearer(1);
  const handler=createHomeownerDocumentHandler({loadEnvironment:()=>environment,
    readDocument:async()=>({kind:'document',document:{guide:{residence_name:'SYNTHETIC',primary_scope_note:null},records:[],locations:[],assignments:[]}}),
    permitsReleaseDocument:async()=>false});
  const response=await handler(new Request('https://www.tauropainting.com/api/paint-guide/homeowner/document',{
    headers:{cookie:'tauro_paint_guide_session='+session.canonical}}));
  assert.equal(response.status,404);assert.deepEqual(await response.json(),{available:false});assert.match(response.headers.get('set-cookie')??'',/Max-Age=0/);
});
