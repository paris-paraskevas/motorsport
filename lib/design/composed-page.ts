import { CODE_PAGES, type CodePage } from './page-registry';
import { defaultDocument, recipeRegions } from './components';
import { isLegacyBody, patternMatches, type PageDocument, type Region } from './page-document';

// A page served from its row after its route file has left the code (the
// components programme, R4.1). Client-safe and pure, so the catch-all, the
// designer and the tests share one reading of "which page is this address, and
// what does it render when nothing is published".
//
// THE RULE THIS FILE ENFORCES: a page without a published composition still
// renders. Its default composition is the registry's recipe (defaultDocument),
// the same components the designer offers when the page is opened, so the site
// never shows an empty body because a revision is missing.

/** The pages the catch-all serves from rows: route file gone, recipe in the catalogue. */
export function composedCodePages(): CodePage[] {
  return CODE_PAGES.filter(p => p.served === 'rows');
}

/** The address's parts by segment name, for a registry pattern that matched. */
export function extractParams(pattern: string, path: string): Record<string, string> {
  const ps = pattern.split('/').filter(Boolean);
  const xs = path.split('/').filter(Boolean);
  const out: Record<string, string> = {};
  ps.forEach((seg, i) => {
    const m = /^\[(\.\.\.)?([a-z]+)\]$/.exec(seg);
    if (!m) return;
    out[m[2]] = m[1] ? xs.slice(i).join('/') : (xs[i] ?? '');
  });
  return out;
}

/** The composed page an address belongs to, with its parts; null when no
 *  rows-served page matches. Literal patterns win over dynamic ones. */
export function matchComposedPage(path: string): { page: CodePage; params: Record<string, string> } | null {
  const candidates = composedCodePages().filter(p => patternMatches(p.path, path));
  if (candidates.length === 0) return null;
  const literal = candidates.find(p => !p.path.includes('['));
  const page = literal ?? candidates.sort((a, b) => (a.path.match(/\[/g)?.length ?? 0) - (b.path.match(/\[/g)?.length ?? 0))[0];
  return { page, params: extractParams(page.path, path) };
}

/** The document with the transitional body, when it holds one, replaced in its
 *  place by the recipe's components. On a page served from rows the code draws
 *  no body, so a "Body as the code draws it" left from before the route file
 *  went (a revision published under R2) can only mean the default composition.
 *  The fresh regions take ids the document does not use and seqs from the
 *  placeholder's; the Body regions after it move past them. The designer opens
 *  such a document the same way, so what the operator sees is what is served. */
export function adoptRecipe(doc: PageDocument, pattern: string): PageDocument {
  const at = doc.regions.findIndex(isLegacyBody);
  if (at < 0) return doc;
  const legacy = doc.regions[at];
  const fresh: Region[] = recipeRegions(pattern, doc.regions.map(r => r.id), legacy.seq);
  const shift = fresh.length * 10;
  const regions = [
    ...doc.regions.slice(0, at),
    ...fresh,
    ...doc.regions.slice(at + 1).map(r => (r.position === 'body' && r.seq >= legacy.seq ? { ...r, seq: r.seq + shift } : r)),
  ];
  return { ...doc, regions };
}

/** What a composed page renders: its published document when that has Body
 *  regions (a transitional body among them adopting the recipe); otherwise the
 *  default composition, with the published document's other regions (a frame
 *  published before the split) kept around it. */
export function composedDocument(published: PageDocument | null, pattern: string): PageDocument {
  const base = defaultDocument(pattern);
  if (!published) return base;
  if (published.regions.some(r => r.position === 'body')) return adoptRecipe(published, pattern);
  const others = published.regions.filter(r => r.position !== 'body');
  return { ...base, regions: [...others, ...base.regions], actions: published.actions };
}
