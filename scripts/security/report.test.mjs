import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const script=path.resolve('scripts/security/summarize.mjs');
test('inventory prioritizes critical and fixable findings without suppressing other findings',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'security-report-'));
 try{
  mkdirSync(path.join(dir,'security-evidence'));
  for(const service of ['storage','api']){
   writeFileSync(path.join(dir,`security-evidence/${service}-image-id.txt`),'sha256:fixture');
   writeFileSync(path.join(dir,`security-evidence/${service}-vulnerabilities.json`),JSON.stringify({Metadata:{OS:{Family:'fixture'}},Results:[{Target:'binary',Type:'gobinary',Vulnerabilities:[{VulnerabilityID:'low',PkgName:'test|pkg',Severity:'LOW'},{VulnerabilityID:'critical-unfixed',PkgName:'lib',Severity:'CRITICAL'},{VulnerabilityID:'critical-fixed',PkgName:'lib',Severity:'CRITICAL',FixedVersion:'2.0'},{VulnerabilityID:'high',PkgName:'lib',Severity:'HIGH'}]}]}));
  }
  const output=execFileSync(process.execPath,[script],{cwd:dir,encoding:'utf8'});
  const plan=JSON.parse(readFileSync(path.join(dir,'security-evidence/remediation-plan.json')));
  assert.equal(plan.releaseClearance,false);
  assert.deepEqual(plan.services.storage.findings.map(v=>v.id),['critical-fixed','critical-unfixed','high','low']);
  assert.equal(plan.services.storage.findings[1].fixed,null);
  assert.equal(plan.services.storage.findings[0].ecosystem,'gobinary');
  assert.equal(plan.services.api.counts.CRITICAL,2);
  assert.match(output,/critical-fixed/);
  assert.match(readFileSync(path.join(dir,'security-evidence/VULNERABILITY_REPORT.md'),'utf8'),/test\/pkg/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
