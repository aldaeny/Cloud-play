import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir=mkdtempSync(path.join(tmpdir(),'cloudplay-brand-'));
try {
  execFileSync(process.execPath,['node_modules/typescript/bin/tsc','apps/web/src/lib/site-branding.ts','--module','commonjs','--target','es2022','--skipLibCheck','--outDir',dir]);
  const {parseBranding}=createRequire(import.meta.url)(path.join(dir,'site-branding.js'));
  const good={displayName:'Synthetic organization',logoUrl:'/brand-assets/local.png',brandDark:'#001122',brandCard:'#111111',cyanGlow:'#123456',magentaGlow:'#abcdef',violetGlow:'#123456',amberGlow:'#123456'};
  assert.deepEqual(parseBranding({...good,tenantId:'must-not-leak',secret:'must-not-leak'}),good);
  for(const patch of [{displayName:''},{logoUrl:'https://tracker.invalid/logo.svg'},{logoUrl:'data:image/svg+xml,x'},{brandDark:'red;display:none'},{cyanGlow:'var(--x)'},{brandCard:undefined}])assert.equal(parseBranding({...good,...patch}),null);
  assert.equal(parseBranding(null),null);
  console.log('PASS viewer branding allowlist, local raster-only logo, safe colors and secret-field stripping');
} finally {rmSync(dir,{recursive:true,force:true});}
