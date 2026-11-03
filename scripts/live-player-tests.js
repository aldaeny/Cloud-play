/**
 * Tests for the in-page player logic.
 * Run: node scripts/live-player-tests.js
 */
const assert = require('assert');
const path = require('path');
const { loadTs } = require('./lib/load-ts');

const ROOT = path.resolve(__dirname, '..');
const logic = loadTs(path.join(ROOT, 'apps/web/src/components/player/player-logic.ts'));

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

const P = logic.DEFAULT_RETRY_POLICY;

/* ------------------------------------------------------------------ retries */

test('manifest failures retry up to the budget, then go fatal', () => {
  let state = logic.INITIAL_RETRY_STATE;
  const seen = [];
  for (let index = 0; index < 5; index += 1) {
    const outcome = logic.classifyFailure('manifest', state);
    state = outcome.next;
    seen.push(`${outcome.retry ? 'retry' : 'fatal'}:${outcome.error.attempts}`);
  }
  assert.deepEqual(seen, [`retry:1`, `retry:2`, `retry:3`, `fatal:4`, `fatal:5`]);
  assert.equal(state.manifest, 5);
});

test('segment failures retry within the budget', () => {
  let state = logic.INITIAL_RETRY_STATE;
  let retries = 0;
  for (let index = 0; index < 10; index += 1) {
    const outcome = logic.classifyFailure('segment', state);
    state = outcome.next;
    if (outcome.retry) retries += 1;
  }
  assert.equal(retries, P.segment, 'retry count must match the policy');
});

test('a successful fragment resets the consecutive-failure streak', () => {
  let state = logic.INITIAL_RETRY_STATE;
  for (let index = 0; index < 5; index += 1) state = logic.classifyFailure('segment', state).next;
  assert.equal(state.segmentStreak, 5);
  state = logic.noteSuccess(state);
  assert.equal(state.segmentStreak, 0);
  // The total budget is still spent, but the streak no longer blocks.
  assert.equal(state.segment, 5);
});

test('a flapping stream is abandoned once the streak budget is hit', () => {
  let state = logic.INITIAL_RETRY_STATE;
  let fatal = false;
  for (let index = 0; index < 12 && !fatal; index += 1) {
    const outcome = logic.classifyFailure('network', state);
    state = outcome.next;
    fatal = outcome.fatal;
  }
  assert.equal(fatal, true, 'the player must stop hammering a dead stream');
  assert.ok(state.segmentStreak <= P.segmentBudget + 1);
});

test('autoplay block is fatal but not retried', () => {
  const outcome = logic.classifyFailure('blocked', logic.INITIAL_RETRY_STATE);
  assert.equal(outcome.retry, false);
  assert.equal(outcome.fatal, true);
  assert.equal(outcome.error.code, 'AUTOPLAY_BLOCKED');
});

test('unsupported codec is fatal and not retried', () => {
  const outcome = logic.classifyFailure('unsupported', logic.INITIAL_RETRY_STATE);
  assert.equal(outcome.retry, false);
  assert.equal(outcome.error.code, 'UNSUPPORTED_STREAM');
});

test('timeout is treated as a manifest-class failure', () => {
  const outcome = logic.classifyFailure('timeout', logic.INITIAL_RETRY_STATE);
  assert.equal(outcome.retry, true);
  assert.equal(outcome.error.code, 'MANIFEST_TIMEOUT');
});

test('retry delays escalate and clamp at the last value', () => {
  assert.equal(logic.retryDelay(P, 1), P.delays[0]);
  assert.equal(logic.retryDelay(P, 2), P.delays[1]);
  assert.equal(logic.retryDelay(P, 99), P.delays[P.delays.length - 1]);
});

/* --------------------------------------------------------------------- seek */

test('seek clamps inside a finite duration', () => {
  assert.equal(logic.seekTarget(50, 120, 10), 60);
  assert.equal(logic.seekTarget(5, 120, -10), 0);
  assert.equal(logic.seekTarget(115, 120, 30), 119.5);
});

test('seek on a live stream never goes negative', () => {
  assert.equal(logic.seekTarget(2, Infinity, -10), 0);
  assert.equal(logic.seekTarget(30, NaN, 10), 40);
});

test('seek returns null for an unknown position', () => {
  assert.equal(logic.seekTarget(NaN, 100, 10), null);
});

/* ------------------------------------------------------------------ format */

test('formats times', () => {
  assert.equal(logic.formatTime(0), '00:00');
  assert.equal(logic.formatTime(65), '01:05');
  assert.equal(logic.formatTime(3725), '1:02:05');
  assert.equal(logic.formatTime(undefined), '--:--');
  assert.equal(logic.formatTime(10, true), 'LIVE');
});

test('formats bitrate', () => {
  assert.equal(logic.formatBitrate(2_200_000), '2.2 Mbps');
  assert.equal(logic.formatBitrate(800_000), '800 kbps');
  assert.equal(logic.formatBitrate(undefined), '');
  assert.equal(logic.formatBitrate(0), '');
});

test('level labels prefer height then bitrate', () => {
  assert.equal(logic.levelLabel(1080, 4_000_000, 0), '1080p');
  assert.equal(logic.levelLabel(0, 900_000, 0), '900 kbps');
  assert.equal(logic.levelLabel(undefined, undefined, 1), 'Level 2');
});

/* ----------------------------------------------------------------- keyboard */

test('keyboard map covers the player essentials', () => {
  assert.equal(logic.resolveKey(' '), 'togglePlay');
  assert.equal(logic.resolveKey('k'), 'togglePlay');
  assert.equal(logic.resolveKey('m'), 'mute');
  assert.equal(logic.resolveKey('f'), 'fullscreen');
  assert.equal(logic.resolveKey('ArrowRight'), 'seekForward');
  assert.equal(logic.resolveKey('ArrowLeft'), 'seekBack');
  assert.equal(logic.resolveKey('ArrowUp'), 'volumeUp');
  assert.equal(logic.resolveKey('Escape'), 'escape');
  assert.equal(logic.resolveKey('r'), 'retry');
  assert.equal(logic.resolveKey('z'), null);
});

test('volume clamp', () => {
  assert.equal(logic.clampVolume(1.7), 1);
  assert.equal(logic.clampVolume(-2), 0);
  assert.equal(logic.clampVolume(0.35), 0.35);
  assert.equal(logic.clampVolume(NaN), 1);
});

/* ------------------------------------------------------------ error mapping */

test('hls.js details map to our vocabulary', () => {
  assert.equal(logic.classifyHlsError({ details: 'manifestLoadError' }), 'manifest');
  assert.equal(logic.classifyHlsError({ details: 'fragLoadError' }), 'segment');
  assert.equal(logic.classifyHlsError({ details: 'bufferAppendError' }), 'segment');
  assert.equal(logic.classifyHlsError({ details: 'manifestLoadTimeOut' }), 'timeout');
  assert.equal(logic.classifyHlsError({ details: 'levelLoadError' }), 'network');
  assert.equal(logic.classifyHlsError({ details: 'manifestParsingError' }), 'manifest');
  assert.equal(logic.classifyHlsError({}), 'media');
});

test('native media errors map to our vocabulary', () => {
  assert.equal(logic.classifyMediaError(1), 'network');
  assert.equal(logic.classifyMediaError(2), 'network');
  assert.equal(logic.classifyMediaError(3), 'segment');
  assert.equal(logic.classifyMediaError(4), 'unsupported');
  assert.equal(logic.classifyMediaError(undefined), 'media');
});

/* -------------------------------------------------------------------- report */

const failed = results.filter((result) => !result.ok);
for (const result of results) {
  if (result.ok) console.log(`  ok   ${result.name}`);
  else console.log(`  FAIL ${result.name}\n         ${result.error}`);
}
console.log(`\n${results.length - failed.length}/${results.length} player logic tests passed`);
if (failed.length) {
  process.exitCode = 1;
  console.error(`${failed.length} FAILED`);
}
