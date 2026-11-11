import {readFileSync,writeFileSync} from 'node:fs';
const lines=['# Runtime image vulnerability inventory','','Scanner: Trivy 0.76.2, checksum-pinned. All severities retained. No ignore-unfixed, ignorefile or severity suppression. A completed inventory is NOT a vulnerability clearance. Findings require triage before release.',''];
const totals={};
for(const name of ['storage','api']){
 const report=JSON.parse(readFileSync(`security-evidence/${name}-vulnerabilities.json`));
 const counts={UNKNOWN:0,LOW:0,MEDIUM:0,HIGH:0,CRITICAL:0};
 const findings=(report.Results||[]).flatMap(r=>(r.Vulnerabilities||[]).map(v=>({...v,target:r.Target})));
 for(const v of findings)counts[v.Severity]=(counts[v.Severity]||0)+1;
 totals[name]=counts;
 lines.push(`## ${name}`,`Image: ${readFileSync(`security-evidence/${name}-image-id.txt`,'utf8').trim()}`,`Counts: ${JSON.stringify(counts)}`,'','| Advisory | Package | Installed | Fixed | Severity | Action |','|---|---|---|---|---|---|');
 const clean=x=>String(x||'').replaceAll('|','/').replace(/[\r\n]/g,' ');
 for(const v of findings)lines.push(`| ${[v.VulnerabilityID,v.PkgName,v.InstalledVersion,v.FixedVersion||'not published',v.Severity,v.FixedVersion?'Rebuild with patched dependency/base; rerun lifecycle':'Track upstream; isolate exposure; replacement/legal review'].map(clean).join(' | ')} |`);
 if(!findings.length)lines.push('No findings reported by this database; coverage limitations still apply.');
}
writeFileSync('security-evidence/VULNERABILITY_REPORT.md',lines.join('\n')+'\n');
console.log('::notice title=Runtime vulnerability inventory::'+JSON.stringify({counts:totals,releaseClearance:false,details:'security-evidence artifact; includes OS and detected Go modules; all findings retained'}));
