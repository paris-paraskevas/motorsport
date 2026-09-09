import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

const NOT_FOUND = new Error('NEXT_NOT_FOUND');
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw NOT_FOUND;
  },
}));
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: unknown; children: React.ReactNode; className?: string }) => (
    <a href={String(href)} className={className}>
      {children}
    </a>
  ),
}));
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => React.createElement('img', { src, alt }),
}));
const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));
const loadRevisionPreview = vi.fn();
vi.mock('@/lib/design/live-page', () => ({ loadRevisionPreview: (id: string) => loadRevisionPreview(id), loadAssetsById: async () => new Map() }));
vi.mock('@/lib/design/shortcuts', () => ({ loadShortcuts: async () => ({ 'times.local': 'All times are local.' }) }));
vi.mock('@/lib/design/lists', async () => {
  const actual = await vi.importActual<typeof import('@/lib/design/lists')>('@/lib/design/lists');
  return {
    loadNavLists: async () => actual.DEFAULT_NAV,
    loadDocumentLists: async (keys: string[]) => Object.fromEntries(keys.map(k => [k, []])),
  };
});
vi.mock('@/lib/design/authz', async () => {
  const d = await vi.importActual<typeof import('@/lib/design/authz-defaults')>('@/lib/design/authz-defaults');
  return { loadAuthzSchemes: async () => d.DEFAULT_AUTHZ_SCHEMES };
});

import RevisionPreviewPage, { dynamic, generateMetadata } from './page';
import type { PageRow } from '@/lib/design/pages';

const admin = { id: 'user_admin', publicMetadata: { role: 'admin' } };
const REV = 'b1b2c3d4-0000-4000-8000-000000000002';
const page: PageRow = { id: 'a1b2c3d4-0000-4000-8000-000000000010', path: '/history/monza', name: 'Monza, a history', kind: 'row', group: 'editorial', template: 'paddock-standard', authz: 'public', title: 'Monza', rendering: 'cached', indexable: true, comments: null, updatedAt: 'x' };
const preview = {
  page,
  revisionId: REV,
  createdAt: '2026-09-08T19:20:00Z',
  publishedAt: null,
  isLive: false,
  problems: [],
  document: {
    version: 1,
    actions: [],
    regions: [
      { id: 'intro', kind: 'static', title: 'History', position: 'body', seq: 10, column: 1, span: 12, newRow: false, hidden: false, authz: null, text: 'Opened in 1922. {shortcut:times.local}' },
      { id: 'members', kind: 'static', title: 'Members', position: 'body', seq: 20, column: 1, span: 12, newRow: false, hidden: false, authz: 'signed_in', text: 'For members' },
    ],
  },
};
const params = Promise.resolve({ rev: REV });

describe('/preview/[rev]', () => {
  beforeEach(() => {
    currentUser.mockReset();
    currentUser.mockResolvedValue(admin);
    loadRevisionPreview.mockReset();
    loadRevisionPreview.mockResolvedValue(preview);
  });

  it('renders per request, is never indexed, and is the 404 for anyone but an administrator, before the revision is read', async () => {
    expect(dynamic).toBe('force-dynamic');
    expect((await generateMetadata({ params })).robots).toEqual({ index: false, follow: false });
    expect((await generateMetadata({ params })).title).toBe('Preview · Monza');
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    await expect(RevisionPreviewPage({ params })).rejects.toBe(NOT_FOUND);
    currentUser.mockResolvedValue(null);
    await expect(RevisionPreviewPage({ params })).rejects.toBe(NOT_FOUND);
  });

  it('is the 404 for a revision that does not exist, and shows an administrator the draft with the toolbar and every region', async () => {
    loadRevisionPreview.mockResolvedValueOnce(null);
    await expect(RevisionPreviewPage({ params })).rejects.toBe(NOT_FOUND);
    const html = renderToStaticMarkup(await RevisionPreviewPage({ params }));
    expect(html).toContain('aria-label="Developer toolbar"');
    expect(html).toContain('revision b1b2c3d4 · a draft · saved 2026-09-08 19:20Z');
    expect(html).toContain('href="/admin/designer?ws=builder&amp;page=a1b2c3d4-0000-4000-8000-000000000010"');
    expect(html).toContain('href="/history/monza"');
    expect(html).toContain('Opened in 1922. All times are local.');
    expect(html).toContain('For members');
    expect(html).not.toContain('Sign in to see this.');
  });

  it('says when the revision is the live one', async () => {
    loadRevisionPreview.mockResolvedValue({ ...preview, publishedAt: '2026-09-08T19:30:00Z', isLive: true });
    const html = renderToStaticMarkup(await RevisionPreviewPage({ params }));
    expect(html).toContain('· the live revision ·');
  });
});
