/**
 * Regenerate the bundled live snapshot.
 *
 *   node scripts/live-snapshot.js <playlist.m3u> [--origin=label]
 *
 * The bundled snapshot is what a cold serverless function serves before its
 * first successful network fetch. It is built from a real playlist file so the
 * Live section is populated even when the upstream is unreachable.
 *
 * The output is committed, so this script is deterministic: same input, same
 * output (modulo `createdAt`, which is taken from SOURCE_DATE_EPOCH when set).
 */
const fs = require('fs');
const path = require('path');
const { loadTs } = require('./lib/load-ts');

const ROOT = path.resolve(__dirname, '..');
const { parseM3U } = loadTs(path.join(ROOT, 'apps/web/src/server/live/m3u.ts'));

const args = process.argv.slice(2);
const input = args.find((arg) => !arg.startsWith('--'));
const originArg = args.find((arg) => arg.startsWith('--origin='));
if (!input) {
  console.error('usage: node scripts/live-snapshot.js <playlist.m3u> [--origin=label]');
  process.exit(1);
}

const raw = fs.readFileSync(input, 'utf8');
const { channels, report, urls } = parseM3U(raw, 'العراق · Iraq');
const epoch = Number(process.env.SOURCE_DATE_EPOCH) * 1000;
const createdAt = Number.isFinite(epoch) && epoch > 0 ? new Date(epoch).toISOString() : new Date().toISOString();

const snapshot = {
  version: 1,
  createdAt,
  origin: originArg ? originArg.split('=')[1] : 'bundled',
  bundled: true,
  channels: channels.map((channel) => ({
    id: channel.id,
    name: channel.name,
    group: channel.group,
    epgId: channel.epgId,
    language: channel.language,
    ...(channel.logo ? { logo: channel.logo } : {}),
    playable: channel.playable,
    ...(channel.blockedReason ? { blockedReason: channel.blockedReason } : {}),
    ...(channel.playable && urls.get(channel.id) ? { url: urls.get(channel.id) } : {}),
  })),
  report,
  sources: [{ key: path.basename(input), url: '', ok: true, bytes: Buffer.byteLength(raw, 'utf8'), ms: 0 }],
};

const target = path.join(ROOT, 'apps/web/src/server/live/snapshot/iq.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(snapshot, null, 0)}\n`, 'utf8');

const playable = snapshot.channels.filter((channel) => channel.playable).length;
console.log(`wrote ${path.relative(ROOT, target)}`);
console.log(`  raw entries      ${report.raw}`);
console.log(`  channels         ${snapshot.channels.length}`);
console.log(`  playable         ${playable}`);
console.log(`  blocked          ${snapshot.channels.length - playable}`);
console.log(`  duplicates       ${report.duplicates}`);
console.log(`  bytes on disk    ${fs.statSync(target).size}`);
