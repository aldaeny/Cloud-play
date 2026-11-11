// Publish bounded classifications for fixture-tooling failures when hosted raw
// logs cannot be downloaded. Never publish arbitrary error/env/URL fragments.
import {spawnSync} from 'node:child_process';
const label=process.argv[2];
if(!['browser_install','ffmpeg_install','media_generate'].includes(label))throw new Error('FIXTURE_TOOL_LABEL_INVALID');
const [command,...args]=process.argv.slice(3);
const result=spawnSync(command,args,{encoding:'utf8',maxBuffer:32*1024*1024,timeout:600000});
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
const output=(result.stdout||'')+'\n'+(result.stderr||'');
if(result.status!==0){
 const patterns={reset:/ECONNRESET/,refused:/ECONNREFUSED/,download_progress:/RangeError|Invalid count value/i,child_pipe:/EPIPE/,http_400:/\b400\b/,http_401:/\b401\b/,http_408:/\b408\b/,timeout:/timed?\s*out|ETIMEDOUT/i,dns:/ENOTFOUND|EAI_AGAIN|could not resolve/i,http_403:/\b403\b/,http_404:/\b404\b/,http_429:/\b429\b/,http_5xx:/\b50[0234]\b/,disk:/no space left|ENOSPC/i,permission:/permission denied|EACCES/i,apt_lock:/could not get lock/i,package_unavailable:/unable to locate package|no installation candidate/i,download:/download fail|failed to download/i,certificate:/certificate|SSL|TLS/i,ffmpeg_filter:/Error reinitializing filters|Failed to configure output pad/i};
 console.log('::error title=Isolated fixture tooling::'+JSON.stringify({stage:label,status:result.status,signal:result.signal,error_code:result.error?.code||null,classifications:Object.entries(patterns).filter(([,re])=>re.test(output)).map(([k])=>k)}));
 if(label==='browser_install'){
  // Installer diagnostics only; no application/production command output.
  const excerpt=output.slice(-3500).replace(/\x1b\[[0-9;]*m/g,'').replace(/https?:\/\/[^\s)]+/g,value=>{try{return '[host:'+new URL(value).hostname+']';}catch{return '[url]';}}).replace(/[A-Za-z0-9_+\/=-]{100,}/g,'[long-value]');
  console.log('::notice title=Browser installer diagnostic::'+JSON.stringify(excerpt));
 }
 process.exit(result.status||1);
}
console.log('::notice title=Isolated fixture tooling::'+label+' PASS');
