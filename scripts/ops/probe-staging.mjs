import {readFileSync} from 'node:fs';
import {validatePlan} from './validate-launch-plan.mjs';
const plan=JSON.parse(readFileSync(process.argv[2]||'ops/launch-plan.json','utf8'));
const check=validatePlan(plan);
if(!process.argv.includes('--execute')||check.status!=='PASS'||plan.executionApproved!==true||plan.budget.approved!==true||!plan.staging.apiOrigin){console.log(JSON.stringify({status:'BLOCKED',reason:'approved isolated plan and --execute required',networkAccessed:false}));process.exitCode=2;}
else{
 let status='FAIL',latencyMs;const start=performance.now();
 try{
  const r=await fetch(new URL('/health',plan.staging.apiOrigin),{redirect:'error',signal:AbortSignal.timeout(plan.monitoring.timeoutMs),headers:{accept:'application/json'}});
  const reader=r.body?.getReader();if(!reader)throw Error();let bytes=0,text='';const decoder=new TextDecoder();
  try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>16384)throw Error();text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel();}
  const body=JSON.parse(text);
  if(r.status===200&&body.status==='healthy'&&body.database==='connected')status='PASS';
 }catch{/* Fixed result only, no URL, headers or upstream body exported. */}
 latencyMs=Math.round(performance.now()-start);
 console.log(JSON.stringify({status,scope:'one staging API health observation, not Auth/Geo/production acceptance',latencyMs,observedAt:new Date().toISOString()}));
 if(status!=='PASS')process.exitCode=1;
}
