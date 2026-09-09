import 'server-only';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';

// Page families (the components programme, R4.1): what a page served from rows
// still needs from the code once its route file has left. Its title,
// description and card; the structured data it used to print. One family per
// registry pattern, loaded on demand so the catch-all's chunk carries none of
// their assemblies until a page asks (the bundle rule from R2b).

export type PageParams = Readonly<Record<string, string>>;

export interface PageFamily {
  /** The page's own metadata for these address parts; the row's title and index rule are applied over it by the catch-all. */
  metadata: (params: PageParams) => Promise<Metadata>;
  /** Nodes the page prints beside its body: structured data, mostly. */
  extras?: (params: PageParams) => Promise<ReactNode>;
}

const FAMILIES: Readonly<Record<string, () => Promise<PageFamily>>> = {
  '/calendar': () => import('./families/calendar').then(m => m.family),
};

/** Whether a registry pattern has a family here. */
export function hasFamily(pattern: string): boolean {
  return pattern in FAMILIES;
}

export async function familyMetadata(pattern: string, params: PageParams): Promise<Metadata> {
  const load = FAMILIES[pattern];
  if (!load) return {};
  try {
    return await (await load()).metadata(params);
  } catch {
    return {};
  }
}

export async function familyExtras(pattern: string, params: PageParams): Promise<ReactNode> {
  const load = FAMILIES[pattern];
  if (!load) return null;
  try {
    const f = await load();
    return f.extras ? await f.extras(params) : null;
  } catch {
    return null;
  }
}
