// @vitest-environment jsdom
//
// The designer keeps the selected catalogue entry in the URL (`?sc=`), so a
// refresh reopens the same editor (operator, 2026-09-08: "upon refresh we
// should stay on the example page"). These cases pin that round trip: a click
// writes the URL, the crumb clears it, and the page's `?sc=` opens the entry.

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type React from 'react';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: unknown; children: React.ReactNode }) => <a href={String(href)}>{children}</a>,
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/designer',
  useRouter: () => ({ push() {}, replace() {}, prefetch() {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ isSignedIn: false, isLoaded: true }),
  useUser: () => ({ user: null, isLoaded: true, isSignedIn: false }),
  SignedIn: () => null,
  SignedOut: () => null,
  UserButton: () => null,
}));
vi.mock('@/lib/betting/client', () => ({ isBettingConfigured: () => false, betDb: () => ({}) }));

import { Designer } from './Designer';
import { LIST_COPY } from './catalogue';
import { DEFAULT_NAV, type EditableList, type NavListKey } from '@/lib/design/lists';
import { TEXT_DEFAULTS, TEXT_KEYS } from '@/lib/design/text-defaults';
import { BUILD_OPTION_DEFAULTS, BUILD_OPTION_KEYS } from '@/lib/design/build-option-defaults';
import { SETTING_KEYS, SETTING_SPECS } from '@/lib/design/setting-defaults';
import type { EditableBuildOption } from '@/lib/design/build-options';
import type { EditableSetting } from '@/lib/design/settings';
import type { PageRow } from '@/lib/design/pages';
import type { PageDetail } from '@/lib/design/page-revisions';
import { CODE_PAGES } from '@/lib/design/page-registry';

const STAMP = '2026-09-08T08:33:32.994153+00:00';
const lists: Partial<Record<NavListKey, EditableList>> = {
  doors: { key: 'doors', role: 'menu', label: LIST_COPY.doors.title, updatedAt: STAMP, entries: DEFAULT_NAV.doors },
  bar: { key: 'bar', role: 'bar', label: LIST_COPY.bar.title, updatedAt: STAMP, entries: DEFAULT_NAV.bar },
  'footer-site': { key: 'footer-site', role: 'footer', label: LIST_COPY['footer-site'].title, updatedAt: STAMP, entries: DEFAULT_NAV.footerSite },
  'footer-legal': { key: 'footer-legal', role: 'footer', label: LIST_COPY['footer-legal'].title, updatedAt: STAMP, entries: DEFAULT_NAV.footerLegal },
};
const text = TEXT_KEYS.map(key => ({ key, text: TEXT_DEFAULTS[key].text, where: TEXT_DEFAULTS[key].where, updatedAt: STAMP }));
const options: EditableBuildOption[] = BUILD_OPTION_KEYS.map(key => ({
  key,
  label: BUILD_OPTION_DEFAULTS[key].label,
  status: 'include',
  updatedAt: STAMP,
}));
const settings: EditableSetting[] = SETTING_KEYS.map(key => ({
  key,
  value: SETTING_SPECS[key].shipped,
  description: SETTING_SPECS[key].description,
  updatedAt: STAMP,
}));
const loaded = { initialLists: lists, initialText: text, initialBuildOptions: options, initialSettings: settings, series: [] };

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/admin/designer');
});

describe('Designer keeps the selection in the URL', () => {
  it('opens the overview when the URL names nothing, and writes ?sc= when an entry is chosen', () => {
    render(<Designer readOnly={false} who="Test · Administrator · production" {...loaded} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Shared Components' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /^Build Options/ })[0]);
    expect(window.location.search).toBe('?sc=build');
    expect(screen.getByRole('heading', { level: 2, name: 'Build Options' })).toBeTruthy();
  });

  it('opens the entry the page hands over, and the crumb returns to the overview and clears the URL', () => {
    window.history.replaceState(null, '', '/admin/designer?sc=settings');
    render(<Designer readOnly={false} who="Test · Administrator · production" initialSelected="settings" {...loaded} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Application Settings' })).toBeTruthy();
    // The workspace tab carries the same words; the crumb is the one with the title.
    fireEvent.click(screen.getByTitle('Back to the overview'));
    expect(window.location.search).toBe('');
    expect(screen.getByRole('heading', { level: 2, name: 'Shared Components' })).toBeTruthy();
  });

  it('opens the overview for a key the catalogue does not know', () => {
    render(<Designer readOnly={false} who="Test · Administrator · production" initialSelected="no-such-entry" {...loaded} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Shared Components' })).toBeTruthy();
  });

  it('opens the App Builder from ?ws=builder with the pages listed, and the tabs switch and write the URL', () => {
    window.history.replaceState(null, '', '/admin/designer?ws=builder');
    const pages = pagesFromCode();
    render(<Designer readOnly={false} who="Test · Administrator · production" initialWorkspace="builder" initialPages={pages} {...loaded} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Pages' })).toBeTruthy();
    expect(screen.getByText('/series/[slug]/[tab]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Shared Components' }));
    expect(window.location.search).toBe('');
    expect(screen.getByRole('heading', { level: 2, name: 'Shared Components' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'App Builder' }));
    expect(window.location.search).toBe('?ws=builder');
    expect(screen.getByRole('heading', { level: 2, name: 'Pages' })).toBeTruthy();
  });

  it('opens a page the server handed over, with its schematic, and the crumb returns to all pages', () => {
    window.history.replaceState(null, '', '/admin/designer?ws=builder&page=a1b2c3d4-0000-4000-8000-000000000010');
    const page: PageRow = {
      id: 'a1b2c3d4-0000-4000-8000-000000000010',
      path: '/history/monza',
      name: 'Monza, a history',
      kind: 'row',
      group: 'editorial',
      template: 'paddock-standard',
      authz: 'public',
      title: null,
      rendering: 'cached',
      indexable: false,
      comments: null,
      updatedAt: STAMP,
    };
    const detail: PageDetail = {
      page,
      live: null,
      newest: {
        id: 'b1b2c3d4-0000-4000-8000-000000000002',
        createdAt: STAMP,
        publishedAt: null,
        author: 'user_admin',
        base: null,
        problems: [],
        document: {
          version: 1,
          actions: [],
          regions: [{ id: 'intro', kind: 'static', title: 'Monza', position: 'body', seq: 10, column: 1, span: 8, newRow: false, hidden: false, authz: null, text: 'Opened in 1922.' }],
        },
      },
      revisions: [{ id: 'b1b2c3d4-0000-4000-8000-000000000002', createdAt: STAMP, publishedAt: null, author: 'user_admin', base: null }],
    };
    render(
      <Designer
        readOnly={false}
        who="Test · Administrator · production"
        initialWorkspace="builder"
        initialPages={[...pagesFromCode(), page]}
        initialPageId={page.id}
        initialDetail={detail}
        {...loaded}
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Monza, a history' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Static Content: Monza' })).toBeTruthy();
    expect(screen.getByText('draft')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'All pages' }));
    expect(window.location.search).toBe('?ws=builder');
    expect(screen.getByRole('heading', { level: 2, name: 'Pages' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open Monza, a history' })).toBeTruthy();
  });

  it('the Shared Components rail has a search field that narrows the catalogue, and the App Builder rail filters the pages by group', () => {
    render(<Designer readOnly={false} who="Test · Administrator · production" initialPages={pagesFromCode()} {...loaded} />);
    const rail = screen.getByRole('navigation', { name: 'Shared components' });
    expect(within(rail).getByRole('button', { name: /Build Options/ })).toBeTruthy();
    fireEvent.change(within(rail).getByLabelText('Find a component'), { target: { value: 'theme' } });
    expect(within(rail).getByRole('button', { name: /Themes/ })).toBeTruthy();
    expect(within(rail).queryByRole('button', { name: /Build Options/ })).toBeNull();
    fireEvent.change(within(rail).getByLabelText('Find a component'), { target: { value: 'zzz' } });
    expect(within(rail).getByText('Nothing in the catalogue matches.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'App Builder' }));
    const pagesRail = screen.getByRole('navigation', { name: 'Pages' });
    expect(within(pagesRail).getByText('Every page the site serves, by group. Yours are served from a revision.')).toBeTruthy();
    fireEvent.click(within(pagesRail).getByRole('button', { name: /^Editorial/ }));
    expect(screen.getByText('· Editorial')).toBeTruthy();
    expect(screen.getByText('/blog')).toBeTruthy();
    expect(screen.queryByText('/calendar')).toBeNull();
    fireEvent.click(within(pagesRail).getByRole('button', { name: /^Your pages/ }));
    expect(screen.getByText('No page of your own yet. Create page starts one from a template.')).toBeTruthy();
    fireEvent.click(within(pagesRail).getByRole('button', { name: /^All pages/ }));
    expect(screen.getByText('/calendar')).toBeTruthy();
  });

  it('Create page opens the dialog: a template is chosen, then the page is named; a code-owned path is refused before anything is sent', () => {
    window.history.replaceState(null, '', '/admin/designer?ws=builder');
    render(<Designer readOnly={false} who="Test · Administrator · production" initialWorkspace="builder" initialPages={pagesFromCode()} {...loaded} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Create page' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Choose a template' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: /^like a blog post/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(dialog).getByRole('button', { name: /^like the Privacy page/ }));
    expect(within(dialog).getByRole('button', { name: /^like the Privacy page/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Name the page' })).toBeTruthy();
    expect((within(dialog).getByLabelText('Group of the new page') as HTMLSelectElement).value).toBe('site');
    fireEvent.change(within(dialog).getByLabelText('Name of the new page'), { target: { value: 'Monza results' } });
    fireEvent.change(within(dialog).getByLabelText('Path of the new page'), { target: { value: '/series/monza' } });
    expect(within(dialog).getByText('the code already serves /series/[slug]')).toBeTruthy();
    expect((within(dialog).getByRole('button', { name: 'Create page' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText('Path of the new page'), { target: { value: '/history/monza' } });
    expect(within(dialog).getByText('ready')).toBeTruthy();
    expect((within(dialog).getByRole('button', { name: 'Create page' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

/** The registry as the server would hand it over when no row exists yet. */
function pagesFromCode(): PageRow[] {
  return CODE_PAGES.map(c => ({
    id: null,
    path: c.path,
    name: c.name,
    kind: 'code',
    group: c.group,
    template: 'paddock-standard',
    authz: c.authz,
    title: null,
    rendering: c.rendering,
    indexable: c.indexable,
    comments: c.note ?? null,
    updatedAt: null,
  }));
}
