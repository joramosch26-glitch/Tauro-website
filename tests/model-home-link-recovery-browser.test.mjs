import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

let vite, browser, origin;
const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ModelHomePhotoPreparationPage} from '/src/paint-guide/homeowner/ModelHomePhotoPreparationPage.tsx';
createRoot(document.getElementById('root')).render(React.createElement(ModelHomePhotoPreparationPage));
`;
const actorId = 'e8fa431f-ea5c-46fb-b92c-6d5d213531bc';
const guideId = '2a35d308-45a7-4b08-8d8d-83ddb16f0e29';
const tokenFragment = `#tpgh1.1.${'A'.repeat(43)}`;

before(async () => {
  const module = process.env.TAURO_QA_PLAYWRIGHT_MODULE;
  const { chromium } = await import(module ? pathToFileURL(module).href : 'playwright');
  vite = await createServer({ configFile: false, envFile: false, appType: 'custom',
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://qa-test.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_synthetic_test'),
    },
    server: { host: '127.0.0.1', port: 0 }, plugins: [{ name: 'model-home-link-recovery-fixture', enforce: 'pre',
      resolveId(id) { if (id === '/__qa.tsx') return '\0model-home-link-recovery.tsx'; },
      load(id) { if (id === '\0model-home-link-recovery.tsx') return fixture; },
    }, react()], optimizeDeps: { noDiscovery: true, include: ['react','react-dom/client'] } });
  vite.middlewares.use(async (req, res, next) => {
    if (!req.url?.startsWith('/paint-guide')) return next();
    res.setHeader('Content-Type', 'text/html');
    res.end(await vite.transformIndexHtml(req.url, '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__qa.tsx"></script></body></html>'));
  });
  await vite.listen();
  origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
});

after(async () => { await browser?.close(); await vite?.close(); });

async function signedInPage(accessState, { recoverFailure = false } = {}) {
  const calls = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === 'https://qa-test.supabase.co' && url.pathname === '/auth/v1/token') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        access_token: 'synthetic.test.access-token', user: { id: actorId },
      }) });
    }
    if (url.origin === origin && url.pathname.startsWith('/api/paint-guide/staff/access/')) {
      const operation = url.pathname.split('/').pop();
      calls.push({ operation, body: route.request().postDataJSON() });
      if (operation === 'status') {
        const active = accessState === 'active';
        const revoked = accessState === 'revoked';
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          guideId, guideStatus: 'published', accessState,
          tokenGeneration: accessState === 'absent' ? null : 1,
          sessionEpoch: accessState === 'absent' ? null : 1,
          homeownerExchangeAvailable: active && !revoked,
        }) });
      }
      if (operation === 'recover') {
        if (recoverFailure) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ available: false }) });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          guideId, guideStatus: 'published', accessState: 'active', tokenGeneration: 1,
          sessionEpoch: 1, homeownerExchangeAvailable: true,
          privateUrl: `${origin}/paint-guide/p${tokenFragment}`,
        }) });
      }
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ available: false }) });
    }
    if (url.origin === origin) return route.continue();
    return route.abort();
  });
  await page.goto(`${origin}/paint-guide/qa-model-home`);
  await page.getByLabel('Test password', { exact: true }).fill('synthetic-test-password');
  await page.getByRole('button', { name: 'Sign in to synthetic QA', exact: true }).click();
  await page.getByRole('button', { name: 'Check existing homeowner link status', exact: true }).waitFor();
  return { context, page, calls };
}

for (const state of ['absent', 'revoked']) {
  test(`${state} QA access allows status check only; recover stays disabled`, async () => {
    const { context, page, calls } = await signedInPage(state);
    try {
      const recover = page.getByRole('button', { name: 'Recover existing homeowner link', exact: true });
      assert.equal(await recover.isDisabled(), true);
      await page.getByRole('button', { name: 'Check existing homeowner link status', exact: true }).click();
      await page.getByRole('status').filter({ hasText: state === 'absent' ? 'No existing QA homeowner link' : 'revoked' }).waitFor();
      assert.equal(await recover.isDisabled(), true);
      assert.deepEqual(calls.map(call => call.operation), ['status']);
      assert.ok(calls.every(call => call.body.guideId === guideId));
    } finally { await context.close(); }
  });
}

test('active QA access can recover only the existing link; decryption failure never issues a replacement', async () => {
  const { context, page, calls } = await signedInPage('active', { recoverFailure: true });
  try {
    await page.getByRole('button', { name: 'Check existing homeowner link status', exact: true }).click();
    const recover = page.getByRole('button', { name: 'Recover existing homeowner link', exact: true });
    await recover.waitFor();
    assert.equal(await recover.isEnabled(), true);
    await recover.click();
    await page.getByRole('status').filter({ hasText: 'No new link was issued; the stored QA token may not match this Preview' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Open recovered homeowner guide', exact: true }).count(), 0);
    assert.deepEqual(calls.map(call => call.operation), ['status', 'recover']);
    assert.ok(calls.every(call => call.body.guideId === guideId));
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage)), '{}{}');
  } finally { await context.close(); }
});

test('active QA access keeps a recovered private URL in memory and never renders or logs its bearer', async () => {
  const { context, page, calls } = await signedInPage('active');
  const consoleMessages = [];
  page.on('console', message => consoleMessages.push(message.text()));
  try {
    await page.getByRole('button', { name: 'Check existing homeowner link status', exact: true }).click();
    await page.getByRole('button', { name: 'Recover existing homeowner link', exact: true }).click();
    await page.getByRole('button', { name: 'Open recovered homeowner guide', exact: true }).waitFor();
    const bodyText = await page.locator('body').innerText();
    assert.equal(bodyText.includes(tokenFragment.slice(1)), false);
    assert.equal(consoleMessages.some(message => message.includes(tokenFragment.slice(1))), false);
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage)), '{}{}');
    assert.deepEqual(calls.map(call => call.operation), ['status', 'recover']);
    assert.ok(calls.every(call => call.body.guideId === guideId));
  } finally { await context.close(); }
});
