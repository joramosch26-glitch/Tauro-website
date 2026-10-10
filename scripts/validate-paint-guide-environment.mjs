// Synthetic builds only; never contacts Supabase or loads customer credentials.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const reference = 'abcdefghijklmnopqrst';
const canary = 'synthetic_backend_only_P0C_leak_canary';
const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
  !name.startsWith('VITE_') && !name.startsWith('TAURO_PG_') && !name.startsWith('VERCEL')));
function build(config, expected) {
  const result = spawnSync('npm', ['run', 'build'], { env: { ...inherited, ...config }, encoding: 'utf8' });
  if ((result.status === 0) !== expected) throw new Error('Unexpected synthetic build result.');
  return result.stdout + result.stderr;
}
function inspectOutput() {
  const assets = readdirSync('dist/assets').filter((name) => name.endsWith('.js'));
  const source = assets.map((name) => readFileSync(path.join('dist/assets', name), 'utf8')).join('\n');
  assert.ok(!source.includes(canary));
  for (const marker of ['TAURO_PG_SUPABASE_SECRET_KEY', 'TOKEN_LOOKUP_HMAC_KEY_V',
    'TOKEN_ENCRYPTION_KEY_V', 'SESSION_HMAC_KEY_V', 'node:crypto', 'recoverStaffAccessBearer']) {
    assert.ok(!source.includes(marker), 'Server boundary leaked into browser assets.');
  }
  const seo = JSON.parse(readFileSync('src/seo.json', 'utf8'));
  function inspectMarketingGraph(asset, visited = new Set()) {
    if (/^https?:\/\//.test(asset)) return; // Existing external analytics are outside the local bundle graph.
    const file = asset.startsWith('/') ? path.join('dist', asset) : asset;
    if (visited.has(file)) return;
    visited.add(file);
    const code = readFileSync(file, 'utf8');
    for (const marker of ['sb_publishable_synthetic_public_key_only', '.supabase.co', 'tauro_paint_guide_session']) {
      assert.ok(!code.includes(marker), 'Paint Guide code leaked into Marketing dependency graph.');
    }
    for (const dependency of code.matchAll(/(?:from\s*|import\s*)["'](\.\/[^"']+\.js)["']/g)) {
      inspectMarketingGraph(path.join(path.dirname(file), dependency[1]), visited);
    }
  }
  for (const route of [...seo.routes, seo.notFound]) {
    const file = route.route === '/' ? 'dist/index.html' : route.route === '/404'
      ? 'dist/404.html' : `dist${route.route}/index.html`;
    const html = readFileSync(file, 'utf8');
    assert.ok(html.includes(`<link rel="canonical" href="${route.canonical}"`));
    assert.ok(html.includes('id="ld-json-business"'));
    const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((match) => match[1]);
    for (const script of scripts) {
      assert.ok(!script.includes('paint-guide'));
      inspectMarketingGraph(script);
    }
  }
  const guide = readFileSync('dist/paint-guide.html', 'utf8');
  assert.match(guide, /noindex/);
  assert.ok(!readFileSync('dist/sitemap.xml', 'utf8').includes('/paint-guide'));
  assert.ok(!readFileSync('dist/robots.txt', 'utf8').includes('Allow: /paint-guide'));
}
build({}, true); inspectOutput();
console.log('PASS local marketing build, prerender, canonical, sitemap and bundle boundary');
const base = {
  VITE_SUPABASE_URL: `https://${reference}.supabase.co`,
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_public_key_only',
  VITE_TAURO_PG_EXPECTED_PROJECT_REF: reference,
  TAURO_PG_SUPABASE_URL: `https://${reference}.supabase.co`, TAURO_PG_EXPECTED_PROJECT_REF: reference,
  TAURO_PG_SUPABASE_SECRET_KEY: canary, TAURO_PG_TOKEN_ENCRYPTION_KEY_V1: canary,
  TAURO_PG_TOKEN_LOOKUP_HMAC_KEY_V1: canary, TAURO_PG_SESSION_HMAC_KEY_V1: canary,
  VERCEL: '1',
};
for (const environment of ['preview', 'production']) {
  build({ ...base, VITE_TAURO_PG_ENVIRONMENT: environment, TAURO_PG_ENVIRONMENT: environment, VERCEL_ENV: environment }, true);
  inspectOutput();
  const assets = readdirSync('dist/assets').filter((name) => name.endsWith('.js'));
  assert.ok(assets.some((name) => readFileSync(path.join('dist/assets', name), 'utf8').includes('sb_publishable_synthetic_public_key_only')));
  console.log(`PASS synthetic ${environment} build and public/secret bundle checks`);
}
const preview = { ...base, VITE_TAURO_PG_ENVIRONMENT: 'preview', TAURO_PG_ENVIRONMENT: 'preview', VERCEL_ENV: 'preview' };
const diagnostics = build({ ...preview, DEBUG: 'vite:env', VERCEL_TOKEN: canary }, false);
assert.ok(!diagnostics.includes(canary), 'Server credential leaked through Vite env diagnostics.');
assert.ok(diagnostics.includes('Paint Guide configuration is unavailable.'));
const diagnosticDirectory = mkdtempSync(path.join(tmpdir(), 'tauro-p0c-diagnostics-'));
try {
  writeFileSync(path.join(diagnosticDirectory, '.env'), `TAURO_PG_SUPABASE_SECRET_KEY=${canary}\n`);
  const cliDiagnostics = spawnSync('node', [path.resolve('node_modules/vite/bin/vite.js'), 'build',
    '--config', path.resolve('vite.config.ts'), '--debug'], {
    cwd: diagnosticDirectory, env: { ...inherited, ...preview, VERCEL_TOKEN: canary }, encoding: 'utf8',
  });
  assert.notEqual(cliDiagnostics.status, 0);
  assert.ok(!(cliDiagnostics.stdout + cliDiagnostics.stderr).includes(canary));
  assert.ok((cliDiagnostics.stdout + cliDiagnostics.stderr).includes('Paint Guide configuration is unavailable.'));
} finally { rmSync(diagnosticDirectory, { recursive: true, force: true }); }
console.log('PASS negative diagnostic builds: DEBUG=vite:env and CLI --debug fail without credential output');
for (const [name, config] of [
  ['missing deployment config', { VERCEL: '1', VERCEL_ENV: 'production' }],
  ['project mismatch', { ...preview, TAURO_PG_EXPECTED_PROJECT_REF: 'tsrqponmlkjihgfedcba' }],
  ['platform mismatch', { ...preview, VERCEL_ENV: 'production' }],
  ['privileged browser key', { ...preview, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_synthetic_only' }],
  ['privileged alternate variable', { ...preview, VITE_OTHER: 'sb_secret_synthetic_only' }],
]) { build(config, false); console.log(`PASS negative build: ${name}`); }
