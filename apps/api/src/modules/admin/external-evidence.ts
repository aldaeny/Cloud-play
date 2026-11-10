import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
const run = promisify(execFile);
export function validateEvidence(bytes: Buffer, mime: string) {
  if (!bytes.length || bytes.length > 49152 || bytes.subarray(0,2).toString()==='MZ' || bytes.subarray(0,4).toString('hex')==='7f454c46' || bytes.subarray(0,2).toString()==='#!' || bytes.subarray(0,4).toString('hex')==='504b0304') throw new BadRequestException('DANGEROUS_OR_OVERSIZE_DOCUMENT');
  if (mime==='application/pdf') {
    const text=bytes.toString('latin1');
    if (!text.startsWith('%PDF-') || !text.trimEnd().endsWith('%%EOF') || /\/(?:JavaScript|JS|Launch|OpenAction|EmbeddedFile|RichMedia|AA|URI)\b/i.test(text)) throw new BadRequestException('UNSAFE_OR_INVALID_PDF');
  } else if(mime==='image/png') {
    if(bytes.length<45 || bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a' || bytes.subarray(12,16).toString()!=='IHDR' || bytes.subarray(-8,-4).toString()!=='IEND' || bytes.readUInt32BE(16)>10000 || bytes.readUInt32BE(20)>10000) throw new BadRequestException('INVALID_PNG');
  } else if(mime==='image/jpeg') {
    if(bytes.length<4 || bytes.subarray(0,3).toString('hex')!=='ffd8ff' || bytes.subarray(-2).toString('hex')!=='ffd9') throw new BadRequestException('INVALID_JPEG');
  } else if(['text/plain','message/rfc822'].includes(mime)) {
    let text:string;
    try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new BadRequestException('INVALID_TEXT');}
    if([...text].some(char=>char.charCodeAt(0)<32 && !['\n','\r','\t'].includes(char)) || /<(?:script|html|svg)\b|^\s*(?:powershell|@echo|<\?php)/i.test(text)) throw new BadRequestException('EXECUTABLE_TEXT_DENIED');
    if(mime==='message/rfc822' && !/^(From|Subject|Date):/im.test(text)) throw new BadRequestException('INVALID_EMAIL_DOCUMENT');
  } else throw new BadRequestException('UNSUPPORTED_DOCUMENT_MIME');
}
/** clamscan-compatible operator-installed scanner. No scanner/error => quarantine,
 * never CLEAN. Fixed arguments, no shell, no inherited credentials, bounded time/output. */
export async function scanEvidence(bytes: Buffer): Promise<'clean'|'infected'|'quarantine'> {
  const binary=process.env.EXTERNAL_DOCUMENT_SCANNER_PATH;
  if(!binary || !isAbsolute(binary))return 'quarantine';
  const dir=await mkdtemp(join(tmpdir(),'external-evidence-'));
  try{
    const file=join(dir,'evidence');await writeFile(file,bytes,{mode:0o600});
    await run(binary,['--no-summary',file],{timeout:5000,maxBuffer:4096,env:{PATH:'/usr/bin:/bin'},killSignal:'SIGKILL'});return 'clean';
  }catch(error){return (error as {code?:number}).code===1?'infected':'quarantine';}
  finally{await rm(dir,{recursive:true,force:true});}
}
