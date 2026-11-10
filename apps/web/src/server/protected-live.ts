/** Metadata addressing only. Mapping is NOT a publication or rights grant. */
export function protectedLiveUrl(id: string, original = '') {
  const formats=JSON.parse(process.env.EXTERNAL_CHANNEL_FORMATS||'{}') as Record<string,unknown>;
  const dash=formats[id]==='dash'||(/\.mpd(?:\?|$)/i.test(original)&&formats[id]===undefined);
  return `/api/external/${encodeURIComponent(id)}/${dash?'manifest.mpd':'manifest'}`;
}
export function backendChannel(id: string): string {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error('INVALID_CHANNEL');
  const bindings = JSON.parse(process.env.EXTERNAL_CHANNEL_BINDINGS || '{}') as Record<string, unknown>;
  const mapped = bindings[id] || id;
  if (typeof mapped !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(mapped)) throw new Error('CHANNEL_NOT_MAPPED');
  return mapped;
}
export function protectLiveRows<T extends {id:string;streamUrl?:string|null;url?:string|null}>(rows:T[]):T[]{
  return rows.map(row=>({...row,...('streamUrl'in row?{streamUrl:protectedLiveUrl(row.id,row.streamUrl||row.url||'')}:{}),...('url'in row?{url:protectedLiveUrl(row.id,row.streamUrl||row.url||'')}:{})}));
}
