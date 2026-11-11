import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
/** Offline validator only. Never provisions, reads credentials or contacts a host. */
export function validatePlan(p){
 const blockers=[],errors=[];
 const requireGate=(ok,id)=>{if(!ok)blockers.push(id);};
 if(p.version!==1||p.environment!=='staging')errors.push('ISOLATED_STAGING_REQUIRED');
 const s=p.staging||{},r=p.restore||{};
 for(const ref of [s.supabaseProjectRef,r.supabaseProjectRef]){
  requireGate(typeof ref==='string'&&/^[a-z]{20}$/.test(ref),'ISOLATED_PROJECT_REF_REQUIRED');
  if(ref&&(p.productionProjectRefs||[]).includes(ref))errors.push('PRODUCTION_TARGET_FORBIDDEN');
 }
 if(s.supabaseProjectRef&&s.supabaseProjectRef===r.supabaseProjectRef)errors.push('INDEPENDENT_RESTORE_REQUIRED');
 for(const origin of [s.apiOrigin,s.webOrigin]){
  if(!origin){blockers.push('STAGING_ORIGIN_REQUIRED');continue;}
  try{const u=new URL(origin);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||['localhost','127.0.0.1','::1'].includes(u.hostname))throw Error();}catch{errors.push('HTTPS_ORIGIN_REQUIRED');}
 }
 requireGate(Boolean(s.storageBucket&&r.storageBucket&&r.region),'STORAGE_AND_RESTORE_REGION_REQUIRED');
 const a=p.api||{};
 const n=[a.replicas,a.cpuPerReplica,a.memoryMiBPerReplica,a.connectionLimitPerReplica,a.poolTimeoutSeconds,a.reservedAuthWorkerConnections,a.databaseConnectionBudget];
 if(n.some(x=>!Number.isSafeInteger(x)||x<1)||a.replicas<2||a.connectionLimitPerReplica>50||a.poolTimeoutSeconds>30)errors.push('RESOURCE_BUDGET_INVALID');
 if(a.replicas*a.connectionLimitPerReplica+a.reservedAuthWorkerConnections>a.databaseConnectionBudget)errors.push('POOL_BUDGET_EXCEEDED');
 if(!Number.isFinite(p.recovery?.rpoTargetSeconds)||p.recovery.rpoTargetSeconds<0||!Number.isFinite(p.recovery?.rtoTargetSeconds)||p.recovery.rtoTargetSeconds<=0)errors.push('RECOVERY_OBJECTIVES_INVALID');
 const b=p.budget||{},values=Object.values(b.monthlyAllowances||{});
 const total=values.reduce((sum,v)=>sum+v,0);
 if(!values.length||values.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0)||!Number.isFinite(b.proposedMonthlyCeiling)||total>b.proposedMonthlyCeiling||!(b.oneOffDrillCeiling>=0))errors.push('SPEND_BUDGET_INVALID');
 requireGate(p.executionApproved===true&&b.approved===true,'RESOURCE_AND_BUDGET_APPROVAL_REQUIRED');
 const sec=p.security||{},rec=p.recovery||{},mon=p.monitoring||{};
 if(!Array.isArray(sec.allowedCountries)||!sec.allowedCountries.length||sec.allowedCountries.some(c=>!/^[A-Z]{2}$/.test(c)))errors.push('COUNTRY_POLICY_INVALID');
 requireGate(sec.policyApproved===true&&sec.authIngressEnforcementVerified===true,'AUTH_INGRESS_APPROVAL_AND_PROOF_REQUIRED');
 requireGate(sec.ssoSessionAvailable===true,'SSO_SESSION_REQUIRED');
 requireGate(sec.rateLimitStore==='postgres','SHARED_QUOTA_REQUIRED');
 requireGate(rec.targetsApproved===true&&rec.pitrEntitlementVerified===true,'MANAGED_DR_APPROVAL_REQUIRED');
 requireGate(mon.alertDestinationConfigured===true&&mon.externalMonitorProvisioned===true,'INDEPENDENT_ALERTING_REQUIRED');
 return {status:errors.length?'FAIL':blockers.length?'BLOCKED':'PASS',scope:'offline launch-plan validation only; not infrastructure or production certification',errors,blockers:[...new Set(blockers)],estimatedMonthlyUsd:total,proposedCeilingUsd:b.proposedMonthlyCeiling};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const result=validatePlan(JSON.parse(readFileSync(process.argv[2]||'ops/launch-plan.json','utf8')));console.log(JSON.stringify(result,null,2));if(result.status!=='PASS')process.exitCode=2;}
