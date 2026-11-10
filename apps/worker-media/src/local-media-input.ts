import { extname, isAbsolute } from 'node:path';

/** Upload contract is MP4/QuickTime only. Never auto-detect a user-supplied
 * playlist/concat/URL which could make ffmpeg/ffprobe fetch internal services.
 * Disable MOV external data references as well as all network protocols. */
export function localMediaInput(source: string): string[] {
  if (!isAbsolute(source) || !['.mp4', '.mov'].includes(extname(source).toLowerCase())) throw new Error('INVALID_LOCAL_MEDIA');
  return ['-protocol_whitelist', 'file,pipe', '-f', 'mov', '-enable_drefs', '0', '-i', source];
}
