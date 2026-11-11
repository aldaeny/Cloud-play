import path from 'node:path';
export function projectName(value) {
  if (!/^cloudplay-local-[a-z0-9][a-z0-9-]{0,30}$/.test(value || '')) throw new Error('A dedicated cloudplay-local-* project is required');
  return value;
}
export function releaseName(value) {
  if (!/^[a-f0-9]{40}$/.test(value || '')) throw new Error('An exact 40-character Git release SHA is required');
  return value;
}
export function localDocker(env, endpoint) {
  if (env.DOCKER_HOST || env.DOCKER_CONTEXT || !/^unix:\/\/\//.test(endpoint || '')) throw new Error('Only the default local Unix Docker socket is authorized');
}
export function archivePath(value) {
  const absolute = path.resolve(value || '');
  if (!value || absolute === path.parse(absolute).root) throw new Error('Explicit non-root archive directory required');
  return absolute;
}
/** Strict generated .env subset: no interpolation, evaluation or host overrides. */
export function parseEnvironment(text) {
  const result={};
  for(const line of text.split(/\r?\n/)){
    if(!line.trim()||line.trimStart().startsWith('#'))continue;
    const match=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);if(!match)throw new Error('Unsupported environment syntax');
    const raw=match[2].trim();
    let value;
    if(raw.startsWith('"')){try{value=JSON.parse(raw);}catch{throw new Error('Invalid quoted environment value');}if(typeof value!=='string')throw new Error('Invalid environment value');}
    else if(raw.startsWith("'")){if(!raw.endsWith("'"))throw new Error('Invalid environment value');value=raw.slice(1,-1);}
    else value=raw.replace(/\s+#.*$/,'').trim();
    if(Object.hasOwn(result,match[1]))throw new Error('Duplicate environment key');
    result[match[1]]=value;
  }
  return result;
}
