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
import {SyntheticPreviewTestPage} from '/src/paint-guide/homeowner/SyntheticPreviewTestPage.tsx';
const Page = location.pathname.endsWith('/qa-synthetic') ? SyntheticPreviewTestPage : ModelHomePhotoPreparationPage;
createRoot(document.getElementById('root')).render(React.createElement(Page));
`;
const actorId = 'e8fa431f-ea5c-46fb-b92c-6d5d213531bc';
const modelGuideId = '2a35d308-45a7-4b08-8d8d-83ddb16f0e29';
const syntheticGuideId = 'b28d3dd5-eb34-46a2-99de-7af143de80db';
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

async function signedInPage(accessState, { recoverFailure = false, recoverMalformed = false, recoverEmpty = false, recoverReject = false, recoverDelayMs = 0, synthetic = false } = {}) {
  const calls = [];
  const guideId = synthetic ? syntheticGuideId : modelGuideId;
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
        if (recoverDelayMs) await new Promise(resolve => setTimeout(resolve, recoverDelayMs));
        if (recoverReject) { try { await route.abort(); } catch { /* The page may already have cancelled this request. */ } return; }
        if (recoverFailure) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ available: false }) });
        if (recoverMalformed) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
        if (recoverEmpty) return route.fulfill({ status: 200, contentType: 'application/json', body: '' });
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
  await page.goto(`${origin}/paint-guide/${synthetic ? 'qa-synthetic' : 'qa-model-home'}`);
  await page.getByLabel(synthetic ? 'Temporary test password' : 'Test password', { exact: true }).fill('synthetic-test-password');
  await page.getByRole('button', { name: 'Sign in to synthetic QA', exact: true }).click();
  await page.getByRole('button', { name: synthetic ? 'Check homeowner link status' : 'Check existing homeowner link status', exact: true }).waitFor();
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
      assert.ok(calls.every(call => call.body.guideId === modelGuideId));
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
    assert.ok(calls.every(call => call.body.guideId === modelGuideId));
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
    assert.ok(calls.every(call => call.body.guideId === modelGuideId));
  } finally { await context.close(); }
});

test('the independent synthetic QA guide uses status and recover only; it never issues or rotates access', async () => {
  const { context, page, calls } = await signedInPage('active', { synthetic: true });
  try {
    const recover = page.getByRole('button', { name: 'Recover existing homeowner link', exact: true });
    assert.equal(await recover.isDisabled(), true);
    await page.getByRole('button', { name: 'Check homeowner link status', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'An existing synthetic homeowner link is active' }).waitFor();
    assert.equal(await recover.isEnabled(), true);
    await recover.click();
    await page.getByRole('button', { name: 'Open synthetic homeowner guide', exact: true }).waitFor();
    assert.deepEqual(calls.map(call => call.operation), ['status', 'recover']);
    assert.ok(calls.every(call => call.body.guideId === syntheticGuideId));
    assert.equal(await page.getByRole('button', { name: 'Issue homeowner link', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: /rotate/i }).count(), 0);
  } finally { await context.close(); }
});

test('synthetic recovery replaces the stale active status while pending, then shows the recovered-link action', async () => {
  const { context, page, calls } = await signedInPage('active', { synthetic: true, recoverDelayMs: 250 });
  try {
    await page.getByRole('button', { name: 'Check homeowner link status', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'An existing synthetic homeowner link is active' }).waitFor();
    await page.getByRole('button', { name: 'Recover existing homeowner link', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Recovering the existing synthetic homeowner link' }).waitFor();
    await page.getByRole('button', { name: 'Open synthetic homeowner guide', exact: true }).waitFor();
    await page.getByRole('status').filter({ hasText: 'Existing synthetic homeowner link recovered in memory' }).waitFor();
    assert.deepEqual(calls.map(call => call.operation), ['status', 'recover']);
  } finally { await context.close(); }
});

test('synthetic recovery reports malformed successful responses without exposing a link', async () => {
  const { context, page, calls } = await signedInPage('active', { synthetic: true, recoverMalformed: true });
  try {
    await page.getByRole('button', { name: 'Check homeowner link status', exact: true }).click();
    await page.getByRole('button', { name: 'Recover existing homeowner link', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Could not recover the existing synthetic link' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Open synthetic homeowner guide', exact: true }).count(), 0);
    assert.deepEqual(calls.map(call => call.operation), ['status', 'recover']);
  } finally { await context.close(); }
});

test('synthetic recovery reports an empty successful response without exposing a link', async () => {
  const { context, page, calls } = await signedInPage('active', { synthetic: true, recoverEmpty: true });
  try {
    await page.getByRole('button', { name: 'Check homeowner link status', exact: true }).click();
    await page.getByRole('button', { name: 'Recover existing homeowner link', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Could not recover the existing synthetic link' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Open synthetic homeowner guide', exact: true }).count(), 0);
    assert.deepEqual(calls.map(call => call.operation), ['status', 'recover']);
  } finally { await context.close(); }
});

test('synthetic recovery rejection reports a safe error and never falls back to issuing access', async () => {
  const { context, page, calls } = await signedInPage('active', { synthetic: true, recoverReject: true });
  try {
    await page.getByRole('button', { name: 'Check homeowner link status', exact: true }).click();
    await page.getByRole('button', { name: 'Recover existing homeowner link', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Could not recover the existing synthetic link' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Open synthetic homeowner guide', exact: true }).count(), 0);
    assert.deepEqual(calls.map(call => call.operation), ['status', 'recover']);
  } finally { await context.close(); }
});

test('signing out cancels an in-flight synthetic recovery and ignores its late response', async () => {
  const { context, page, calls } = await signedInPage('active', { synthetic: true, recoverDelayMs: 350 });
  try {
    await page.getByRole('button', { name: 'Check homeowner link status', exact: true }).click();
    await page.getByRole('button', { name: 'Recover existing homeowner link', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Recovering the existing synthetic homeowner link' }).waitFor();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByLabel('Temporary test password', { exact: true }).waitFor();
    await page.waitForTimeout(450);
    assert.equal(await page.getByRole('button', { name: 'Open synthetic homeowner guide', exact: true }).count(), 0);
    assert.deepEqual(calls.map(call => call.operation), ['status', 'recover']);
  } finally { await context.close(); }
});

test('leaving the synthetic page cancels an in-flight recovery request', async () => {
  const { context, page, calls } = await signedInPage('active', { synthetic: true, recoverDelayMs: 350 });
  try {
    await page.getByRole('button', { name: 'Check homeowner link status', exact: true }).click();
    const failed = page.waitForEvent('requestfailed', event => new URL(event.url()).pathname.endsWith('/staff/access/recover'));
    await page.getByRole('button', { name: 'Recover existing homeowner link', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Recovering the existing synthetic homeowner link' }).waitFor();
    await page.goto(`${origin}/paint-guide/away`);
    await failed;
    await page.waitForTimeout(400);
    assert.deepEqual(calls.map(call => call.operation), ['status', 'recover']);
  } finally { await context.close(); }
});
