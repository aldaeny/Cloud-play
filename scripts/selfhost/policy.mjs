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
