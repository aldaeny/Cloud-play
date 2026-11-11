// Inspect actual build artifacts, not source assumptions. No network access.
import {readFile,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const source=await readFile('apps/web/src/server/public-tv.ts','utf8');
const privateAddresses=[...source.matchAll(/streamUrl:\s*'([^']+)'/g)].map(match=>match[1]);
assert.ok(privateAddresses.length>=30,'server-only curated directory parsed');
let checked=0,leaks=0;
async function scan(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await scan(file);else if(/\.js$/.test(file)){const text=await readFile(file,'utf8');checked++;if(privateAddresses.some(address=>text.includes(address)))leaks++;}}}
await scan('apps/web/.next/static');assert.ok(checked>0);assert.equal(leaks,0,'browser bundle contains a server-only upstream stream address');
console.log(`PASS protected media production assets: ${checked} JS files scanned, zero known upstream stream addresses.`);
