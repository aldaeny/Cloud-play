import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectName, releaseName, localDocker, archivePath } from './policy.mjs';
test('projects cannot select production/default names or inject flags', () => {
  for (const value of ['production','cloudplay','--project','cloudplay-local-../prod','cloudplay-local-X','']) assert.throws(()=>projectName(value));
  assert.equal(projectName('cloudplay-local-fixture'),'cloudplay-local-fixture');
});
test('release must be an exact immutable SHA, never latest or a flag', () => {
  for (const value of ['latest','main','997fcd1','--pull','']) assert.throws(()=>releaseName(value));
  assert.equal(releaseName('a'.repeat(40)),'a'.repeat(40));
});
test('remote Docker and overridden contexts are denied', () => {
  assert.doesNotThrow(()=>localDocker({},'unix:///var/run/docker.sock'));
  for (const env of [{DOCKER_HOST:'ssh://host'},{DOCKER_CONTEXT:'production'}]) assert.throws(()=>localDocker(env,'unix:///var/run/docker.sock'));
  for(const value of ['tcp://127.0.0.1:2375','ssh://host','npipe://host','']) assert.throws(()=>localDocker({},value));
});
test('archive path must be explicit and not the filesystem root', () => {
  assert.throws(()=>archivePath('')); assert.throws(()=>archivePath('/'));
  assert.match(archivePath('.selfhost-backup/one'), /one$/);
});
