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

// drivers.json names and results feeds drift ("Kimi Antonelli" vs Jolpica's
// "Andrea Kimi Antonelli") — match on slug equality or containment.
export function namesMatch(a: string, b: string): boolean {
  const sa = slugify(a);
  const sb = slugify(b);
  if (!sa || !sb) return false;
  return sa === sb || sa.includes(sb) || sb.includes(sa);
}
