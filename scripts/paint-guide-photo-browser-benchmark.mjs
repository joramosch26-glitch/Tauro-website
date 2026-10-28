import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { pathToFileURL } from 'node:url';

const baselineRoot = process.argv[2];
if (!baselineRoot) throw new Error('Usage: node scripts/paint-guide-photo-browser-benchmark.mjs <baseline-checkout>');
const currentRoot = process.cwd();
const playModule = process.env.TAURO_QA_PLAYWRIGHT_MODULE;
const { chromium } = await import(playModule ? pathToFileURL(playModule).href : 'playwright');
const PORTS = { baseline: 5191, modified: 5192 };
const RTT_MS = 160;
const THROUGHPUT_BYTES_PER_SECOND = 256_000;
const SAMPLES = 3;
const PHOTO_IDS = ['cover', ...Array.from({ length: 9 }, (_, index) => `room-${index + 1}`)];
const PHOTO_BYTES = new Map([['cover', 300_000], ...Array.from({ length: 9 }, (_, index) => [`room-${index + 1}`, index < 2 ? 58_000 : 57_000])]);
const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {GuideLanding} from '/src/paint-guide/components/GuideLanding.tsx';
const date='2026-10-28T00:00:00Z';
const locations=Array.from({length:9},(_,i)=>({id:'location-'+(i+1),parent_id:null,name:'Synthetic Room '+(i+1),sort_order:i,created_at:date}));
const records=Array.from({length:9},(_,i)=>({id:'record-'+(i+1),section:'primary',surface:'Synthetic surface '+(i+1),brand:'Synthetic brand',product:null,color_name:'Synthetic color '+(i+1),color_code:null,sheen:'Satin',notes:null,sort_order:i,created_at:date}));
const data={guide:{residence_name:'Synthetic Paint Guide',primary_scope_note:null},locations,records,assignments:records.map((record,i)=>({paint_record_id:record.id,location_id:locations[i].id}))};
const roomPhotoUrls=Object.fromEntries(locations.map((location,i)=>[location.id,'/api/paint-guide/homeowner/photos/room-'+(i+1)]));
createRoot(document.getElementById('root')).render(React.createElement(GuideLanding,{data,heroImageUrl:'/api/paint-guide/homeowner/photos/cover',roomPhotoUrls,renderSpecifications:()=>React.createElement('p',null,'Nine synthetic paint records in this one synthetic guide.'),renderRoomPaints:()=>null}));
`;

async function makeServer(root, port) {
  const server = await createServer({ root, configFile: false, envFile: false, appType: 'custom',
    server: { host: '127.0.0.1', port, strictPort: true },
    plugins: [{ name: 'photo-benchmark-fixture', enforce: 'pre',
      resolveId(id) { if (id === '/__benchmark.tsx') return '\0benchmark.tsx'; },
      load(id) { if (id === '\0benchmark.tsx') return fixture; },
    }, react()], optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client'] } });
  server.middlewares.use(async (req, res, next) => {
    if (!req.url?.startsWith('/paint-guide')) return next();
    res.setHeader('Content-Type', 'text/html');
    res.end(await server.transformIndexHtml(req.url, '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__benchmark.tsx"></script></body></html>'));
  });
  await server.listen();
  return { server, origin: `http://127.0.0.1:${port}` };
}

function bodyOfSize(size) {
  const head = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#7b8f77"/>');
  const tail = Buffer.from('</svg>');
  return Buffer.concat([head, Buffer.alloc(Math.max(0, size - head.length - tail.length), 32), tail]);
}
const bodies = new Map(PHOTO_IDS.map(id => [id, bodyOfSize(PHOTO_BYTES.get(id))]));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function sample(variant, browser, origin, sampleKind, index) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const requests = [];
  await page.route('**/api/paint-guide/homeowner/photos/**', async route => {
    const id = new URL(route.request().url()).pathname.split('/').pop();
    const body = bodies.get(id);
    if (!body) return route.fulfill({ status: 404, body: '' });
    const started = Date.now();
    const item = { id, bytes: body.length, startedAtMs: started, completedAtMs: null };
    requests.push(item);
    await delay(RTT_MS + body.length / THROUGHPUT_BYTES_PER_SECOND * 1000);
    try {
      await route.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'cache-control': 'no-store, private' }, body });
      item.completedAtMs = Date.now();
    } catch { item.completedAtMs = Date.now(); }
  });
  const navigationStartedAt = Date.now();
  await page.goto(origin + '/paint-guide', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!document.querySelector('.pg-hero-background')?.complete && document.querySelector('.pg-hero-background')?.naturalWidth > 0);
  const firstImageMs = await page.evaluate(() => performance.now());
  const visibleRoomIds = await page.evaluate(() => [...document.querySelectorAll('.pg-location-card')]
    .map((card, index) => ({ rect: card.getBoundingClientRect(), id: `room-${index + 1}` }))
    .filter(({ rect }) => rect.bottom > 0 && rect.top < innerHeight)
    .map(item => item.id));
  async function waitForPhotos(ids) {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const completed = new Set(requests.filter(request => request.completedAtMs !== null).map(request => request.id));
      if (ids.every(id => completed.has(id))) return;
      await delay(10);
    }
    throw new Error(`${variant} ${sampleKind} sample ${index}: timed out waiting for ${ids.join(', ')}`);
  }
  await waitForPhotos(visibleRoomIds);
  const firstViewportReadyMs = await page.evaluate(() => performance.now());
  const initialRequestCount = requests.length;
  const initialBytes = requests.reduce((sum, item) => sum + item.bytes, 0);

  const documentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let top = 0; top < documentHeight; top += 250) {
    await page.evaluate(y => window.scrollTo(0, y), top);
    await delay(45);
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await waitForPhotos(PHOTO_IDS);
  const allPhotosReadyMs = await page.evaluate(() => performance.now());
  const result = {
    variant, sampleKind, index, viewport: '390x844 mobile', simulatedRttMs: RTT_MS,
    simulatedThroughputBytesPerSecond: THROUGHPUT_BYTES_PER_SECOND,
    firstImageMs: Math.round(firstImageMs),
    initialViewportPhotoIds: visibleRoomIds,
    initialViewportReadyMs: Math.round(firstViewportReadyMs),
    initialRequestsUntilVisibleReady: initialRequestCount,
    initialBytesUntilVisibleReady: initialBytes,
    fullScrollAllPhotosReadyMs: Math.round(allPhotosReadyMs),
    allPhotoRequests: requests.length,
    allPhotoBytes: requests.reduce((sum, item) => sum + item.bytes, 0),
    requestCompletionOffsetsMs: requests.map(item => ({ id: item.id, ms: item.completedAtMs - navigationStartedAt })),
  };
  await context.close();
  return result;
}

function summarize(rows, key) {
  const sorted = rows.map(row => row[key]).sort((a, b) => a - b);
  return { median: sorted[Math.floor(sorted.length / 2)], min: sorted[0], max: sorted[sorted.length - 1] };
}

const baselineServer = await makeServer(baselineRoot, PORTS.baseline);
const modifiedServer = await makeServer(currentRoot, PORTS.modified);
const rows = [];
const warmBrowsers = { baseline: await chromium.launch({ headless: true }), modified: await chromium.launch({ headless: true }) };
try {
  // Warm Vite/module/browser processes in balanced order; protected photo responses remain no-store.
  for (const variant of ['baseline', 'modified']) {
    const setup = variant === 'baseline' ? baselineServer : modifiedServer;
    await sample(variant, warmBrowsers[variant], setup.origin, 'warmup', 0);
  }
  for (let index = 1; index <= SAMPLES; index++) {
    const order = index % 2 ? ['baseline', 'modified'] : ['modified', 'baseline'];
    for (const variant of order) {
      const setup = variant === 'baseline' ? baselineServer : modifiedServer;
      const freshBrowser = await chromium.launch({ headless: true });
      rows.push(await sample(variant, freshBrowser, setup.origin, 'cold', index));
      await freshBrowser.close();
    }
    for (const variant of order) {
      const setup = variant === 'baseline' ? baselineServer : modifiedServer;
      rows.push(await sample(variant, warmBrowsers[variant], setup.origin, 'warm', index));
    }
  }
} finally {
  await Promise.all(Object.values(warmBrowsers).map(browser => browser.close()));
  await baselineServer.server.close();
  await modifiedServer.server.close();
}

const summary = {};
for (const variant of ['baseline', 'modified']) {
  for (const sampleKind of ['cold', 'warm']) {
    const group = rows.filter(row => row.variant === variant && row.sampleKind === sampleKind);
    summary[`${variant}_${sampleKind}`] = Object.fromEntries(['firstImageMs', 'initialViewportReadyMs', 'initialRequestsUntilVisibleReady', 'initialBytesUntilVisibleReady', 'fullScrollAllPhotosReadyMs', 'allPhotoRequests', 'allPhotoBytes'].map(key => [key, summarize(group, key)]));
  }
}
console.log(JSON.stringify({ classification: 'synthetic browser benchmark; not real network or iPhone telemetry', fixture: { guides: 1, paintRecords: 9, guideDescription: 'one fictional guide with nine synthetic paint records', photoIds: PHOTO_IDS, coverBytes: PHOTO_BYTES.get('cover'), roomPhotosBytes: PHOTO_IDS.slice(1).reduce((sum, id) => sum + PHOTO_BYTES.get(id), 0), viewport: '390x844 mobile', latencyModel: { fixedRttMs: RTT_MS, bytesPerSecond: THROUGHPUT_BYTES_PER_SECOND, cacheControl: 'no-store, private' }, scrollOrder: 'initial viewport, then vertical 250px increments to bottom' }, summary, samples: rows }, null, 2));
