/**
 * Player logic for the in-page Live player.
 *
 * Everything here is pure so it can be unit-tested without a DOM or a network:
 * retry budgets, error classification, seek-step selection, time formatting and
 * the keyboard map. The React component only wires these to elements.
 */

export type PlayerStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'stalled' | 'error';
export type PlayerErrorKind = 'manifest' | 'segment' | 'network' | 'media' | 'timeout' | 'blocked' | 'unsupported';

export type PlayerError = {
  kind: PlayerErrorKind;
  /** Stable machine code, never a provider URL. */
  code: string;
  /** How many automatic retries were already spent on this failure class. */
  attempts: number;
  /** True when the player has given up and the user must act. */
  fatal: boolean;
};

export type RetryPolicy = {
  /** Maximum automatic retries for manifest failures. */
  manifest: number;
  /** Maximum automatic retries for segment/network failures. */
  segment: number;
  /** Delays in ms between attempts; the last value repeats. */
  delays: number[];
  /** Consecutive segment failures after which playback is abandoned. */
  segmentBudget: number;
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  manifest: 3,
  segment: 4,
  delays: [600, 1500, 3500, 7000],
  segmentBudget: 6,
};

export function retryDelay(policy: RetryPolicy, attempt: number): number {
  const index = Math.min(Math.max(attempt - 1, 0), policy.delays.length - 1);
  return policy.delays[index];
}

export type RetryState = {
  manifest: number;
  segment: number;
  /** Consecutive segment errors without a successful fragment in between. */
  segmentStreak: number;
};

export const INITIAL_RETRY_STATE: RetryState = { manifest: 0, segment: 0, segmentStreak: 0 };

/**
 * Decide what to do after an error.
 * Returns the next state and whether the caller should retry or give up.
 */
export function classifyFailure(
  kind: PlayerErrorKind,
  state: RetryState,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): { next: RetryState; retry: boolean; fatal: boolean; delayMs: number; error: PlayerError } {
  if (kind === 'manifest' || kind === 'timeout') {
    const attempts = state.manifest + 1;
    const retry = attempts <= policy.manifest;
    return {
      next: { ...state, manifest: attempts },
      retry,
      fatal: !retry,
      delayMs: retryDelay(policy, attempts),
      error: { kind, code: kind === 'timeout' ? 'MANIFEST_TIMEOUT' : 'MANIFEST_ERROR', attempts, fatal: !retry },
    };
  }
  if (kind === 'blocked' || kind === 'unsupported') {
    // Autoplay policy or codec support: retrying cannot help, the user must act.
    return {
      next: state,
      retry: false,
      fatal: true,
      delayMs: 0,
      error: { kind, code: kind === 'blocked' ? 'AUTOPLAY_BLOCKED' : 'UNSUPPORTED_STREAM', attempts: 0, fatal: true },
    };
  }
  // Segment/network/media failures: retry within a budget.
  const attempts = state.segment + 1;
  const streak = state.segmentStreak + 1;
  const retry = attempts <= policy.segment && streak <= policy.segmentBudget;
  return {
    next: { ...state, segment: attempts, segmentStreak: streak },
    retry,
    fatal: !retry,
    delayMs: retryDelay(policy, attempts),
    error: { kind, code: kind === 'network' ? 'NETWORK_ERROR' : kind === 'segment' ? 'SEGMENT_ERROR' : 'MEDIA_ERROR', attempts, fatal: !retry },
  };
}

/** A successful fragment resets the consecutive-failure streak. */
export function noteSuccess(state: RetryState): RetryState {
  return { ...state, segmentStreak: 0 };
}

/**
 * Skip by a step that always moves: +10s / -10s, widened for long content.
 * Live streams may not be seekable at all, in which case `canSeek` is false.
 */
export function seekTarget(current: number, duration: number, delta: number): number | null {
  if (!Number.isFinite(current)) return null;
  if (!Number.isFinite(duration) || duration <= 0) {
    // Live: only skip forward a little is meaningful, but never before 0.
    return Math.max(0, current + delta);
  }
  return Math.min(Math.max(0, current + delta), Math.max(0, duration - 0.5));
}

export function formatTime(seconds: number | undefined, live = false): string {
  if (live) return 'LIVE';
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '--:--';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
}

export function formatBitrate(bitsPerSecond: number | undefined): string {
  if (!bitsPerSecond || !Number.isFinite(bitsPerSecond) || bitsPerSecond <= 0) return '';
  if (bitsPerSecond >= 1_000_000) return `${(bitsPerSecond / 1_000_000).toFixed(1)} Mbps`;
  return `${Math.round(bitsPerSecond / 1000)} kbps`;
}

/** Human label for a level, falling back to bitrate when there is no height. */
export function levelLabel(height: number | undefined, bitrate: number | undefined, index: number): string {
  if (height && height > 0) return `${height}p`;
  const rate = formatBitrate(bitrate);
  return rate || `Level ${index + 1}`;
}

export type PlayerAction =
  | 'togglePlay'
  | 'mute'
  | 'fullscreen'
  | 'seekForward'
  | 'seekBack'
  | 'volumeUp'
  | 'volumeDown'
  | 'escape'
  | 'retry';

/** Keyboard map matching familiar desktop player conventions. */
export function resolveKey(key: string, shiftKey = false): PlayerAction | null {
  switch (key) {
    case ' ':
    case 'Spacebar':
    case 'k':
    case 'K':
      return 'togglePlay';
    case 'm':
    case 'M':
      return 'mute';
    case 'f':
    case 'F':
      return 'fullscreen';
    case 'ArrowRight':
    case 'l':
    case 'L':
      return 'seekForward';
    case 'ArrowLeft':
    case 'j':
    case 'J':
      return 'seekBack';
    case 'ArrowUp':
      return 'volumeUp';
    case 'ArrowDown':
      return 'volumeDown';
    case 'Escape':
      return 'escape';
    case 'r':
    case 'R':
      return 'retry';
    default:
      return shiftKey ? null : null;
  }
}

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

/**
 * Map an hls.js error payload to our vocabulary without importing hls.js types,
 * so this module stays dependency free.
 */
export function classifyHlsError(data: { type?: string; details?: string; fatal?: boolean }): PlayerErrorKind {
  // hls.js mixes conventions: 'manifestLoadError', 'fragLoadError',
  // 'manifestLoadTimeOut', and already-uppercase variants in older releases.
  // Normalise by stripping separators and lowercasing before matching.
  const normalised = (data.details ?? '').toLowerCase().replace(/[_-]/g, '');
  if (normalised.includes('timeout')) return 'timeout';
  if (normalised.includes('manifest')) return 'manifest';
  if (normalised.includes('frag') || normalised.includes('bufferappend') || normalised.includes('segment')) return 'segment';
  if (normalised.includes('network') || normalised.includes('loaderror') || normalised.includes('level')) return 'network';
  return 'media';
}

/** Map a native <video> MediaError code to our vocabulary. */
export function classifyMediaError(code: number | undefined): PlayerErrorKind {
  switch (code) {
    case 1:
      return 'network';
    case 2:
      return 'network';
    case 3:
      return 'segment';
    case 4:
      return 'unsupported';
    default:
      return 'media';
  }
}
