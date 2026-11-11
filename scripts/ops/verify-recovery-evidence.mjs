import {validatePlan} from './validate-launch-plan.mjs';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
/** Validates collected observations; does NOT execute or certify a managed restore. */
export function verifyRecovery(plan,e){
 const fail=code=>{throw new Error(code);};
 if(validatePlan(plan).status!=='PASS')fail('DR_NOT_AUTHORIZED');
 if(!e.sourceProjectRef||!e.restoreProjectRef||e.sourceProjectRef===e.restoreProjectRef||e.sourceProjectRef!==plan.staging.supabaseProjectRef||e.restoreProjectRef!==plan.restore.supabaseProjectRef||(plan.productionProjectRefs||[]).some(r=>[e.sourceProjectRef,e.restoreProjectRef].includes(r)))fail('DR_TARGET_MISMATCH');
 const time=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T.*Z$/.test(v)||!Number.isFinite(Date.parse(v)))fail('UTC_TIMESTAMP_REQUIRED');return Date.parse(v);};
 const incident=time(e.incidentAt),marker=time(e.newestRestoredCommitAt),ready=time(e.verifiedServiceReadyAt),point=time(e.restorePointAt);
 if(marker>point||point>incident||ready<incident)fail('IMPOSSIBLE_RECOVERY_TIMELINE');
 if([e.beforePointMarkerPresent,e.afterPointMarkerAbsent,e.rlsOwnerTenantDenialVerified,e.authVerified,e.playbackVerified,e.rollbackVerified,e.alertDeliveryVerified].some(v=>v!==true))fail('RECOVERY_CHECKS_INCOMPLETE');
 if(!Array.isArray(e.objects)||!e.objects.length)fail('STORAGE_EVIDENCE_REQUIRED');
 for(const o of e.objects)if(!/^[a-f0-9]{64}$/.test(o.sourceSha256)||o.sourceSha256!==o.restoredSha256||!Number.isSafeInteger(o.sourceBytes)||o.sourceBytes<=0||o.sourceBytes!==o.restoredBytes||o.metadataMatch!==true||o.aclDenialVerified!==true)fail('STORAGE_RESTORE_MISMATCH');
 if(!Array.isArray(e.evidenceReferences)||e.evidenceReferences.length<3||e.evidenceReferences.some(x=>typeof x!=='string'||!x.trim()))fail('REVIEWABLE_EVIDENCE_REQUIRED');
 const rpo=(incident-marker)/1000,rto=(ready-incident)/1000;
 if(rpo>plan.recovery.rpoTargetSeconds||rto>plan.recovery.rtoTargetSeconds)fail('RECOVERY_OBJECTIVE_MISSED');
 return {status:'PASS',scope:'operator evidence consistency only; observations/references must be independently reviewed',rpoSeconds:rpo,rtoSeconds:rto};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const result=verifyRecovery(JSON.parse(readFileSync(process.argv[2],'utf8')),JSON.parse(readFileSync(process.argv[3],'utf8')));console.log(JSON.stringify(result,null,2));}catch{console.error('RECOVERY_EVIDENCE_REJECTED');process.exitCode=1;}}
