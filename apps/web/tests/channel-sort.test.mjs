/**
 * Unit tests for the channel sorting engine and the persisted view preference.
 *
 *   npm run test:channels --workspace aether-web
 *
 * Sorting is pure, so it is tested without a browser. The fixtures below are
 * TEST DATA ONLY: they never reach the app, the API or the licensed catalog.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

/** Load a TS module in isolation, stubbing only its type-only/local imports. */
function loadModule(relative, stubs = {}) {
  const source = readFileSync(path.join(root, relative), 'utf8');
  const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  const require = name => {
    if (name in stubs) return stubs[name];
    throw new Error(`unexpected import: ${name}`);
  };
  new Function('exports', 'require', 'module', javascript)(mod.exports, require, mod);
  return mod.exports;
}

const countryStub = { countryLabel: (code, ar) => ({ IQ: ar ? 'العراق' : 'Iraq', EG: ar ? 'مصر' : 'Egypt', SA: ar ? 'السعودية' : 'Saudi Arabia' }[code] ?? code) };
const sorting = loadModule('src/lib/channel-sort.ts', { './iptv-country': countryStub });

let passed = 0; let failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`  PASS  ${name}`); }
  catch (error) { failed++; console.log(`  FAIL  ${name}\n        ${error.message}`); }
}

const channel = (id, name, extra = {}) => ({
  id, name, logo: '', streamUrl: `https://example.test/${id}.m3u8`, streamType: 'hls',
  category: 'general', sourceGroup: 'General', country: '', countryCode: '', language: '',
  quality: '', qualityLabel: '', isLive: true, playable: true, epgId: '', ...extra,
});

// Deliberately unsorted source order.
const source = [
  channel('c', 'قناة ثالثة', { countryCode: 'EG', quality: 'SD' }),
  channel('a', 'Alpha TV', { countryCode: 'SA', quality: 'FHD' }),
  channel('b', 'قناة أولى', { countryCode: 'IQ', quality: 'HD' }),
  channel('d', 'Zulu News', { quality: '4K' }),
  channel('e', 'Beta Sports', { countryCode: 'IQ', quality: '' }),
];

console.log('\nCloud Play channel sorting engine\n');

check('five sort modes are exposed with Arabic and English labels', () => {
  assert.deepEqual(sorting.CHANNEL_SORTS.map(item => item.key), ['default', 'az', 'country-group', 'quality-desc', 'favorites-first']);
  for (const item of sorting.CHANNEL_SORTS) { assert.ok(item.ar && item.en); }
  assert.equal(sorting.DEFAULT_CHANNEL_SORT, 'default');
});

check('default keeps the original playlist order and does not copy the array', () => {
  const result = sorting.applyChannelSort(source, 'default', ['d']);
  assert.deepEqual(result.map(item => item.id), ['c', 'a', 'b', 'd', 'e']);
  assert.equal(result, source);
});

check('alphabetical uses the viewer language and never mutates the source', () => {
  const snapshot = source.map(item => item.id);
  const english = sorting.applyChannelSort(source, 'az', [], 'en').map(item => item.name);
  const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
  assert.deepEqual(english, [...english].sort(collator.compare));
  assert.deepEqual(source.map(item => item.id), snapshot, 'source array was mutated');
});

check('country grouping orders by localized country name with undeclared last', () => {
  const arabic = sorting.applyChannelSort(source, 'country-group', [], 'ar');
  assert.equal(arabic[arabic.length - 1].id, 'd', 'channel without a country must be last');
  const countries = arabic.slice(0, -1).map(item => item.countryCode);
  const names = countries.map(code => countryStub.countryLabel(code, true));
  const collator = new Intl.Collator('ar');
  assert.deepEqual(names, [...names].sort(collator.compare));
  const english = sorting.applyChannelSort(source, 'country-group', [], 'en');
  assert.equal(english[0].countryCode, 'EG', 'Egypt sorts first in English');
});

check('quality sorts 4K > 1080p > 720p > SD > undeclared', () => {
  const result = sorting.applyChannelSort(source, 'quality-desc').map(item => item.id);
  assert.deepEqual(result, ['d', 'a', 'b', 'c', 'e']);
  assert.equal(sorting.qualityRank('4K'), 4);
  assert.equal(sorting.qualityRank('FHD'), 3);
  assert.equal(sorting.qualityRank(''), 0);
});

check('favorites-first pins favorites and keeps the remaining order stable', () => {
  const result = sorting.applyChannelSort(source, 'favorites-first', ['e', 'b']).map(item => item.id);
  assert.deepEqual(result, ['b', 'e', 'c', 'a', 'd']);
});

check('favorites-first with no favorites is a no-op order', () => {
  assert.deepEqual(sorting.applyChannelSort(source, 'favorites-first', []).map(item => item.id), source.map(item => item.id));
});

check('sorting is stable for equal keys', () => {
  const equal = [channel('x', 'Same'), channel('y', 'Same'), channel('z', 'Same')];
  assert.deepEqual(sorting.applyChannelSort(equal, 'az').map(item => item.id), ['x', 'y', 'z']);
  assert.deepEqual(sorting.applyChannelSort(equal, 'quality-desc').map(item => item.id), ['x', 'y', 'z']);
});

check('empty and single-item lists are returned untouched', () => {
  const single = [channel('only', 'Only')];
  assert.equal(sorting.applyChannelSort(single, 'az'), single);
  assert.deepEqual(sorting.applyChannelSort([], 'az'), []);
});

check('unknown stored sort values fall back to default', () => {
  assert.equal(sorting.isChannelSortKey('az'), true);
  assert.equal(sorting.isChannelSortKey('nonsense'), false);
  assert.equal(sorting.isChannelSortKey(null), false);
  assert.equal(sorting.isChannelSortKey(undefined), false);
});

check('7,500 channels sort without dropping or duplicating a row', () => {
  const many = Array.from({ length: 7500 }, (_, index) => channel(`id-${index}`, `Channel ${index % 97}`, { quality: ['4K', 'FHD', 'HD', 'SD', ''][index % 5], countryCode: ['IQ', 'EG', 'SA', ''][index % 4] }));
  for (const mode of ['az', 'country-group', 'quality-desc', 'favorites-first']) {
    const result = sorting.applyChannelSort(many, mode, ['id-7000', 'id-13']);
    assert.equal(result.length, 7500, `${mode} lost rows`);
    assert.equal(new Set(result.map(item => item.id)).size, 7500, `${mode} duplicated rows`);
  }
});

check('view preference persists under a dedicated storage key with an SSR-safe default', () => {
  const code = readFileSync(path.join(root, 'src/lib/use-channel-view.ts'), 'utf8');
  assert.match(code, /cloudplay-channel-view/);
  assert.match(code, /cloudplay-channel-sort/);
  assert.match(code, /useSyncExternalStore/);
  assert.match(code, /SERVER_STATE[^=]*=\s*\{\s*view:\s*'grid'/);
});

check('compact row is 56px and the list virtualizes with a stable item key', () => {
  const row = readFileSync(path.join(root, 'src/components/channels/ChannelRowCompact.tsx'), 'utf8');
  assert.match(row, /CHANNEL_ROW_HEIGHT = 56/);
  const list = readFileSync(path.join(root, 'src/components/channels/ChannelList.tsx'), 'utf8');
  assert.match(list, /useVirtualizer/);
  assert.match(list, /getItemKey/);
  assert.match(list, /overscan/);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
