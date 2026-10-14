// Rendered UI regressions with synthetic, in-memory SDK data only. No live Auth,
// SQL, production configuration or secrets. Auth is deliberately replaced in
// this fixture; authorization is covered separately by the server/SQL checks.
// Supply an existing Playwright module path if it is not installed locally.
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

let vite, browser, origin;
const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import App from '/src/paint-guide/PaintGuideApp.tsx';
import '/src/index.css';
const date='2026-10-14T00:00:00Z';
const guide=id=>({id,residence_name:'Synthetic '+id,status:'published',primary_scope_note:null,created_at:date,updated_at:date});
const loc=(g,id,name)=>({id,guide_id:g,parent_id:null,location_type:'floor',name,sort_order:0,created_at:date,updated_at:date});
const record=g=>({id:'record-'+g,guide_id:g,section:'primary',surface:'Walls '+g,color_name:'White '+g,sheen:'Satin',brand:null,product:null,color_code:null,notes:null,sort_order:0,created_at:date,updated_at:date});
const qa=globalThis.__qa={tables:{paint_guides:[guide('A'),guide('B')],guide_locations:[loc('A','l1','First Floor'),loc('A','l2','Second Floor'),loc('B','lb','Floor B')],paint_records:[record('A'),record('B')],paint_record_locations:[{guide_id:'A',paint_record_id:'record-A',location_id:'l1'}]},held:[],calls:[],holdWrites:false,failDelete:false,failAssignmentRead:false};
qa.role='owner';
qa.access={guideId:'A',guideStatus:'published',accessState:'active',tokenGeneration:1,sessionEpoch:1,homeownerExchangeAvailable:true};
const originalFetch=globalThis.fetch;
globalThis.fetch=async (url,options)=>{
 if(typeof url!=='string'||!url.startsWith('/api/paint-guide/staff/access/'))return originalFetch(url,options);
 const op=url.split('/').pop();
 if(op==='rotate'){qa.access.tokenGeneration++;qa.access.sessionEpoch++;qa.access.accessState='active';qa.access.homeownerExchangeAvailable=true;}
 if(op==='revoke'){qa.access.sessionEpoch++;qa.access.accessState='revoked';qa.access.homeownerExchangeAvailable=false;}
 const body={...qa.access};
 if(['issue','recover','rotate'].includes(op))body.privateUrl=location.origin+'/paint-guide/p#tpgh1.1.'+(qa.access.tokenGeneration===1?'A':'B').repeat(43);
 return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
};
qa.release=()=>{qa.holdWrites=false;qa.held.splice(0).forEach(fn=>fn());};
qa.from=table=>{
 let op='select',payload,one=false,filters=[];
 const q={select(){return q;},order(){return q;},eq(k,v){filters.push(row=>row[k]===v);return q;},in(k,v){filters.push(row=>v.includes(row[k]));return q;},maybeSingle(){one=true;return q;},single(){one=true;return q;},insert(p){op='insert';payload=p;return q;},update(p){op='update';payload=p;return q;},delete(){op='delete';return q;},then(resolve,reject){
  qa.calls.push({table,op});
  const execute=()=>{
   const match=row=>filters.every(f=>f(row));
   if(table==='paint_record_locations' && (op==='delete' && qa.failDelete || op==='select' && qa.failAssignmentRead))return {data:null,error:new Error('Synthetic failure')};
   let rows=qa.tables[table].filter(match);
   if(op==='insert'){rows=(Array.isArray(payload)?payload:[payload]).map(p=>({...p,...(table==='paint_record_locations'?{}:{id:'created-'+qa.calls.length,created_at:date,updated_at:date})}));qa.tables[table].push(...rows);}
   if(op==='update')rows.forEach(row=>Object.assign(row,payload));
   if(op==='delete')qa.tables[table]=qa.tables[table].filter(row=>!match(row));
   return {data:structuredClone(one?rows[0]??null:rows),error:null};
  };
  const p=qa.holdWrites&&op!=='select'?new Promise(r=>qa.held.push(()=>r(execute()))):Promise.resolve(execute());return p.then(resolve,reject);
 }};return q;
};
function Harness(){qa.navigate=useNavigate();return React.createElement(App);}
createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(Harness)));
`;
before(async () => {
  const module = process.env.TAURO_QA_PLAYWRIGHT_MODULE;
  const { chromium } = await import(module ? pathToFileURL(module).href : 'playwright');
  vite = await createServer({ configFile: false, envFile: false, appType: 'custom',
    server: { host: '127.0.0.1', port: 0 }, resolve: { alias: { '@': new URL('../src', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') } },
    plugins: [{ name: 'synthetic-browser-fixture', enforce: 'pre',
      resolveId(id) { if(id==='/__qa.tsx')return '\0qa.tsx'; },
      load(id) {
        if(id==='\0qa.tsx')return fixture;
        const path=id.replaceAll('\\','/');
        if(path.endsWith('/auth/AuthProvider.tsx'))return 'export function AuthProvider({children}){return children;}';
        if(path.endsWith('/auth/RequireStaffAuth.tsx'))return 'export function RequireStaffAuth({children}){return children;}';
        if(path.endsWith('/auth/useAuth.ts'))return "export function useAuth(){return {profile:{role:globalThis.__qa.role},session:{access_token:'synthetic_fixture_only'},signOut:async()=>{}};}";
        if(path.endsWith('/lib/supabase.ts'))return 'export const isSupabaseConfigured=true; export const supabase={from:(table)=>globalThis.__qa.from(table)};';
      },
    }, react()], optimizeDeps: { include: ['react','react-dom/client','react-router-dom','cookie','set-cookie-parser','qrcode'] } });
  vite.middlewares.use(async (req,res,next)=>{
    if(!req.url?.startsWith('/paint-guide'))return next();
    res.setHeader('Content-Type','text/html');
    res.end(await vite.transformIndexHtml(req.url,'<html><body><div id="root"></div><script type="module" src="/__qa.tsx"></script></body></html>'));
  });
  await vite.listen();
  origin=`http://127.0.0.1:${vite.httpServer.address().port}`;
  const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  browser=await chromium.launch({headless:true,...(existsSync(edge)?{executablePath:edge}:{})});
});
after(async()=>{await browser?.close();await vite?.close();});
async function pageAt(path, run) {
  const context=await browser.newContext();
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  try { await page.goto(origin+path); await page.waitForFunction(()=>!!globalThis.__qa?.navigate,{},{timeout:10000}).catch(()=>{throw new Error('Synthetic fixture startup: '+errors.join('; '));}); await run(page); }
  finally { await context.close(); }
}
const navigate=(p,path)=>p.evaluate(path=>globalThis.__qa.navigate(path),path);
const heading=(p,name)=>p.getByRole('heading',{name,exact:true}).waitFor();
const readyColor=p=>heading(p,'Walls A');

test('color draft and mutation state are discarded when switching guides',async()=>pageAt('/paint-guide/g/A/colors',async p=>{
  await readyColor(p);await p.getByRole('button',{name:'Edit',exact:true}).click();
  await p.getByLabel('Color Name', {exact:true}).fill('Unsaved A');
  await navigate(p,'/paint-guide/g/B/colors');await heading(p,'Walls B');
  assert.equal(await p.getByLabel('Color Name',{exact:true}).count(),0);
  await p.getByRole('button',{name:'Edit',exact:true}).click();
  assert.equal(await p.getByLabel('Color Name',{exact:true}).inputValue(),'White B');
}));
test('late color create cannot contaminate B or keep its create button pending',async()=>pageAt('/paint-guide/g/A/colors',async p=>{
  await readyColor(p);await p.getByRole('button',{name:'Add Paint Record',exact:true}).click();
  await p.getByLabel('Surface',{exact:true}).fill('Late A');await p.getByLabel('Color Name',{exact:true}).fill('Blue');
  await p.evaluate(()=>globalThis.__qa.holdWrites=true);
  await p.getByRole('button',{name:'Add Paint Record',exact:true}).last().click();
  await p.waitForFunction(()=>globalThis.__qa.held.length===1);
  await navigate(p,'/paint-guide/g/B/colors');await heading(p,'Walls B');
  await p.evaluate(()=>globalThis.__qa.release());
  await p.waitForFunction(()=>globalThis.__qa.tables.paint_records.some(r=>r.surface==='Late A'));
  assert.equal(await p.getByRole('heading',{name:'Late A',exact:true}).count(),0);
  assert.equal(await p.getByRole('button',{name:'Add Paint Record',exact:true}).isEnabled(),true);
}));
test('A -> B -> A does not allow an old save to close a new editor',async()=>pageAt('/paint-guide/g/A/colors',async p=>{
  await readyColor(p);await p.getByRole('button',{name:'Edit',exact:true}).click();
  await p.getByLabel('Color Name',{exact:true}).fill('Old save');await p.evaluate(()=>globalThis.__qa.holdWrites=true);
  await p.getByRole('button',{name:'Save',exact:true}).click();await p.waitForFunction(()=>globalThis.__qa.held.length===1);
  await navigate(p,'/paint-guide/g/B/colors');await heading(p,'Walls B');
  await navigate(p,'/paint-guide/g/A/colors');await readyColor(p);
  await p.getByRole('button',{name:'Edit',exact:true}).click();await p.getByLabel('Color Name',{exact:true}).fill('New draft');
  await p.evaluate(()=>globalThis.__qa.release());await p.waitForFunction(()=>globalThis.__qa.tables.paint_records[0].color_name==='Old save');
  assert.equal(await p.getByLabel('Color Name',{exact:true}).inputValue(),'New draft');
}));
test('location add form is not carried into another residence',async()=>pageAt('/paint-guide/g/A/locations',async p=>{
  await heading(p,'Residence hierarchy');await p.getByRole('button',{name:'Add Location',exact:true}).click();
  await p.getByLabel('Name',{exact:true}).fill('Draft floor A');
  await navigate(p,'/paint-guide/g/B/locations');await heading(p,'Synthetic B');
  assert.equal(await p.getByLabel('Name',{exact:true}).count(),0);
  assert.equal(await p.getByText('First Floor',{exact:true}).count(),0);
}));
test('late overview save cannot replace B identity or its form',async()=>pageAt('/paint-guide/g/A',async p=>{
  await heading(p,'Synthetic A');await p.getByLabel('Residence Name',{exact:true}).fill('Updated A');
  await p.evaluate(()=>globalThis.__qa.holdWrites=true);await p.getByRole('button',{name:'Save Changes',exact:true}).click();
  await p.waitForFunction(()=>globalThis.__qa.held.length===1);
  await navigate(p,'/paint-guide/g/B');await heading(p,'Synthetic B');await p.evaluate(()=>globalThis.__qa.release());
  await p.waitForFunction(()=>globalThis.__qa.tables.paint_guides[0].residence_name==='Updated A');
  assert.equal(await p.getByLabel('Residence Name',{exact:true}).inputValue(),'Synthetic B');
  assert.equal(await p.getByText('Changes saved.',{exact:true}).count(),0);
}));
test('cancelled new-guide screen cannot redirect after its create completes',async()=>pageAt('/paint-guide/new',async p=>{
  await p.getByLabel('Residence Name',{exact:true}).fill('Synthetic new');await p.evaluate(()=>globalThis.__qa.holdWrites=true);
  await p.getByRole('button',{name:'Create Guide',exact:true}).click();await p.waitForFunction(()=>globalThis.__qa.held.length===1);
  await p.getByRole('link',{name:'Cancel',exact:true}).click();await heading(p,'Paint Guides');
  await p.evaluate(()=>globalThis.__qa.release());await p.waitForFunction(()=>globalThis.__qa.tables.paint_guides.length===3);
  assert.equal(new URL(p.url()).pathname,'/paint-guide');
}));
test('partial assignment write refreshes actual selection and does not report success',async()=>pageAt('/paint-guide/g/A/colors',async p=>{
  await readyColor(p);await p.getByRole('button',{name:'Manage Locations',exact:true}).click();
  await p.getByLabel('First Floor',{exact:true}).uncheck();await p.getByLabel('Second Floor',{exact:true}).check();
  await p.evaluate(()=>globalThis.__qa.failDelete=true);await p.getByRole('button',{name:'Save Locations',exact:true}).click();
  await p.getByRole('alert').filter({hasText:'Could not save locations'}).waitFor();
  assert.equal(await p.getByLabel('First Floor',{exact:true}).isChecked(),true);
  assert.equal(await p.getByLabel('Second Floor',{exact:true}).isChecked(),true);
  await p.evaluate(()=>globalThis.__qa.failDelete=false);await p.getByLabel('First Floor',{exact:true}).uncheck();
  await p.getByRole('button',{name:'Save Locations',exact:true}).click();
  await p.getByRole('button',{name:'Manage Locations',exact:true}).waitFor();
  assert.deepEqual(await p.evaluate(()=>globalThis.__qa.tables.paint_record_locations.map(r=>r.location_id)),['l2']);
}));
test('failed partial-write refresh locks assignment editing until reload',async()=>pageAt('/paint-guide/g/A/colors',async p=>{
  await readyColor(p);await p.getByRole('button',{name:'Manage Locations',exact:true}).click();
  await p.getByLabel('First Floor',{exact:true}).uncheck();await p.getByLabel('Second Floor',{exact:true}).check();
  await p.evaluate(()=>{globalThis.__qa.failDelete=true;globalThis.__qa.failAssignmentRead=true;});
  await p.getByRole('button',{name:'Save Locations',exact:true}).click();
  await p.getByRole('alert').filter({hasText:'Reload this page'}).waitFor();
  assert.equal(await p.getByRole('button',{name:'Save Locations',exact:true}).isDisabled(),true);
  assert.equal(await p.getByLabel('First Floor',{exact:true}).isDisabled(),true);
}));

test('rendered house create, publish, location and color/finish edit workflow',async()=>pageAt('/paint-guide/new',async p=>{
  await p.getByLabel('Residence Name',{exact:true}).fill('Synthetic workflow');
  await p.getByRole('button',{name:'Create Guide',exact:true}).click();await heading(p,'Synthetic workflow');
  await p.getByLabel('Status',{exact:true}).selectOption('published');await p.getByRole('button',{name:'Save Changes',exact:true}).click();
  await p.getByText('Changes saved.',{exact:true}).waitFor();
  await p.getByRole('link',{name:'Locations',exact:true}).click();await heading(p,'Residence hierarchy');
  await p.getByRole('button',{name:'Add Location',exact:true}).click();await p.getByLabel('Name',{exact:true}).fill('New Floor');
  await p.getByRole('button',{name:'Add Location',exact:true}).last().click();await p.getByText('New Floor',{exact:true}).waitFor();
  await p.getByRole('link',{name:'Colors',exact:true}).click();await heading(p,'No paint records yet.');
  await p.getByRole('button',{name:'Add Paint Record',exact:true}).click();await p.getByLabel('Surface',{exact:true}).fill('New Walls');
  await p.getByLabel('Color Name',{exact:true}).fill('Ivory');await p.getByLabel('Sheen',{exact:true}).fill('Eggshell');
  await p.getByRole('button',{name:'Add Paint Record',exact:true}).last().click();await heading(p,'New Walls');
  await p.getByRole('button',{name:'Edit',exact:true}).click();await p.getByLabel('Color Name',{exact:true}).fill('Cream');
  await p.getByRole('button',{name:'Save',exact:true}).click();await p.getByText('Cream · Eggshell',{exact:true}).waitFor();
  const saved=await p.evaluate(()=>globalThis.__qa.tables.paint_records.find(r=>r.surface==='New Walls'));
  assert.equal(saved.color_name,'Cream');assert.equal(saved.sheen,'Eggshell');
}));
test('QR is memory-only; actual PNG/SVG downloads render; rotate/revoke UI transitions',async()=>pageAt('/paint-guide/g/A/access',async p=>{
  await heading(p,'Share with care');assert.equal(await p.getByRole('img',{name:'QR code for the revealed private Paint Guide link'}).count(),0);
  assert.equal(await p.getByRole('button',{name:'Download PNG',exact:true}).isDisabled(),true);
  await p.getByRole('button',{name:'Recover Access',exact:true}).click();
  await p.getByRole('img',{name:'QR code for the revealed private Paint Guide link'}).waitFor();
  const first=await p.locator('[data-private-link]').textContent();
  const pngPromise=p.waitForEvent('download');await p.getByRole('button',{name:'Download PNG',exact:true}).click();
  const png=await pngPromise;assert.equal(png.suggestedFilename(),'tauro-paint-guide-access.png');
  const chunks=[];for await(const chunk of await png.createReadStream())chunks.push(chunk);const bytes=Buffer.concat(chunks);
  assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes.readUInt32BE(16),1024);assert.equal(bytes.readUInt32BE(20),1024);await png.delete();
  const svgPromise=p.waitForEvent('download');await p.getByRole('button',{name:'Download SVG',exact:true}).click();
  const svg=await svgPromise;assert.equal(svg.suggestedFilename(),'tauro-paint-guide-access.svg');
  const svgChunks=[];for await(const chunk of await svg.createReadStream())svgChunks.push(chunk);const xml=Buffer.concat(svgChunks).toString();
  assert.match(xml,/^<svg/);assert.equal(xml.includes(first),false);assert.equal(/<script|\shref=/.test(xml),false);await svg.delete();
  assert.equal(await p.evaluate(()=>JSON.stringify(localStorage)+JSON.stringify(sessionStorage)), '{}{}');
  await p.reload();await heading(p,'Share with care');assert.equal(await p.locator('[data-private-link]').count(),0);
  await p.getByRole('button',{name:'Recover Access',exact:true}).click();await p.locator('[data-private-link]').waitFor();
  assert.equal(await p.locator('[data-private-link]').textContent(),first);
  await p.getByRole('button',{name:'Rotate Access',exact:true}).click();await p.getByRole('alertdialog').getByRole('button',{name:'Rotate Access',exact:true}).click();
  await p.waitForFunction(first=>document.querySelector('[data-private-link]')?.textContent!==first,first);
  await p.getByRole('button',{name:'Revoke Access',exact:true}).click();await p.getByRole('alertdialog').getByRole('button',{name:'Revoke Access',exact:true}).click();
  await p.getByText('Unavailable. Access has been revoked.',{exact:true}).waitFor();assert.equal(await p.locator('[data-private-link]').count(),0);
  await p.getByRole('button',{name:'Rotate Access',exact:true}).click();await p.getByRole('alertdialog').getByRole('button',{name:'Rotate Access',exact:true}).click();
  await p.getByText('Available to the homeowner.',{exact:true}).waitFor();
}));
test('supervisor UI does not offer owner-only Rotate or Revoke controls',async()=>pageAt('/paint-guide',async p=>{
  await p.evaluate(()=>globalThis.__qa.role='supervisor');await navigate(p,'/paint-guide/g/A/access');await heading(p,'Share with care');
  assert.equal(await p.getByRole('button',{name:'Rotate Access',exact:true}).count(),0);
  assert.equal(await p.getByRole('button',{name:'Revoke Access',exact:true}).count(),0);
}));
test('staff editor navigation fits a 360px mobile viewport',async()=>pageAt('/paint-guide/g/A/colors',async p=>{
  await p.setViewportSize({width:360,height:800});await readyColor(p);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
}));
