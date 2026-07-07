import type { SearchDoc } from './search-index';

// Tiny dependency-free fuzzy matcher for the global-search overlay. Multi-word
// queries are AND-matched (every term must appear somewhere), and ranking
// favours title matches over subtitle/keyword matches. Pure + client-safe —
// unit-tested in search-match.test.ts.

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Is `needle` a subsequence of `hay` (chars in order, not necessarily adjacent)?
function subsequence(hay: string, needle: string): boolean {
  let i = 0;
  for (let j = 0; j < hay.length && i < needle.length; j++) {
    if (hay[j] === needle[i]) i++;
  }
  return i === needle.length;
}

// A gentle nudge so a person/team edges out a page on an otherwise-equal score.
const TYPE_WEIGHT: Record<SearchType, number> = {
  driver: 6,
  team: 5,
  series: 5,
  weekend: 3,
  info: 3,
  blog: 3,
  tab: 2,
  page: 1,
};
type SearchType = SearchDoc['type'];

// Score one doc against a single lower-cased term. 0 = no match at all.
function scoreTerm(doc: SearchDoc, term: string): number {
  const title = doc.title.toLowerCase();
  const hay = `${title} ${(doc.subtitle ?? '').toLowerCase()} ${(doc.keywords ?? '').toLowerCase()}`;
  if (title === term) return 1000;
  if (title.startsWith(term)) return 600 - Math.min(title.length, 300);
  if (new RegExp(`\\b${escapeRegExp(term)}`).test(title)) return 400; // word-start in title
  if (title.includes(term)) return 250;
  if (hay.includes(term)) return 120; // matched in subtitle / keywords
  // Subsequence fuzz is TITLE-only (typo tolerance on names). Deliberately NOT
  // run over the full haystack: team + series + keywords make it long enough
  // that almost any short query is a subsequence of it, flooding results with
  // noise (browser-tested — "norris" pulled ~25 unrelated drivers). The
  // substring-in-haystack tier (120, above) is the keyword backstop instead.
  // ...and only for SHORT titles (driver names, codes, series names). A long
  // event / sponsor-laden team title would itself subsequence-match almost any
  // query — the same noise problem one tier up — so cap it.
  if (title.length <= 30 && subsequence(title, term)) return 80;
  return 0;
}

export function searchDocs(docs: SearchDoc[], query: string, limit = 24): SearchDoc[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);

  const scored: Array<{ doc: SearchDoc; score: number }> = [];
  for (const doc of docs) {
    let total = 0;
    let matchedAll = true;
    for (const term of terms) {
      const s = scoreTerm(doc, term);
      if (s === 0) {
        matchedAll = false;
        break;
      }
      total += s;
    }
    if (!matchedAll) continue;
    total += TYPE_WEIGHT[doc.type];
    scored.push({ doc, score: total });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.doc.title.length - b.doc.title.length ||
      a.doc.title.localeCompare(b.doc.title),
  );
  return scored.slice(0, limit).map((s) => s.doc);
}
