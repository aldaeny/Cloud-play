/**
 * Shared types for the live TV pipeline.
 *
 * M3U Source -> Import Service -> Parser -> Storage -> API -> Live UI -> Player
 * Every stage uses these types so a channel can be traced end to end.
 */

/** A fixed upstream feed. The client can never supply a source URL. */
export type LiveSource = {
  /** Stable key used in reports and logs. */
  key: string;
  /** Human label shown in the UI ("Iraq", "Arab region", ...). */
  label: string;
  /** Public URL of the M3U file. */
  url: string;
  /** Ordered fallbacks, used when the primary URL fails. */
  mirrors: string[];
  /** Optional category prefix applied to channels from this source. */
  category: string;
  /** Country/region hint forwarded to the UI. */
  region: 'iq' | 'arab' | 'world' | 'operator';
};

/** What the API publishes for one channel. No provider host, no tokens. */
export type PublicChannel = {
  id: string;
  name: string;
  group: string;
  epgId: string;
  language: string;
  logo?: string;
  playable: boolean;
  /** Opaque proxy path, present only when playable. */
  stream?: string;
};

/** Machine-readable health of the live pipeline. */
export type LiveHealth = {
  status: 'ok' | 'degraded' | 'unconfigured';
  /** Where the current channel list came from. */
  source: string;
  /** ISO timestamp of the data currently served. */
  updatedAt: string;
  /** True when serving a last-known-good snapshot instead of a fresh fetch. */
  stale: boolean;
  /** How long the served data has existed, in seconds. */
  ageSeconds: number;
  counts: {
    total: number;
    playable: number;
    blocked: number;
    duplicates: number;
    raw: number;
  };
  /** Per-source fetch outcome for this refresh. */
  sources: Array<{ key: string; url: string; ok: boolean; error?: string; bytes?: number; ms?: number }>;
};

/** The stored document: one JSON file, versioned so old snapshots stay readable. */
export type LiveSnapshot = {
  version: 1;
  createdAt: string;
  /** Which source produced the data. */
  origin: string;
  /** True when this is the bundled fallback rather than a live fetch. */
  bundled: boolean;
  channels: Array<{
    id: string;
    name: string;
    group: string;
    epgId: string;
    language: string;
    logo?: string;
    playable: boolean;
    /** Provider URL. Never leaves the server: the API replaces it with a token. */
    url?: string;
    blockedReason?: string;
  }>;
  report: { total: number; duplicates: number; invalid: number; playerOptionOnly: number; unnamed: number; raw: number };
  sources: LiveHealth['sources'];
};
