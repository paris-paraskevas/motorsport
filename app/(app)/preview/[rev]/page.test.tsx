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
// The appearance carries the templates' presets (P1.2); the preview resolves every region against them as the catch-all does.
const loadAppearance = vi.fn(async () => SHIPPED_APPEARANCE);
vi.mock('@/lib/design/appearance', () => ({ loadAppearance: () => loadAppearance() }));
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
// A page served from rows (R4.1): the components draw as stand-ins, the family answers with fixed structured data.
vi.mock('@/lib/design/component-render', () => ({
  raceWeekendNow: async () => false,
  renderComponents: async (doc: { regions: { id: string; kind: string; component?: string }[] }, where: { path: string; page?: { title: string | null; name: string } }) =>
    Object.fromEntries(
      doc.regions
        .filter(r => r.kind === 'component' && r.component !== 'page.body')
        .map(r => [r.id, r.component === 'page.heading' ? <h1>{where.page?.title ?? where.page?.name}</h1> : <div data-component={r.component}>{where.path}</div>]),
    ),
}));
vi.mock('@/lib/design/page-families', () => ({
  familyMetadata: async () => ({ title: 'Calendar' }),
  familyExtras: async () => <script type="application/ld+json">{'{"@type":"BreadcrumbList"}'}</script>,
}));

import RevisionPreviewPage, { dynamic, generateMetadata } from './page';
import type { PageRow } from '@/lib/design/pages';
import { SHIPPED_APPEARANCE } from '@/lib/design/appearance-defaults';
import { SHIPPED_PRESETS } from '@/lib/design/template-options';

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

  it('is the 404 for a revision that does not exist, and shows an administrator the draft with every region a condition does not hide (P2.6); the toolbar is the app layout’s, not the page’s (R5)', async () => {
    loadRevisionPreview.mockResolvedValueOnce(null);
    await expect(RevisionPreviewPage({ params })).rejects.toBe(NOT_FOUND);
    const html = renderToStaticMarkup(await RevisionPreviewPage({ params }));
    expect(html).not.toContain('aria-label="Developer toolbar"');
    expect(html).toContain('data-preview-note=""');
    expect(html).toContain('revision b1b2c3d4 · a draft · saved 2026-09-08 19:20Z');
    expect(html).toContain('Opened in 1922. All times are local.');
    expect(html).toContain('For members');
    expect(html).not.toContain('Sign in to see this.');
  });

  it('P2.6: the preview applies the conditions as the live page does: a Never region and a public-user region leave (the administrator is signed in); the address is not known, so Current Page is in shows', async () => {
    const at = (id: string, text: string, condition: unknown, seq: number) => ({ id, kind: 'static', title: id, position: 'body', seq, column: 1, span: 12, newRow: false, hidden: false, authz: null, text, condition });
    const regions = [...preview.document.regions, at('gone', 'Never drawn', { type: 'never' }, 30), at('guests', 'For guests', { type: 'public' }, 40), at('here', 'Somewhere', { type: 'page-in', pages: ['/history/spa'] }, 50)];
    loadRevisionPreview.mockResolvedValue({ ...preview, document: { ...preview.document, regions } });
    const html = renderToStaticMarkup(await RevisionPreviewPage({ params }));
    expect(html).toContain('Opened in 1922');
    expect(html).toContain('For members');
    expect(html).not.toContain('Never drawn');
    expect(html).not.toContain('For guests');
    expect(html).toContain('Somewhere');
  });

  it('P1.2: draws a region on Use Template Defaults with the stored presets, the shipped ones when nothing is stored', async () => {
    const shipped = renderToStaticMarkup(await RevisionPreviewPage({ params }));
    expect(shipped).not.toMatch(/id="region-intro"[^>]*class="[^"]*py-4/);
    loadAppearance.mockResolvedValueOnce({ ...SHIPPED_APPEARANCE, templates: { ...SHIPPED_PRESETS, standard: { ...SHIPPED_PRESETS.standard, spacing: 'SPACING_ROOMY' } } });
    const roomy = renderToStaticMarkup(await RevisionPreviewPage({ params }));
    expect(roomy).toMatch(/id="region-intro"[^>]*class="[^"]*py-4/);
    expect(roomy).toContain('class="space-y-6"');
  });

  it('says in its note when the revision is the live one, and counts the stored document’s problems', async () => {
    loadRevisionPreview.mockResolvedValue({ ...preview, publishedAt: '2026-09-08T19:30:00Z', isLive: true, problems: ['region x: odd'] });
    const html = renderToStaticMarkup(await RevisionPreviewPage({ params }));
    expect(html).toContain('· the live revision ·');
    expect(html).toContain('1 problem in the stored document');
  });

  it('P1.13: previews a plain row page as the site serves it, whatever the served flag says: the page title, the Right Side Column, no code frame', async () => {
    const right = { id: 'more', kind: 'list', title: 'More', position: 'right', seq: 10, column: 1, span: 12, newRow: false, hidden: false, authz: null, listKey: 'footer-site', style: 'links' };
    // pageFromRow marks every row page served: 'rows' too; the rule is the kind, as the catch-all's resolver has it.
    loadRevisionPreview.mockResolvedValue({ ...preview, page: { ...page, served: 'rows' }, document: { ...preview.document, regions: [...preview.document.regions, right] } });
    const html = renderToStaticMarkup(await RevisionPreviewPage({ params }));
    expect(html).toContain('data-page-revision=""');
    expect(html).toMatch(/<h1[^>]*>Monza<\/h1>/);
    expect(html).toContain('<aside class="min-w-0 lg:col-span-4">');
    expect(html).not.toContain('data-page-frame');
  });

  it('previews a page served from rows as the site serves it: the components in the code frame, a transitional body adopting the recipe, the family’s structured data, no second heading', async () => {
    const calendar: PageRow = { ...page, path: '/calendar', name: 'Calendar', kind: 'code', served: 'rows', group: 'site', title: null };
    const legacy = { id: 'code-body', kind: 'component', component: 'page.body', settings: {}, title: '', position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null };
    loadRevisionPreview.mockResolvedValue({ ...preview, page: calendar, document: { version: 1, actions: [], regions: [legacy] } });
    const html = renderToStaticMarkup(await RevisionPreviewPage({ params }));
    expect(html).not.toContain('aria-label="Developer toolbar"');
    expect(html).toContain('data-page-frame="body"');
    expect(html).toContain('<h1>Calendar</h1>');
    expect(html).toContain('data-component="calendar.month"');
    expect(html).toContain('BreadcrumbList');
    expect(html).not.toContain('data-page-revision');
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
    // Nothing published yet: the default composition.
    loadRevisionPreview.mockResolvedValue({ ...preview, page: calendar, document: { version: 1, actions: [], regions: [] } });
    expect(renderToStaticMarkup(await RevisionPreviewPage({ params }))).toContain('data-component="calendar.month"');
  });
});
