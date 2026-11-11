// Fail-closed local lifecycle. No cloud credentials or remote Docker accepted.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, chmodSync, openSync, closeSync, readSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectName, releaseName, localDocker, archivePath, parseEnvironment, redactDiagnostic } from './policy.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [action, projectArg, releaseArg, archiveArg] = process.argv.slice(2);
const docker = (args, options = {}) => execFileSync('docker', ['--context','default',...args], { cwd: root, maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], ...options });
const archiveDescriptors=[];
const openArchive=file=>{const fd=openSync(file,'r');archiveDescriptors.push(fd);return fd;};
const toFile=(file,args)=>{const fd=openSync(file,'wx',0o600);try{docker(args,{stdio:['pipe',fd,'pipe']});}finally{closeSync(fd);}};
const sha = file => { const fd=openSync(file,'r'), hash=createHash('sha256'), buffer=Buffer.alloc(1024*1024);try{let n;while((n=readSync(fd,buffer,0,buffer.length,null)))hash.update(buffer.subarray(0,n));return hash.digest('hex');}finally{closeSync(fd);} };
let diagnosticSecrets={...process.env}, lastStep='preflight';
const writers = ['web','admin','worker-media','api','auth-gateway','auth'];
try {
  const project = projectName(projectArg), release = releaseName(releaseArg);
  localDocker(process.env, JSON.parse(docker(['context','inspect','default']).toString())[0]?.Endpoints?.docker?.Host);
  if (!existsSync(path.join(root, '.env'))) throw new Error('Run setup-local-env.js and configure local Supabase first');
  // Reject any supplied database URI which is not this Compose service.
  const envText = readFileSync(path.join(root, '.env'), 'utf8');
  const localEnv = parseEnvironment(envText);
  diagnosticSecrets={...diagnosticSecrets,...localEnv};
  const database = localEnv.DATABASE_URL;
  if (new URL(database).hostname !== 'postgres') throw new Error('Only the local postgres service is authorized');
  const compose = args => { lastStep=args[0]+':'+args.filter(v=>['api','worker-media','web','admin','tools','postgres','redis','minio','minio-init','bootstrap','migrate','demo-import'].includes(v)).join(','); console.log('Local lifecycle step: '+lastStep); return docker(['compose','--project-name',project,'--env-file','.env',
    '-f','infra/docker/compose.yml','-f','infra/docker/compose.local.yml','-f','infra/docker/compose.selfhost.yml', ...args],
    { env: { ...process.env, ...localEnv, SELFHOST_RELEASE: release } }); };
  const cid = service => compose(['ps','-a','-q',service]).toString().trim();
  const volume = service => {
    const id = cid(service); if (!id) throw new Error('Required local service absent');
    const details = JSON.parse(docker(['inspect',id]))[0];
    if (details.Config.Labels['com.docker.compose.project'] !== project) throw new Error('Project ownership mismatch');
    return id;
  };
  if (['install','upgrade'].includes(action) && execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim()!==release) throw new Error('Build release must equal checked-out source HEAD');
  if (action === 'install') {
    if (compose(['ps','-a','-q']).toString().trim()) throw new Error('Install requires a new project; use upgrade for existing installs');
    if (docker(['volume','ls','-q','--filter',`label=com.docker.compose.project=${project}`]).toString().trim()) throw new Error('Existing volumes: refusing install');
    compose(['build','api','worker-media','web','admin','tools','minio']);
    compose(['up','-d','--wait','postgres','redis','minio','minio-init']);
    compose(['run','--rm','--no-deps','tools','migrate']);
    // Operator credentials are passed through environment, never command-line values.
    compose(['run','--rm','--no-deps','-e','BOOTSTRAP_ADMIN_EMAIL','-e','BOOTSTRAP_ADMIN_PASSWORD','tools','bootstrap']);
    compose(['up','-d','--wait','api','worker-media','web','admin','mailpit','auth','auth-gateway']);
  } else if (action === 'demo-import') {
    if(existsSync(path.join(root,'.selfhost/demo')))throw new Error('Demo output already exists; refusing duplicate import');
    mkdirSync(path.join(root,'.selfhost/demo'),{mode:0o700});
    // Tools run as node; output dir ownership is assigned explicitly by the operator.
    compose(['run','--rm','--no-deps','--user',`${process.getuid()}:${process.getgid()}`,'-v',`${path.join(root,'.cache/media-fixtures')}:/synthetic:ro`,'-v',`${path.join(root,'.selfhost/demo')}:/demo-output`,'tools','demo-import']);
  } else if (action === 'organization-license') {
    compose(['run','--rm','--no-deps',...['ORGANIZATION_TENANT_ID','ORGANIZATION_TIER','ORGANIZATION_STATUS','ORGANIZATION_EXPIRES_AT'].flatMap(k=>['-e',k]),'tools','organization-license']);
  } else if (action === 'migrate') {
    compose(['run','--rm','--no-deps','tools','migrate']);
  } else if (action === 'health') {
    for (const service of ['postgres','redis','minio','api','worker-media','web','admin','auth','auth-gateway','mailpit']) {
      const data = JSON.parse(docker(['inspect',volume(service)]))[0];
      if (!data.State.Running || (data.State.Health && data.State.Health.Status !== 'healthy')) throw new Error(`Service not healthy: ${service}`);
    }
    compose(['exec','-T','api','node','-e',"Promise.all(['http://127.0.0.1:3000/health','https://auth-gateway/auth/v1/health'].map(u=>fetch(u,{signal:AbortSignal.timeout(5000)}).then(r=>{if(!r.ok)throw new Error()}))).catch(()=>process.exit(1))"]);
  } else if (action === 'backup') {
    const dir = archivePath(archiveArg);
    if (existsSync(dir)) throw new Error('Archive directory must be new');
    const pg = volume('postgres'), storage = volume('minio');
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    compose(['stop', ...writers]);
    compose(['stop','minio']);
    // Leave writers stopped on any failure; never auto-resume an incomplete backup.
    toFile(path.join(dir,'database.dump'), ['exec',pg,'sh','-ec','pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc']);
    toFile(path.join(dir,'objects.tar'), ['run','--rm','--volumes-from',`${storage}:ro`,'postgres:17','tar','-C','/data','-cf','-','.']);
    mkdirSync(path.join(dir,'tls'),{mode:0o700});
    for(const name of ['cert.pem','key.pem']){copyFileSync(path.join(root,'.selfhost/tls',name),path.join(dir,'tls',name));chmodSync(path.join(dir,'tls',name),0o600);}
    copyFileSync(path.join(root,'.env'), path.join(dir,'installation.env')); chmodSync(path.join(dir,'installation.env'),0o600);
    writeFileSync(path.join(dir,'manifest.json'), JSON.stringify({ version:1, project, release, postgresMajor:17, auth:'local-gotrue-schema-in-database', files:Object.fromEntries(['database.dump','objects.tar','installation.env','tls/cert.pem','tls/key.pem'].map(f=>[f,sha(path.join(dir,f))])) },null,2),{mode:0o600});
    compose(['up','-d','--wait','--no-build','--pull','never','minio','api','worker-media','web','admin','mailpit','auth','auth-gateway']);
  } else if (action === 'restore') {
    const dir = archivePath(archiveArg), manifest = JSON.parse(readFileSync(path.join(dir,'manifest.json')));
    if (manifest.version !== 1 || manifest.release !== release || manifest.project === project) throw new Error('Restore requires same release and a different empty project');
    for (const file of ['database.dump','objects.tar','installation.env','tls/cert.pem','tls/key.pem']) if (sha(path.join(dir,file)) !== manifest.files[file]) throw new Error('Archive checksum mismatch');
    if (compose(['ps','-a','-q']).toString().trim() || docker(['volume','ls','-q','--filter',`label=com.docker.compose.project=${project}`]).toString().trim()) throw new Error('Restore target must have no containers or volumes');
    // .env is intentionally never replaced. Operator must recover matching secrets
    // securely before starting services; mismatches fail here, before resource creation.
    if (sha(path.join(root,'.env')) !== manifest.files['installation.env'] || ['cert.pem','key.pem'].some(name=>sha(path.join(root,'.selfhost/tls',name))!==manifest.files[`tls/${name}`])) throw new Error('Restore requires matching installation secrets; .env left unchanged');
    for(const service of ['api','worker','web','admin','tools','storage']) { const label=docker(['image','inspect','--format','{{index .Config.Labels "org.opencontainers.image.revision"}}',`cloudplay-selfhost-${service}:${release}`]).toString().trim(); if(label!==release)throw new Error('Exact retained image revision required for restore'); }
    compose(['up','-d','--wait','--no-build','--pull','never','postgres','redis','minio']);
    compose(['stop','minio']);
    docker(['exec','-i',volume('postgres'),'sh','-ec','pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error'],{stdio:[openArchive(path.join(dir,'database.dump')),'pipe','pipe']});
    docker(['run','--rm','-i','--volumes-from',volume('minio'),'postgres:17','tar','-C','/data','-xf','-'],{stdio:[openArchive(path.join(dir,'objects.tar')),'pipe','pipe']});
    compose(['up','-d','--wait','--no-build','--pull','never','minio','api','worker-media','web','admin','mailpit','auth','auth-gateway']);
  } else if (action === 'upgrade') {
    // Require a verified pre-upgrade backup; schema down-migrations are never run.
    const dir = archivePath(archiveArg), manifest = JSON.parse(readFileSync(path.join(dir,'manifest.json')));
    if (manifest.project !== project || manifest.release === release) throw new Error('A previous-release backup of this project is required');
    for (const f of ['database.dump','objects.tar','installation.env','tls/cert.pem','tls/key.pem']) if (sha(path.join(dir,f)) !== manifest.files[f]) throw new Error('Backup corrupted');
    compose(['build','api','worker-media','web','admin','tools','minio']);
    compose(['stop',...writers]);
    compose(['run','--rm','--no-deps','tools','migrate']);
    compose(['up','-d','--wait','api','worker-media','web','admin','mailpit','auth','auth-gateway']);
  } else if (action === 'rollback') {
    throw new Error('Safe rollback is restore into a different empty project at the archive release; in-place schema downgrade is forbidden. Use restore.');
  } else throw new Error('Usage: cli.mjs install|migrate|health|backup|restore|upgrade|rollback cloudplay-local-NAME EXACT_SHA [NEW_ARCHIVE_DIR]');
  console.log(`PASS local ${action}; no cloud or production operation performed`);
} catch (error) {
  // Child-process errors can carry secrets/DB dumps; never echo their payload.
  const detail=redactDiagnostic(error?.status !== undefined ? String(error.stderr||'')+' '+String(error.stdout||'') : error.message,diagnosticSecrets);
  console.error('::error title=Local selfhost lifecycle::step='+lastStep+' '+detail.replaceAll('%','%25'));
  console.error('Local operation failed; writers may be stopped. No secret values exported.');
  process.exitCode = 1;
} finally { for (const fd of archiveDescriptors) closeSync(fd); }

