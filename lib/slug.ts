// Combining diacritical marks: U+0300..U+036F. Stripping after NFD normalization
// turns "Hülkenberg" -> "Hu" + combining-umlaut + "lkenberg" -> "Hulkenberg".
const DIACRITICS_RE = /[̀-ͯ]/g;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
