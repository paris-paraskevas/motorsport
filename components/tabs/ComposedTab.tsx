import 'server-only';
import type { ReactNode } from 'react';
import { SPLITS, defaultDocument } from '@/lib/design/components';
import { registryPageRow } from '@/lib/design/pages';

// R18: a series tab composed from a recipe keyed by its concrete address (lib/design/components.ts SPLITS, the Formula 2
// champions page first), drawn through the frame's own assembly (lib/design/page-frame.tsx composedBody) with the registry's
// row for the tab pattern, the renderer told the address and its parts, between the shell's nodes `before` and `after` it.
// The children are the WHOLE legacy layout (the shell's masthead and h1 included): drawn as they are for an address without
// a recipe, and when the composition throws, so an indexed page never answers 500, nor loses its h1, for a fault of the
// recipe. The frame module is imported on demand: lib/sitemap-data.ts imports SeriesPageView, and the frame's graph (the
// database client, the session) must not reach the sitemap. The recipe is the page's composition until the registry has a
// page per series tab.

/** Whether the address has a recipe of its own. */
export function hasComposedTab(path: string): boolean {
  return Object.prototype.hasOwnProperty.call(SPLITS, path);
}

export async function ComposedTab({ path, pattern, params, before, after, children }: { path: string; pattern: string; params: Readonly<Record<string, string>>; before?: ReactNode; after?: ReactNode; children: ReactNode }): Promise<ReactNode> {
  if (!hasComposedTab(path)) return <>{children}</>;
  // No JSX inside the try: a component React renders later would escape the catch (react-hooks/error-boundaries); the node is
  // awaited here, the fallback decided, and the markup built after.
  let composed: ReactNode = null;
  let drawn = false;
  try {
    const page = registryPageRow(pattern);
    if (page) {
      const { composedBody } = await import('@/lib/design/page-frame');
      composed = await composedBody(path, defaultDocument(path), params, { page });
      drawn = true;
    }
  } catch {
    drawn = false;
  }
  return drawn ? (
    <>
      {before}
      {composed}
      {after}
    </>
  ) : (
    <>{children}</>
  );
}
