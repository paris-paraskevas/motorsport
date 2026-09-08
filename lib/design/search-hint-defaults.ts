// Search hints (the alive search placeholder, operator 2026-09-08): questions
// the header's search field shows in turn, a minute apart, after the first
// paint. Client-safe: the editor and the header read this; the server loader
// (search-hints.ts) and the routes lean on it.
//
// The rails: a hint is a question of at most 120 characters, saved only when
// the site's own search finds a page for it (the route verifies against the
// search index), so the field never suggests a question that leads nowhere.
// The rotation never touches the cached render: the first paint carries
// `nav.search`, the hints take over in the browser, and they hold still under
// reduced motion.

export const SEARCH_HINT_MAX = 120;
export const SEARCH_HINT_ROTATE_MS = 60_000;

export interface SearchHint {
  id: string;
  question: string;
  seq: number;
  /** Where the search led when the question was saved; null when unknown. */
  leadsTo: string | null;
  leadsTitle: string | null;
}

/** Why a question is refused before the search is asked; null when it is fine. */
export function searchHintProblem(question: string): string | null {
  const q = question.trim();
  if (!q) return 'needs a question';
  if (q.length > SEARCH_HINT_MAX) return `a question is at most ${SEARCH_HINT_MAX} characters`;
  return null;
}
