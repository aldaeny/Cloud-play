// Types for TV Channels & Player
export interface EPGProgram {
  id: string;
  title: string;
  start: string; // ISO Date
  end: string;   // ISO Date
  description?: string;
}

export type ChannelCategory =
  | "sports" | "news" | "movies" | "series"
  | "entertainment" | "kids" | "religious" | "music"
  | "documentary" | "education" | "comedy" | "general";

export interface Channel {
  id: string;
  name: string;
  logo: string;
  streamUrl: string;        // M3U8 / MPD / MP4
  streamType: "hls" | "dash" | "mp4" | "youtube";
  category: ChannelCategory;
  country: string;
  countryCode: string;      // ISO: "IQ", "US", "TR"...
  language: string;
  quality: "SD" | "HD" | "FHD" | "4K";
  qualityLabel: string;     // "1080p", "720p"...
  isLive: boolean;
  isFavorite?: boolean;
  drm?: {
    type: "widevine" | "fairplay" | "clearkey";
    licenseUrl?: string;
    keys?: Record<string, string>;
  };
  headers?: Record<string, string>; // User-Agent, Referer...
  epg?: EPGProgram[];       // Electronic Program Guide
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
