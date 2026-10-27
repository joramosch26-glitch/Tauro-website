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
const MODEL='2a35d308-45a7-4b08-8d8d-83ddb16f0e29';
const MODEL_RECORD='78879584-5b65-4919-a4d9-e75028f533a3';
const MODEL_LOCATION='24ddd133-005e-4a35-ae45-ac140b53da91';
const source={TAURO_PG_ENVIRONMENT:'production',TAURO_PG_EXPECTED_PROJECT_REF:'abcdefghijklmnopqrst',
  TAURO_PG_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',TAURO_PG_SUPABASE_SECRET_KEY:'synthetic-only',
  TAURO_PG_HOMEOWNER_ACCESS_ENABLED:'true',TAURO_PG_ALLOWED_ORIGINS:'https://www.tauropainting.com',
  TAURO_PG_CUSTOMER_ACCESS_ENABLED:'false',TAURO_PG_SYNTHETIC_RELEASE_GUIDE_ID:GUIDE,TAURO_PG_SYNTHETIC_RELEASE_ACTOR_ID:ACTOR,
  TAURO_PG_TOKEN_LOOKUP_HMAC_ACTIVE_VERSION:'1',TAURO_PG_TOKEN_LOOKUP_HMAC_KEY_V1:Buffer.alloc(32,1).toString('base64url'),
  TAURO_PG_TOKEN_ENCRYPTION_ACTIVE_VERSION:'1',TAURO_PG_TOKEN_ENCRYPTION_KEY_V1:Buffer.alloc(32,2).toString('base64url'),
  TAURO_PG_SESSION_HMAC_ACTIVE_VERSION:'1',TAURO_PG_SESSION_HMAC_KEY_V1:Buffer.alloc(32,3).toString('base64url')};
const environment=loadHomeownerServerEnvironment(source);
const previewEnvironment=loadHomeownerServerEnvironment({...source,
  VITE_SUPABASE_URL:'https://hgfgnfhfqqetxjhasbbe.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic_only',
  VITE_TAURO_PG_EXPECTED_PROJECT_REF:'hgfgnfhfqqetxjhasbbe',VITE_TAURO_PG_ENVIRONMENT:'preview',
  TAURO_PG_SUPABASE_URL:'https://hgfgnfhfqqetxjhasbbe.supabase.co',TAURO_PG_EXPECTED_PROJECT_REF:'hgfgnfhfqqetxjhasbbe',
  TAURO_PG_ENVIRONMENT:'preview',TAURO_PG_ALLOWED_ORIGINS:'https://tauro-paint-guide-v1-qa-git-pgv1-jose-ramos-projects-4c64cbba.vercel.app',
  TAURO_PG_CUSTOMER_ACCESS_ENABLED:'false',TAURO_PG_PREVIEW_SYNTHETIC_RELEASE_ENABLED:'true',
  TAURO_PG_SYNTHETIC_RELEASE_GUIDE_ID:'b28d3dd5-eb34-46a2-99de-7af143de80db',
  TAURO_PG_SYNTHETIC_RELEASE_ACTOR_ID:'e8fa431f-ea5c-46fb-b92c-6d5d213531bc',VERCEL:'1',VERCEL_ENV:'preview',
  VERCEL_TARGET_ENV:'preview',VERCEL_GIT_COMMIT_REF:'pgv1',
  VERCEL_BRANCH_URL:'tauro-paint-guide-v1-qa-git-pgv1-jose-ramos-projects-4c64cbba.vercel.app'});
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
test('Preview release recovers tokens only for the diagnostic and hard-pinned model guides',async()=>{
  const hmac=Buffer.alloc(32,9);const requested:string[]=[];
  const fetcher:typeof fetch=async(input,init)=>{
    const args=JSON.parse(String(init?.body)) as {p_guide_id:string};requested.push(args.p_guide_id);
    if(args.p_guide_id!==MODEL)return Response.json({outcome:'unavailable'});
    const hex=(n:number,v:number)=>'\\x'+Buffer.alloc(n,v).toString('hex');
    return Response.json({outcome:'recovered',access:{guide_id:MODEL,format_version:1,token_generation:1,session_epoch:1,
      lookup_key_version:1,token_hmac:hex(32,9),encryption_key_version:1,token_ciphertext:hex(32,4),encryption_nonce:hex(12,5),encryption_tag:hex(16,6)}});
  };
  assert.equal(await permitsSyntheticReleaseToken(previewEnvironment,{lookupKeyVersion:1,tokenHmac:hmac},fetcher),true);
  assert.deepEqual(requested,['b28d3dd5-eb34-46a2-99de-7af143de80db',MODEL]);
});
test('Preview homeowner document accepts model data only after the pinned model guide proves all IDs',async()=>{
  const doc:HomeownerGuideDocumentData={guide:{residence_name:'Ramos Residence - Model Home (Fictional Demo)',primary_scope_note:'DEMO - NOT A MIXING FORMULA'},
    records:[{id:MODEL_RECORD,section:'primary',surface:'Walls',brand:null,product:null,color_name:'White Dove',color_code:null,sheen:'Satin',notes:'DEMO - NOT A MIXING FORMULA',sort_order:0,created_at:'2026-10-27T00:00:00Z'}],
    locations:[{id:MODEL_LOCATION,parent_id:null,name:'Great Room',sort_order:0,created_at:'2026-10-27T00:00:00Z'}],assignments:[]};
  const seen=new Set<string>();
  const fetcher:typeof fetch=async(input)=>{
    const url=new URL(String(input));
    const guideId=(url.searchParams.get(url.pathname.endsWith('paint_guides')?'id':'guide_id')??'').slice(3);
    seen.add(guideId);
    if(url.pathname.endsWith('paint_guides')) return guideId===MODEL
      ?Response.json({residence_name:doc.guide.residence_name,primary_scope_note:doc.guide.primary_scope_note,status:'published'})
      :Response.json(null,{status:406});
    if(guideId!==MODEL)return Response.json([]);
    return url.pathname.endsWith('paint_records')?Response.json([{id:MODEL_RECORD}]):Response.json([{id:MODEL_LOCATION}]);
  };
  assert.equal(await permitsSyntheticReleaseDocument(previewEnvironment,doc,fetcher),true);
  assert.deepEqual([...seen].sort(),['2a35d308-45a7-4b08-8d8d-83ddb16f0e29','b28d3dd5-eb34-46a2-99de-7af143de80db'].sort());
  assert.equal(await permitsSyntheticReleaseDocument(previewEnvironment,{...doc,records:[{...doc.records[0],id:OTHER}]},fetcher),false);
});
test('Preview legacy photo fallback reads only the document-matched allowlisted model guide and strips object keys',async()=>{
  const slotId='73000000-0000-4000-8000-000000000203';const versionId='73000000-0000-4000-8000-000000000202';
  const doc:HomeownerGuideDocumentData={guide:{residence_name:'Ramos Residence - Model Home (Fictional Demo)',primary_scope_note:'DEMO - NOT A MIXING FORMULA'},
    records:[{id:MODEL_RECORD,section:'primary',surface:'Walls',brand:null,product:null,color_name:'White Dove',color_code:null,sheen:'Satin',notes:'DEMO - NOT A MIXING FORMULA',sort_order:0,created_at:'2026-10-27T00:00:00Z'}],
    locations:[{id:MODEL_LOCATION,parent_id:null,name:'Great Room',sort_order:0,created_at:'2026-10-27T00:00:00Z'}],assignments:[]};
  const slotReads:string[]=[];
  const fetcher:typeof fetch=async(input)=>{
    const url=new URL(String(input));const guideParam=url.searchParams.get(url.pathname.endsWith('paint_guides')?'id':'guide_id');
    const guideId=guideParam?.slice(3)??'';
    if(url.pathname.endsWith('paint_guides'))return guideId===MODEL
      ?Response.json({residence_name:doc.guide.residence_name,primary_scope_note:doc.guide.primary_scope_note,status:'published'})
      :Response.json({residence_name:'Diagnostic fixture',primary_scope_note:null,status:'published'});
    if(url.pathname.endsWith('paint_records'))return Response.json(guideId===MODEL?[{id:MODEL_RECORD}]:[]);
    if(url.pathname.endsWith('guide_locations'))return Response.json(guideId===MODEL?[{id:MODEL_LOCATION}]:[]);
    if(url.pathname.endsWith('paint_guide_photo_slots')){
      slotReads.push(guideId);return Response.json([{id:slotId,placement_kind:'record_formula_label',location_id:null,paint_record_id:MODEL_RECORD,current_version_id:versionId}]);
    }
    if(url.pathname.endsWith('paint_guide_photo_versions'))return Response.json([{id:versionId,slot_id:slotId,state:'ready'}]);
    throw new Error('unexpected synthetic query');
  };
  const photos=await readSyntheticReleasePhotos(previewEnvironment,doc,fetcher);
  assert.deepEqual(slotReads,[MODEL]);
  assert.deepEqual(photos,[{slot_id:slotId,version_id:versionId,placement_kind:'record_formula_label',location_id:null,paint_record_id:MODEL_RECORD}]);
  assert.equal(Object.hasOwn(photos?.[0]??{},'object_key'),false);
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
test('homeowner document handler forwards authenticated RPC photo metadata in production and Preview',async()=>{
  const session=createHomeownerSessionBearer(1);
  const handlerDocument:HomeownerGuideDocumentData={guide:{residence_name:'Synthetic',primary_scope_note:null},
    locations:[{id:ACTOR,parent_id:null,name:'Synthetic Room',sort_order:0,created_at:'2026-10-17T00:00:00Z'}],
    records:[{id:GUIDE,section:'primary',surface:'Wall',brand:'Synthetic',product:'Test',color_name:'Synthetic',color_code:null,sheen:null,notes:null,sort_order:0,created_at:'2026-10-17T00:00:00Z'}],
    assignments:[{paint_record_id:GUIDE,location_id:ACTOR}],photos:[{slot_id:'73000000-0000-4000-8000-000000000203',
      version_id:'73000000-0000-4000-8000-000000000202',placement_kind:'record_formula_label',location_id:null,paint_record_id:GUIDE}]};
  const photo={slot_id:'73000000-0000-4000-8000-000000000203',version_id:'73000000-0000-4000-8000-000000000202',
    placement_kind:'record_formula_label' as const,location_id:null,paint_record_id:GUIDE};
  const handler=createHomeownerDocumentHandler({loadEnvironment:()=>environment,
    readDocument:async()=>({kind:'document',document:handlerDocument}),
    permitsReleaseDocument:async()=>true});
  const response=await handler(new Request('https://www.tauropainting.com/api/paint-guide/homeowner/document',
    {headers:{cookie:'tauro_paint_guide_session='+session.canonical}}));
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),handlerDocument);
  assert.deepEqual((handlerDocument.photos ?? [])[0],photo);

  const previewHandler=createHomeownerDocumentHandler({loadEnvironment:()=>({...environment,environment:'preview'}),
    readDocument:async()=>({kind:'document',document:handlerDocument}),permitsReleaseDocument:async()=>true});
  const previewResponse=await previewHandler(new Request('https://www.tauropainting.com/api/paint-guide/homeowner/document',
    {headers:{cookie:'tauro_paint_guide_session='+session.canonical}}));
  assert.equal(previewResponse.status,200);
  assert.deepEqual(await previewResponse.json(),handlerDocument);
});
test('production homeowner document handler passes through the authorized server document unchanged',async()=>{
  const session=createHomeownerSessionBearer(1);
  const handlerDocument:HomeownerGuideDocumentData={guide:{residence_name:'Existing',primary_scope_note:null},records:[],locations:[],assignments:[]};
  const handler=createHomeownerDocumentHandler({loadEnvironment:()=>environment,
    readDocument:async()=>({kind:'document',document:handlerDocument}),
    permitsReleaseDocument:async()=>true});
  const response=await handler(new Request('https://www.tauropainting.com/api/paint-guide/homeowner/document',
    {headers:{cookie:'tauro_paint_guide_session='+session.canonical}}));
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),handlerDocument);
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

