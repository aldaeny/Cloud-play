export interface EPGProgram {
  id: string;
  title: string;
  start: string;
  end: string;
  description?: string;
}
export type ChannelCategory = 'sports' | 'news' | 'movies' | 'series' | 'entertainment' | 'kids' | 'religious' | 'music' | 'documentary' | 'education' | 'comedy' | 'general';
export type ChannelQuality = 'SD' | 'HD' | 'FHD' | '4K';
export type StreamType = 'hls' | 'dash' | 'mp4';

/** Public, rights-reviewed channel metadata. Never add credentials or DRM keys here. */
export interface Channel {
  id: string;
  name: string;
  logo: string;
  streamUrl: string;
  streamType: StreamType;
  category: ChannelCategory;
  /** Original provider group, preserved instead of inventing a category. */
  sourceGroup: string;
  country: string;
  countryCode: string;
  language: string;
  /** Empty means the source does not declare a quality. */
  quality: ChannelQuality | '';
  qualityLabel: string;
  isLive: boolean;
  playable: boolean;
  epgId: string;
  epg?: EPGProgram[];
}
export interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  quality: string;
  speed: number;
  subtitlesEnabled: boolean;
  audioTrack: string;
  fullscreen: boolean;
  error: string | null;
  buffering: boolean;
}
