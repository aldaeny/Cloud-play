// Download the actual lockfile-matched browser. Validate the real runner's
// requirements by launching it (Playwright's normal host checks remain enabled).
// A blanket install-deps fetches optional fonts even on an otherwise ready host.
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const run=(...args)=>execFileSync(process.execPath,['node_modules/playwright-core/cli.js',...args],{stdio:'inherit',timeout:480000});
if(process.env.GITHUB_ACTIONS!=='true')throw new Error('CI_BROWSER_INSTALL_REQUIRES_GITHUB_ACTIONS');
run('install','chromium'); // Never a mock, system-browser substitution or skip.
let browser;
try{browser=await chromium.launch({headless:true});}
catch(error){
 // Do not mask arbitrary launch/download/test failures with retries. Only a
 // diagnosed missing-library error authorizes installing host dependencies.
 if(!/Host system is missing dependencies|error while loading shared libraries|Missing libraries/i.test(String(error.message)))throw error;
 execFileSync('bash',['scripts/prepare-ci-browser-host.sh'],{stdio:'inherit'});
 run('install-deps','chromium');
 browser=await chromium.launch({headless:true});
}
try{
 const page=await browser.newPage();
 await page.setContent('<html dir="rtl"><body><p>اختبار Cloud Play</p></body></html>');
 assert.equal(await page.locator('p').textContent(),'اختبار Cloud Play');
 console.log('::notice title=Actual CI browser::'+JSON.stringify({status:'PASS',version:browser.version(),download:'lockfile Chromium',host_requirements:'normal Playwright launch validation enabled',dom:'real page'}));
}finally{await browser.close();}
