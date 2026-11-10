import { SaxesParser } from 'saxes';
export function mediaReference(value: string, base: URL): URL {
  const url = new URL(value, base);
  if (!['https:', 'http:'].includes(url.protocol) || url.origin !== base.origin || url.username || url.password || url.hash) throw new Error('UNAPPROVED_MEDIA_REFERENCE');
  return url;
}
export function parseM3u(text: string, base: URL): { references: URL[] } {
  if (!text.startsWith('#EXTM3U') || text.length > 1024 * 1024) throw new Error('INVALID_PLAYLIST');
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const references = lines.filter(s => !s.startsWith('#')).map(s => mediaReference(s, base));
  if (!references.length || references.length > 1000 || !lines.some(s => s.startsWith('#EXTINF:'))) throw new Error('INVALID_PLAYLIST');
  return { references };
}
/** Strict supported DASH profile: same-origin SegmentList or SegmentTemplate.
 * No external XML entities, BaseURL inheritance, xlink or remote clock/control URLs.
 * Unsupported manifests fail closed, never silently counted as ready. */
export function parseDash(text: string, base: URL) {
  if (text.length > 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('INVALID_MANIFEST');
  const parser = new SaxesParser({ xmlns: true });
  const templates: string[] = [], representationIds: string[] = [];
  let root = false, protectedMedia = false, unsupported = false;
  parser.on('opentag', tag => {
    if (!root) { if (tag.local !== 'MPD' || tag.uri !== 'urn:mpeg:dash:schema:mpd:2011') throw new Error('INVALID_MANIFEST'); root = true; }
    if (tag.local === 'ContentProtection') protectedMedia = true;
    if (['BaseURL','Location','UTCTiming'].includes(tag.local) || Object.values(tag.attributes).some(a => a.prefix === 'xlink')) unsupported = true;
    const attr = (key: string) => Object.values(tag.attributes).find(a => a.local === key)?.value;
    const codecs=attr('codecs');if(codecs&&codecs.split(',').some(codec=>!/^(?:avc1\.[a-f0-9]{6}|mp4a\.40\.2|wvtt)$/i.test(codec.trim())))unsupported=true;
    const mime=attr('mimeType');if(mime&&!['video/mp4','audio/mp4','text/vtt','application/mp4'].includes(mime))unsupported=true;
    if (tag.local === 'Representation' && attr('id')) representationIds.push(attr('id')!);
    if (tag.local === 'SegmentTemplate') { if (attr('media')) templates.push(attr('media')!); if (attr('initialization')) templates.push(attr('initialization')!); }
    if (tag.local === 'SegmentURL' && attr('media')) templates.push(attr('media')!);
    if (tag.local === 'Initialization' && attr('sourceURL')) templates.push(attr('sourceURL')!);
  });
  parser.write(text).close();
  if (protectedMedia) return { result: 'drm_protected', templates: [], representationIds };
  if (!root || unsupported || !templates.length || templates.length > 2000 || !representationIds.length || representationIds.some(id => !/^[a-zA-Z0-9_-]{1,80}$/.test(id))) throw new Error('UNSUPPORTED_MANIFEST_PROFILE');
  for (const template of templates) mediaReference(expandTemplate(template, representationIds[0], 1, 0), base);
  return { result: 'reachable_and_dash_valid', templates, representationIds, reference: mediaReference(expandTemplate(templates[0], representationIds[0], 1, 0), base) };
}
export function expandTemplate(template: string, representation: string, number: number, time: number) {
  if (!Number.isSafeInteger(number) || number < 0 || number > 2147483647 || !Number.isSafeInteger(time) || time < 0 || !/^[a-zA-Z0-9_-]{1,80}$/.test(representation)) throw new Error('INVALID_TEMPLATE_ARGUMENT');
  const value = template.replace(/\$RepresentationID\$/g, representation).replace(/\$Number(?:%0([1-9])d)?\$/g, (_match, padding) => String(number).padStart(Number(padding || 0), '0')).replace(/\$Time\$/g, String(time));
  if (value.includes('$')) throw new Error('UNSUPPORTED_TEMPLATE'); return value;
}
