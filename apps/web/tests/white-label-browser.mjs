// Real browser DOM, backend branding response fixture; no provider/device claim.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const base=process.env.BASE_URL||'http://127.0.0.1:3001';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const brand={displayName:'Synthetic Tenant Brand',logoUrl:null,brandDark:'#102030',brandCard:'#223344',cyanGlow:'#123456',magentaGlow:'#abcdef',violetGlow:'#fedcba',amberGlow:'#334455'};
try {
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/api/site-branding')return route.fulfill({json:brand});
    if(url.origin!==new URL(base).origin)return route.abort();
    return route.continue();
  });
  await page.addInitScript(()=>localStorage.setItem('cloudplay-reduce-motion','true'));
  for(const path of ['/','/login','/settings','/movies/bunny']) {
    await page.goto(base+path,{waitUntil:'networkidle'});
    await page.locator('.app-header-brand').filter({hasText:brand.displayName}).waitFor();
    await page.waitForFunction(name=>document.title.includes(name),brand.displayName);
    assert.equal(await page.locator('.site').first().evaluate(el=>el.style.getPropertyValue('--cyan')),brand.cyanGlow);
    assert.equal(await page.locator('link[rel=canonical]').count(),0,'custom site must not canonically point to the stock deployment');
  }
  assert.deepEqual(errors,[]);
  console.log('PASS actual viewer white label: home, login, settings, movie page, header, document title, color variables and canonical isolation (API fixture)');
} catch(error){console.error('::error title=Viewer branding browser::'+String(error.message).replaceAll('\n',' '));throw error;} finally {await browser.close();}
