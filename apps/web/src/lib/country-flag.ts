/**
 * Country code → flag emoji.
 *
 * A flag is a PAIR of regional-indicator symbols (U+1F1E6…U+1F1FF). Hand-written
 * flag literals are easy to get wrong — a single regional indicator renders as a
 * boxed letter instead of a flag, and it looks fine in source. Deriving both
 * halves from the ISO code removes that whole class of mistake and covers every
 * country without a lookup table.
 */
export function countryFlag(code: string, fallback = '📺'): string {
  if (typeof code !== 'string' || !/^[a-z]{2}$/i.test(code)) return fallback;
  const base = 0x1f1e6;
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    base + upper.charCodeAt(0) - 65,
    base + upper.charCodeAt(1) - 65,
  );
}
