// Real Admin DOM/browser with explicit API-response fixtures. Not live Nest/DB.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const base = process.env.BASE_URL || 'http://127.0.0.1:3002';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || chromium.executablePath();
const browser = await chromium.launch({ executablePath, headless: true, env: process.env });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
let denied = true, pulls = 0, failPull = false, empty = false;
let external = []; let scheduled = false;
let groups = [], channels = [], orderChanges = 0;
const id = '11111111-1111-4111-8111-111111111111';
const provider = { id, name: 'Authorized Fixture', baseUrl: 'https://provider.fixture', username: 'fixture-user', enabled: true, priority: 100, isDefault: true, connectionStatus: 'unknown', lastCheckedAt: null };
const errors = []; page.on('pageerror', error => errors.push(error.message));
await page.route('**/api/admin/**', async route => {
  const req = route.request(), url = new URL(req.url());
  if (url.pathname.endsWith('/login')) return route.fulfill({ status: denied ? 401 : 200, json: denied ? { error: 'denied' } : { accessToken: 'isolated-browser-fixture-token' } });
  assert.equal(req.headers().authorization, 'Bearer isolated-browser-fixture-token');
  if (url.pathname.startsWith('/api/admin/external-channels')) {
    if(url.pathname.endsWith('/groups')) { if(req.method()==='POST')groups=[{id,...req.postDataJSON()}];return route.fulfill({json:groups}); }
    if(req.method()==='POST'&&url.pathname.endsWith('/sources')) { const body=req.postDataJSON();channels[0].sources.push({id:body.serverId,serverId:body.serverId,priority:body.priority,role:body.priority===1?'primary':'secondary',enabled:false,consecutiveFailures:0,healthySince:null});return route.fulfill({json:channels[0].sources.at(-1)}); }
    if(req.method()==='PUT'&&url.pathname.endsWith('/order')) { const ids=req.postDataJSON().sourceIds;channels[0].sources=ids.map((id,i)=>({...channels[0].sources.find(s=>s.id===id),priority:i+1,role:i===0?'primary':'secondary'}));orderChanges++;return route.fulfill({json:{ordered:ids}}); }
    if(req.method()==='PUT'&&url.pathname.endsWith('/policy')) { Object.assign(channels[0],req.postDataJSON());return route.fulfill({json:channels[0]}); }
    if(req.method()==='POST')channels=[{id,...req.postDataJSON(),enabled:false,autoFailover:false,failureThreshold:2,retrySeconds:60,holdDownSeconds:120,stabilitySeconds:180,freshnessSeconds:900,activeSourceId:null,sources:[]}];
    return route.fulfill({json:channels});
  }
  if (url.pathname.startsWith('/api/admin/external-servers')) {
    if (url.pathname.endsWith('/licenses')) return route.fulfill({ json: [] });
    if (url.pathname.endsWith('/schedule')) { scheduled = true; return route.fulfill({ json: { workerEnabled: false } }); }
    if (url.pathname.endsWith('/check')) return route.fulfill({ json: { result: 'malformed_playlist', details: { licensingStatus: 'licensing_unverified' } } });
    if (req.method() === 'POST') { const body = req.postDataJSON(); external = [{ id, ...body, status: 'candidate', lastCheckedAt: null, lastSuccessfulCheck: null, licenseId: null }]; return route.fulfill({ status: 201, json: external[0] }); }
    if (req.method() === 'DELETE') { external = []; return route.fulfill({ json: { deleted: true } }); }
    return route.fulfill({ json: { items: external, nextCursor: null } });
  }
  if (url.pathname.endsWith('/titles')) return route.fulfill({ json: [] });
  if (url.pathname.endsWith('/catalog-sync/pull')) {
    pulls++; assert.deepEqual(req.postDataJSON(), { authorizationConfirmed: true });
    return route.fulfill({ status: failPull ? 403 : 201, json: failPull ? { error: 'denied' } : { status: 'SUCCEEDED' } });
  }
  if (url.pathname.endsWith('/catalog-sync')) return route.fulfill({ json: { itemCount: 42, lastSuccessAt: '2026-11-01T00:00:00Z', history: [{ status: 'SUCCEEDED', reason: 'OK', at: '2026-11-01T00:00:00Z' }] } });
  return route.fulfill({ json: empty ? [] : [provider] });
});
try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByLabel('البريد الإلكتروني').fill('fixture@example.invalid');
  await page.getByLabel('كلمة المرور', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await page.locator('p[role=alert]:not(#__next-route-announcer__)').waitFor();
  denied = false;
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await page.getByText('Authorized Fixture', { exact: false }).waitFor();
  const pull = page.getByRole('button', { name: 'مزامنة الكتالوج', exact: true });
  page.once('dialog', dialog => dialog.dismiss()); await pull.click();
  assert.equal(pulls, 0, 'cancelled authorization confirmation must never send pull');
  page.once('dialog', dialog => dialog.accept()); await pull.click();
  await page.getByText('عدد العناصر: 42', { exact: false }).waitFor();
  assert.equal(pulls, 1);
  failPull = true;
  page.once('dialog', dialog => dialog.accept()); await pull.click();
  await page.locator('p[role=alert]:not(#__next-route-announcer__)').waitFor();
  assert.ok(await page.getByText('عدد العناصر: 42', { exact: false }).isVisible(), 'last good UI snapshot retained on failed pull');
  empty = true; await page.getByRole('button', { name: 'تحديث القائمة', exact: true }).click();
  await page.getByText('لا توجد سيرفرات مضافة حالياً.').waitFor();
  empty = false; await page.getByRole('button', { name: 'تحديث القائمة', exact: true }).click();
  await pull.waitFor();
  const manager = page.getByRole('region', { name: 'External Servers', exact: true });
  await manager.getByLabel('اسم المصدر', { exact: true }).fill('Synthetic Candidate');
  await manager.locator('input[name=providerName]').fill('Fixture Rights Owner');
  await manager.getByLabel('رابط HTTPS السري', { exact: true }).fill('https://fixture.example/test.m3u8?token=fixture');
  await manager.getByLabel('التصنيف', { exact: true }).fill('Synthetic');
  await manager.getByRole('button', { name: 'حفظ كمرشح', exact: true }).click();
  await manager.getByRole('heading', { name: 'Synthetic Candidate · Fixture Rights Owner' }).waitFor();
  assert.equal(await manager.locator('article').count(), 1);
  assert.equal(await manager.getByLabel('رابط HTTPS السري', { exact: true }).inputValue(), '');
  page.once('dialog', dialog => dialog.accept());
  await manager.getByLabel('جدولة الفحص التقني (Asia/Baghdad)').selectOption('hourly');
  await manager.getByRole('button', { name: 'فحص تقني', exact: true }).waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('[aria-label="نتيجة العملية"]')?.textContent?.includes('workerEnabled'));
  assert.equal(scheduled, true);
  page.once('dialog', dialog => dialog.accept());
  await manager.getByRole('button', { name: 'حذف آمن', exact: true }).click();
  await manager.getByText('لا توجد مصادر مرشحة.', { exact: true }).waitFor();
  const groupPanel=page.getByRole('region',{name:'Provider Groups and Channels',exact:true});
  await groupPanel.getByLabel('اسم مجموعة المزودين',{exact:true}).fill('Synthetic Provider Group');
  await groupPanel.getByRole('button',{name:'إنشاء مجموعة',exact:true}).click();
  await groupPanel.getByRole('option',{name:'Synthetic Provider Group',exact:true}).waitFor({state:'attached'});
  await groupPanel.getByLabel('اسم القناة',{exact:true}).fill('Synthetic Channel');
  await groupPanel.getByRole('button',{name:'إنشاء قناة معطلة',exact:true}).click();
  await groupPanel.getByRole('heading',{name:'Synthetic Channel',exact:false}).waitFor();
  for(const [i,serverId] of [id,'55555555-5555-4555-8555-555555555555'].entries()) {
    await groupPanel.getByLabel('معرّف السيرفر المرشح',{exact:true}).fill(serverId);
    await groupPanel.getByLabel('ترتيب المصدر (1 أساسي)',{exact:true}).fill(String(i+1));
    await groupPanel.getByRole('button',{name:'ربط مصدر معطل',exact:true}).click();
    await groupPanel.getByText(`${i===0?'primary':'secondary'} #${i+1}`,{exact:false}).waitFor();
  }
  await groupPanel.getByRole('button',{name:'رفع أولوية المصدر',exact:true}).nth(1).click();
  await groupPanel.getByText('primary #1 · 55555555-5555-4555-8555-555555555555',{exact:false}).waitFor();
  assert.equal(orderChanges,1);
  page.once('dialog',dialog=>dialog.dismiss());
  await groupPanel.getByRole('button',{name:'تفعيل القناة صراحةً',exact:true}).click();
  assert.equal(channels[0].enabled,false,'cancelled publication must never enable channel');
  for (const width of [390, 820, 1280]) {
    await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(100);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Admin overflows at${width}: ${await page.evaluate(() => document.documentElement.scrollWidth)}`);
  }
  assert.equal(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }).includes('isolated-browser-fixture-token')), false);
  await page.getByRole('button', { name: 'مسح الجلسة من الصفحة', exact: true }).click();
  await page.getByRole('button', { name: 'دخول', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS actual Admin browser: denied login, authorized UI fixture, confirmation cancellation/acceptance, sync success/history, forbidden failure retention, empty/retry,390/820/1280layout, memory-only session clearing');
} catch (error) { console.error(`::error::${String(error.message).replaceAll('\n', ' ')}`); throw error; } finally { await browser.close(); }
