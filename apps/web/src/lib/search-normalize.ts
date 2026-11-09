/**
 * Arabic-aware text normalization for search matching.
 *
 * Plain `toLowerCase().includes()` fails on Arabic because the same word is
 * routinely typed with different letter forms: alef with hamza/madda vs bare
 * alef, taa marbuta vs haa, alef maqsura vs yaa, plus optional diacritics and
 * tatweel. A visitor searching "الجزيره" should find "الجزيرة".
 *
 * This is for MATCHING ONLY — never for display. It folds forms together and
 * is deliberately lossy.
 */

/** Arabic diacritics (harakat), tatweel, and Quranic annotation marks. */
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u0640]/g;

/** Letter forms that Arabic typists use interchangeably. */
const FORM_FOLDS: [RegExp, string][] = [
  [/[\u0622\u0623\u0625\u0671]/g, '\u0627'], // آ أ إ ٱ → ا
  [/[\u0649]/g, '\u064A'],                   // ى → ي
  [/[\u0629]/g, '\u0647'],                   // ة → ه
  [/[\u0624]/g, '\u0648'],                   // ؤ → و
  [/[\u0626]/g, '\u064A'],                   // ئ → ي
];

/** Arabic-Indic and Extended (Persian) digits → ASCII, so "٢٤" matches "24". */
const DIGIT_BASES: [number, number][] = [
  [0x0660, 0x0669], // ٠-٩
  [0x06F0, 0x06F9], // ۰-۹
];

/**
 * Fold a string into a comparable form:
 * lowercase → strip diacritics/tatweel → fold letter forms → ASCII digits →
 * collapse whitespace. Returns '' for non-string input so callers can treat a
 * missing field as "no text" instead of throwing.
 */
export function normalizeForSearch(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0) return '';
  let text = raw.toLowerCase().replace(DIACRITICS, '');
  for (const [pattern, replacement] of FORM_FOLDS) text = text.replace(pattern, replacement);
  text = text.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, char => {
    const code = char.codePointAt(0) as number;
    for (const [start, end] of DIGIT_BASES) {
      if (code >= start && code <= end) return String(code - start);
    }
    return char;
  });
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * True when every whitespace-separated token of `query` appears somewhere in
 * `text`. Token matching (rather than one substring) means "رياضة عراق" finds
 * "العراقية الرياضية" regardless of word order.
 *
 * An empty/blank query matches everything, which is what a cleared search box
 * should do.
 */
export function matchesSearch(text: string, query: string): boolean {
  const needle = normalizeForSearch(query);
  if (!needle) return true;
  const haystack = normalizeForSearch(text);
  if (!haystack) return false;
  return needle.split(' ').every(token => haystack.includes(token));
}

/** Build the searchable blob for a record once, instead of per keystroke. */
export function searchBlob(...fields: unknown[]): string {
  return normalizeForSearch(fields.filter(field => typeof field === 'string').join(' '));
}
