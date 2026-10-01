// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { defaultDocument } from '@/lib/design/components';

// R18: a series tab composed from a recipe keyed by its concrete address, drawn through the frame's assembly; the code's tab
// stands in for an address without a recipe and when the composition throws.
const composedBody = vi.fn(async (path: string) => `composed ${path}`);
vi.mock('@/lib/design/page-frame', () => ({ composedBody: (...a: unknown[]) => composedBody(...(a as [string])) }));
const row = { id: null, path: '/series/[slug]/[tab]', name: 'Series tab', kind: 'code', group: 'series', template: 'paddock-standard', authz: 'public', title: null, rendering: 'cached', indexable: true, comments: null, updatedAt: null };
const registryPageRow = vi.fn((path: string) => (path === '/series/[slug]/[tab]' ? row : null));
vi.mock('@/lib/design/pages', () => ({ registryPageRow: (path: string) => registryPageRow(path) }));

import { ComposedTab, hasComposedTab } from './ComposedTab';

const draw = async (node: Promise<ReactNode>) => renderToStaticMarkup(<>{await node}</>);

describe('ComposedTab', () => {
  it('draws the recipe of the concrete address through the frame’s assembly with the registry’s row for the tab pattern and the address’s parts; the code’s tab for an address without a recipe', async () => {
    expect(hasComposedTab('/series/f2/champions')).toBe(true);
    expect(hasComposedTab('/series/f3/champions')).toBe(false);
    expect(await draw(ComposedTab({ path: '/series/f2/champions', pattern: '/series/[slug]/[tab]', params: { slug: 'f2', tab: 'champions' }, children: 'legacy' }))).toBe('composed /series/f2/champions');
    expect(composedBody).toHaveBeenCalledTimes(1);
    expect(composedBody.mock.calls[0]).toEqual(['/series/f2/champions', defaultDocument('/series/f2/champions'), { slug: 'f2', tab: 'champions' }, { page: row }]);
    expect(await draw(ComposedTab({ path: '/series/f3/champions', pattern: '/series/[slug]/[tab]', params: { slug: 'f3', tab: 'champions' }, children: 'legacy' }))).toBe('legacy');
    expect(composedBody).toHaveBeenCalledTimes(1);
  });

  it('falls back to the code’s tab when the composition throws, and when the registry has no row for the pattern', async () => {
    composedBody.mockRejectedValueOnce(new Error('down'));
    expect(await draw(ComposedTab({ path: '/series/f2/champions', pattern: '/series/[slug]/[tab]', params: { slug: 'f2', tab: 'champions' }, children: 'legacy' }))).toBe('legacy');
    expect(await draw(ComposedTab({ path: '/series/f2/champions', pattern: '/nowhere', params: {}, children: 'legacy' }))).toBe('legacy');
  });
});
