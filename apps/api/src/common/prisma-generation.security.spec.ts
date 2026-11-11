import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

describe('production Prisma generation gate', () => {
  const temp = mkdtempSync(join(tmpdir(), 'prisma-gate-test-'));
  const preload = join(temp, 'preload.cjs');
  const script = resolve(__dirname, '../../scripts/generate-client.cjs');

  beforeAll(() => {
    // Simulate only the subprocess outcome; do not download engines or reach a database.
    writeFileSync(preload, `require('node:child_process').execFileSync = () => {
      if (process.env.TEST_GENERATE_FAILURE) {
        const error = new Error('test failure');
        error.stderr = process.env.TEST_GENERATE_FAILURE;
        throw error;
      }
      return Buffer.from('generated');
    };`);
  });
  afterAll(() => rmSync(temp, { recursive: true, force: true }));

  function run(failure: string) {
    return spawnSync(process.execPath, ['--require', preload, script], {
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '', PRISMA_REQUIRE_NATIVE: '1', TEST_GENERATE_FAILURE: failure },
    });
  }

  it('fails rather than generating types only when the engine host is unreachable', () => {
    const result = run('binaries.prisma.sh ECONNRESET');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Native Prisma generation required');
    expect(result.stdout).not.toContain('offline types written');
  });

  it('does not mask non-network generation errors', () => {
    const result = run('invalid schema');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('non-network reason');
  });

  it('accepts a successful native generator subprocess', () => {
    expect(run('').status).toBe(0);
  });
});
