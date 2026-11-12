import {readFileSync,writeFileSync} from 'node:fs';
const lines=['# Runtime image vulnerability inventory','','Scanner: Trivy 0.76.2, checksum-pinned. All severities retained. No ignore-unfixed, ignorefile or severity suppression. A completed inventory is NOT a vulnerability clearance. Findings require triage before release.',''];
const totals={},plan={releaseClearance:false,services:{}};
const rank={CRITICAL:0,HIGH:1,MEDIUM:2,LOW:3,UNKNOWN:4};
const services=process.argv.slice(2);
for(const name of (services.length?services:['storage','api'])){
 if(!/^[a-z][a-z-]{0,30}$/.test(name))throw new Error('INVALID_IMAGE_REPORT_NAME');
 const report=JSON.parse(readFileSync(`security-evidence/${name}-vulnerabilities.json`));
 const counts={UNKNOWN:0,LOW:0,MEDIUM:0,HIGH:0,CRITICAL:0};
 const findings=(report.Results||[]).flatMap(r=>(r.Vulnerabilities||[]).map(v=>({...v,target:r.Target,ecosystem:r.Type})));
 findings.sort((a,b)=>(rank[a.Severity]??5)-(rank[b.Severity]??5)||Number(!!b.FixedVersion)-Number(!!a.FixedVersion)||String(a.VulnerabilityID).localeCompare(String(b.VulnerabilityID)));
 for(const v of findings)counts[v.Severity]=(counts[v.Severity]||0)+1;
 totals[name]=counts;
 plan.services[name]={os:report.Metadata?.OS||null,scannedAt:report.CreatedAt||null,counts,findings:findings.map(v=>({id:v.VulnerabilityID,package:v.PkgName,installed:v.InstalledVersion,fixed:v.FixedVersion||null,severity:v.Severity,target:v.target,ecosystem:v.ecosystem||null,url:v.PrimaryURL||null,action:v.FixedVersion?'Patch to a listed fixed version and rerun full lifecycle':'No scanner-listed fix: upstream triage or compatible replacement; not waived'}))};
 const urgent=findings.filter(v=>['HIGH','CRITICAL'].includes(v.Severity));
 if(urgent.length)console.log('::warning title='+name+' unresolved HIGH CRITICAL sample::'+JSON.stringify({total:urgent.length,sample:urgent.slice(0,5).map(v=>({id:v.VulnerabilityID,pkg:v.PkgName,installed:v.InstalledVersion,fixed:v.FixedVersion||'unfixed'})),completeReport:'security-evidence/VULNERABILITY_REPORT.md; no findings suppressed'}).replaceAll('%','%25'));

 lines.push(`## ${name}`,`Image: ${readFileSync(`security-evidence/${name}-image-id.txt`,'utf8').trim()}`,`Counts: ${JSON.stringify(counts)}`,'','| Advisory | Package | Installed | Fixed | Severity | Action |','|---|---|---|---|---|---|');
 const clean=x=>String(x||'').replaceAll('|','/').replace(/[\r\n]/g,' ');
 for(const v of findings)lines.push(`| ${[v.VulnerabilityID,v.PkgName,v.InstalledVersion,v.FixedVersion||'not published',v.Severity,v.FixedVersion?'Rebuild with patched dependency/base; rerun lifecycle':'Track upstream; isolate exposure; replacement/legal review'].map(clean).join(' | ')} |`);
 if(!findings.length)lines.push('No findings reported by this database; coverage limitations still apply.');
}
writeFileSync('security-evidence/remediation-plan.json',JSON.stringify(plan,null,2)+'\n');
writeFileSync('security-evidence/VULNERABILITY_REPORT.md',lines.join('\n')+'\n');
console.log('::notice title=Runtime vulnerability inventory::'+JSON.stringify({counts:totals,releaseClearance:false,details:'security-evidence artifact; includes OS and detected Go modules; all findings retained'}));
