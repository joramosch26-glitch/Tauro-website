import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

let vite, browser, origin;
const fixture = `
import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {HomeownerPrivateImage} from '/src/paint-guide/components/HomeownerPrivateImage.tsx';
import {HomeownerGuideDocument} from '/src/paint-guide/components/HomeownerGuideDocument.tsx';
import {buildHomeownerPhotoSources} from '/src/paint-guide/homeowner/photo-sources.ts';
const originalFetch=window.fetch.bind(window);
window.fetch=(input,init={})=>{
 if(String(input).endsWith('/slow'))init.signal?.addEventListener('abort',()=>window.qaSlowAborted=true,{once:true});
 return originalFetch(input,init);
};
function App(){
 const [source,setSource]=useState('slow');const [session,setSession]=useState(false);
 useEffect(()=>{const handler=()=>setSession(true);window.addEventListener('paintguide:homeowner-session-unavailable',handler);window.qaChangeSource=setSource;return()=>window.removeEventListener('paintguide:homeowner-session-unavailable',handler);},[]);
 const mode=new URL(location.href).searchParams.get('mode');
 const recordId='73000000-0000-4000-8000-000000000301';
 const locationId='73000000-0000-4000-8000-000000000302';
 const photoVersion='73000000-0000-4000-8000-000000000303';
 const homeownerDocument={guide:{residence_name:'Synthetic QA Formula Label Flow',primary_scope_note:null},
  locations:[{id:locationId,parent_id:null,name:'Synthetic Test Room',sort_order:0,created_at:'2026-10-28T00:00:00Z'}],
  records:[{id:recordId,section:'primary',surface:'Synthetic Test Wall',brand:null,product:'Synthetic Test Paint',color_name:'Synthetic Sample Color',color_code:null,sheen:'Eggshell',notes:null,sort_order:0,created_at:'2026-10-28T00:00:00Z'}],
  assignments:[{paint_record_id:recordId,location_id:locationId}],
  photos:[{slot_id:'73000000-0000-4000-8000-000000000304',version_id:photoVersion,placement_kind:'record_formula_label',location_id:null,paint_record_id:recordId}]};
 const homeownerPhotoSources=buildHomeownerPhotoSources(homeownerDocument.photos);
 return React.createElement('main',null,
  session?React.createElement('p',{role:'alert'},'Private link may have ended or been disabled'):null,
  mode==='category-formula'?React.createElement(HomeownerGuideDocument,{data:homeownerDocument,...homeownerPhotoSources}):
  mode==='lazy'?React.createElement(React.Fragment,null,
   React.createElement('section',{style:{height:'400px'}},React.createElement(HomeownerPrivateImage,{src:'/api/paint-guide/homeowner/photos/cover',alt:'cover',fetchPriority:'high'})),
   React.createElement('section',{style:{marginTop:'1200px',height:'300px'}},React.createElement(HomeownerPrivateImage,{src:'/api/paint-guide/homeowner/photos/room-context',alt:'room context',loading:'lazy'}))
  ):mode==='status'?React.createElement(React.Fragment,null,
   React.createElement(HomeownerPrivateImage,{src:'/api/paint-guide/homeowner/photos/denied',alt:'denied'}),
   React.createElement(HomeownerPrivateImage,{src:'/api/paint-guide/homeowner/photos/missing',alt:'missing'}),
   React.createElement(HomeownerPrivateImage,{src:'/api/paint-guide/homeowner/photos/retry',alt:'retry'})
  ):React.createElement(React.Fragment,null,
   React.createElement('button',{onClick:()=>setSource('fresh')},'Switch source'),
   React.createElement(HomeownerPrivateImage,{src:'/api/paint-guide/homeowner/photos/'+source,alt:source})
  )
 );
}
createRoot(document.getElementById('root')).render(React.createElement(App));`;

before(async () => {
  const module = process.env.TAURO_QA_PLAYWRIGHT_MODULE;
  const { chromium } = await import(module ? pathToFileURL(module).href : 'playwright');
  vite = await createServer({ configFile: false, envFile: false, appType: 'custom',
    server: { host: '127.0.0.1', port: 0 }, plugins: [{ name: 'homeowner-photo-browser-fixture', enforce: 'pre',
      resolveId(id) { if (id === '/__qa.tsx') return '\0homeowner-photo-qa.tsx'; },
      load(id) { if (id === '\0homeowner-photo-qa.tsx') return fixture; },
    }, react()], optimizeDeps: { noDiscovery: true, include: ['react','react-dom/client'] } });
  vite.middlewares.use(async (req,res,next)=>{
    if(!req.url?.startsWith('/paint-guide'))return next();
    res.setHeader('Content-Type','text/html');
    res.end(await vite.transformIndexHtml(req.url,'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__qa.tsx"></script></body></html>'));
  });
  await vite.listen();
  origin=`http://127.0.0.1:${vite.httpServer.address().port}`;
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined,headless:true,args:process.env.CHROMIUM_PATH?['--no-sandbox']:[]});
});
after(async()=>{await browser?.close();await vite?.close();});

async function openPage(path, photoHandler) {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));page.on('console',message=>{if(message.type()==='error')pageErrors.push(message.text());});
  await page.route('**/api/paint-guide/homeowner/photos/**',photoHandler ?? (route=>route.continue()));
  await page.goto(origin+path);
  try { await page.waitForFunction(()=>typeof window.qaChangeSource==='function',{},{timeout:5000}); }
  catch { await context.close();throw new Error(`Synthetic photo fixture startup failed: ${pageErrors.join(' | ')}`); }
  return {context,page};
}

test('lazy private context photos load when scrolled into view on a mobile viewport',async()=>{
  const requested=[];
  const photoHandler=async route=>{
    const id=new URL(route.request().url()).pathname.split('/').pop();requested.push(id);
    await route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="green"/></svg>'});
  };
  const {context,page}=await openPage('/paint-guide?mode=lazy',photoHandler);
  try {
    await page.getByAltText('cover').waitFor();
    await page.waitForFunction(()=>document.querySelector('img[alt="cover"]')?.src.startsWith('blob:'));
    await page.waitForTimeout(100);
    const initialGeometry=await page.evaluate(()=>({scrollY:window.scrollY, roomTop:document.querySelector('main section:nth-of-type(2)')?.getBoundingClientRect().top, viewport:window.innerHeight}));
    assert.equal(requested.filter(id=>id==='room-context').length,0,`offscreen room photo should wait for scroll (${JSON.stringify(initialGeometry)})`);
    await page.evaluate(()=>window.scrollTo(0,1000));
    await page.waitForFunction(()=>document.querySelector('img[alt="room context"]')?.src.startsWith('blob:'));
    assert.equal(requested.filter(id=>id==='room-context').length,1,'photo should load once after entering the mobile viewport');
  } finally { await context.close(); }
});

test('formula label photo reaches the paint-by-category detail view and loads through the private route',async()=>{
  const requested=[];
  const photoVersion='73000000-0000-4000-8000-000000000303';
  const photoHandler=async route=>{
    requested.push(new URL(route.request().url()).pathname.split('/').pop());
    await route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8"><rect width="12" height="8" fill="green"/></svg>'});
  };
  const {context,page}=await openPage('/paint-guide?mode=category-formula',photoHandler);
  try {
    await page.getByRole('button',{name:'Browse Synthetic Test Wall, 1 paint selection',exact:true}).click();
    await page.getByRole('heading',{name:'Paint-can formula label photo',exact:true}).waitFor();
    const image=page.getByAltText('Formula-label image for Synthetic Sample Color, photo 1');
    await image.waitFor();
    await page.waitForFunction(version=>document.querySelector('img[alt="Formula-label image for Synthetic Sample Color, photo 1"]')?.src.startsWith('blob:'),photoVersion);
    assert.deepEqual(requested,[photoVersion]);
  } finally { await context.close(); }
});

test('expired session, missing photo, and temporary errors render distinct safe recovery states',async()=>{
  const attempts=new Map();
  const photoHandler=async route=>{
    const id=new URL(route.request().url()).pathname.split('/').pop();
    attempts.set(id,(attempts.get(id)??0)+1);
    if(id==='denied')return route.fulfill({status:401,contentType:'application/json',body:'{"available":false}'});
    if(id==='missing')return route.fulfill({status:404,contentType:'application/json',body:'{"available":false}'});
    if(id==='retry'&&attempts.get(id)===1)return route.fulfill({status:503,contentType:'application/json',body:'{"available":false}'});
    return route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>'});
  };
  const {context,page}=await openPage('/paint-guide?mode=status',photoHandler);
  try {
    await page.getByRole('alert').getByText('Private link may have ended or been disabled').waitFor();
    await page.getByText('Photo unavailable',{exact:true}).first().waitFor();
    assert.equal(await page.getByText('Photo unavailable',{exact:true}).count(),2,'both 401 and 404 responses share the same non-sensitive image fallback');
    await page.getByRole('button',{name:'Photo could not load. Retry'}).click();
    await page.waitForFunction(()=>document.querySelector('img[alt="retry"]')?.src.startsWith('blob:'));
    assert.equal(attempts.get('retry'),2);
  } finally { await context.close(); }
});

test('navigation aborts an old photo request and displays only the current source',async()=>{
  let slowRequested;const slowRequest=new Promise(resolve=>{slowRequested=resolve;});
  const photoHandler=async route=>{
    if(route.request().url().endsWith('/slow')){
      slowRequested();
      await new Promise(resolve=>setTimeout(resolve,1000));
      try { await route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>'}); } catch {}
      return;
    }
    if(route.request().url().endsWith('/fresh')) return route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>'});
    return route.continue();
  };
  const {context,page}=await openPage('/paint-guide?mode=cancel',photoHandler);
  try {
    await slowRequest;
    await page.getByRole('button',{name:'Switch source'}).click();
    await page.waitForFunction(()=>document.querySelector('img[alt="fresh"]')?.src.startsWith('blob:'));
    await page.waitForFunction(()=>window.qaSlowAborted===true);
    assert.equal(await page.locator('img[alt="slow"]').count(),0);
  } finally { await context.close(); }
});
