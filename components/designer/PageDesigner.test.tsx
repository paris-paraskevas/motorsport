// @vitest-environment jsdom
//
// The Page Designer's behaviour: the three panes open on the newest revision,
// a region is added from the gallery, selected and edited in the Property
// Editor, the parser holds Save with the reasons in Messages, Save and Publish
// post to the one write path with the right base and the attributes save with
// them, a stale publish shows the conflict, a shortcut lands at the cursor,
// Save and Run Page publishes and opens the working tab, undo and redo walk the working copy,
// the keyboard set switches panes, and a page the code serves takes regions
// around its body.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageDesigner } from './PageDesigner';
import type { PageDetail } from '@/lib/design/page-revisions';
import type { PageDocument, Region } from '@/lib/design/page-document';
import type { PageRow } from '@/lib/design/pages';
import type { EditableAsset } from '@/lib/design/assets';

const STAMP = '2026-09-08T16:00:00.505502+00:00';
const R1 = 'b1b2c3d4-0000-4000-8000-000000000001';
const R2 = 'b1b2c3d4-0000-4000-8000-000000000002';
const R3 = 'b1b2c3d4-0000-4000-8000-000000000003';
const ASSET = 'c1b2c3d4-0000-4000-8000-000000000031';
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
const codePage: PageRow = { ...page, id: 'c0de0002-0000-4000-8000-000000000002', path: '/calendar', name: 'Calendar', kind: 'code', group: 'calendar', indexable: true };
const doc: PageDocument = {
  version: 1,
  actions: [],
  regions: [
    { id: 'intro', kind: 'static', title: 'A century of speed', position: 'body', seq: 10, column: 1, span: 8, newRow: true, hidden: false, authz: null, text: 'Opened in 1922.' },
    { id: 'more', kind: 'list', title: 'Elsewhere', position: 'right', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, listKey: 'footer-site', style: 'links' },
  ],
};
const detail: PageDetail = {
  page,
  live: { id: R1, createdAt: '2026-09-08T17:10:00Z', publishedAt: '2026-09-08T17:10:00Z', author: 'user_admin', base: null },
  newest: { id: R2, createdAt: '2026-09-08T18:42:00Z', publishedAt: null, author: 'user_admin', base: R1, problems: [], document: doc },
  revisions: [
    { id: R2, createdAt: '2026-09-08T18:42:00Z', publishedAt: null, author: 'user_admin', base: R1 },
    { id: R1, createdAt: '2026-09-08T17:10:00Z', publishedAt: '2026-09-08T17:10:00Z', author: 'user_admin', base: null },
  ],
};
const assets: EditableAsset[] = [
  { id: ASSET, key: '2026/09/photo.jpg', url: '/media/2026/09/photo.jpg', caption: 'The banking', credit: 'P. Paraskevas', licence: 'CC BY 4.0', width: 1200, height: 800, bytes: 1000, contentType: 'image/jpeg', createdAt: STAMP, updatedAt: STAMP },
];
const lists = [
  { key: 'doors', label: 'Navigation Menu' },
  { key: 'bar', label: 'Navigation Bar List' },
  { key: 'footer-site', label: 'Footer, site' },
  { key: 'footer-legal', label: 'Footer, legal' },
];
const listCounts = { doors: 4, bar: 4, 'footer-site': 5, 'footer-legal': 4 };
const shortcuts = [{ key: 'times.local', text: 'All times are shown in your local time zone.', updatedAt: STAMP }];
const pages = [page, codePage];

const fetchMock = vi.fn();
const openMock = vi.fn();
type Call = { url: string; method: string; body: unknown };
let calls: Call[] = [];
const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });

/** Answers every route the designer calls; `over` replaces one method's answer. */
type Method = 'PUT' | 'POST' | 'GET' | 'DELETE';
function serve(over: Partial<Record<Method, () => unknown>> = {}) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET') as Method;
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (over[method]) return over[method]!();
    if (method === 'DELETE') return json(200, { ok: true, id: page.id, path: page.path });
    if (method === 'PUT') return json(200, { ok: true, page: { ...page, updatedAt: '2026-09-08T19:00:00+00:00' } });
    if (method === 'POST') return json(200, { revision: { id: R3 } });
    return json(200, { ...detail, newest: { ...detail.newest!, id: R3 }, revisions: [{ id: R3, createdAt: '2026-09-08T19:00:00Z', publishedAt: null, author: 'user_admin', base: R2 }, ...detail.revisions] });
  });
}

function mount(d: PageDetail = detail, readOnly = false) {
  const onSaved = vi.fn();
  const onOpenPage = vi.fn();
  const onBack = vi.fn();
  const onDeleted = vi.fn();
  const el = (dd: PageDetail) => (
    <PageDesigner
      onDeleted={onDeleted}
      detail={dd}
      pages={pages}
      readOnly={readOnly}
      lists={lists}
      listCounts={listCounts}
      assets={assets}
      shortcuts={shortcuts}
      onSaved={onSaved}
      onOpenPage={onOpenPage}
      onBack={onBack}
      onWorkspace={vi.fn()}
      onCreated={vi.fn()}
    />
  );
  const utils = render(el(d));
  /** The shell hands the reloaded detail back after a save: the designer re-renders on it. */
  const rerender = (dd: PageDetail) => utils.rerender(el(dd));
  return { onSaved, onOpenPage, onBack, onDeleted, rerender };
}
const tile = (name: string) => screen.getByRole('button', { name });
const status = () => screen.getByRole('status').textContent ?? '';

beforeEach(() => {
  calls = [];
  fetchMock.mockReset();
  serve();
  vi.stubGlobal('fetch', fetchMock);
  openMock.mockReset();
  vi.stubGlobal('open', openMock);
  if (!window.requestAnimationFrame) vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('PageDesigner', () => {
  it('opens on the newest revision: the toolbar, the tree, the Layout tiles and the page in the Property Editor', () => {
    mount();
    expect(screen.getByLabelText('Page Designer')).toBeTruthy();
    expect(screen.getByLabelText('Page number')).toHaveProperty('value', 'a1b2c3d4');
    expect(screen.getByText('Monza, a history', { selector: 'span' })).toBeTruthy();
    expect(within(screen.getByRole('tree', { name: 'Rendering' })).getByText('Page a1b2c3d4: Monza, a history')).toBeTruthy();
    expect(tile('Static Content: A century of speed')).toBeTruthy();
    expect(tile('List: Elsewhere')).toBeTruthy();
    expect(within(screen.getByLabelText('Property Editor')).getByText('a1b2c3d4: Monza, a history')).toBeTruthy();
    expect(status()).toMatch(/Revision b1b2c3d4 · draft/);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('adds a region from the gallery, selects it, edits it in the Property Editor, and Save comes alive', () => {
    mount();
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Gallery: Static Content' }));
    expect(tile('Static Content: text-1')).toBeTruthy();
    const pe = screen.getByLabelText('Property Editor');
    expect(within(pe).getByText('Static Content', { selector: 'span' })).toBeTruthy();
    expect((within(pe).getByLabelText('Region id') as HTMLInputElement).value).toBe('text-1');
    fireEvent.change(screen.getByLabelText('Region title'), { target: { value: 'Winners by decade' } });
    expect(tile('Static Content: Winners by decade')).toBeTruthy();
    fireEvent.click(within(screen.getByRole('group', { name: 'Region span' })).getByRole('button', { name: 'Half · 6' }));
    expect(within(screen.getByRole('group', { name: 'Region span' })).getByRole('button', { name: 'Half · 6' }).getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false);
    expect(status()).toMatch(/Column Span 6/);
  });

  it('gives a region Header Text, Footer Text and a Build Option in their own groups, closed until opened (P1.3)', () => {
    mount();
    fireEvent.click(tile('Static Content: A century of speed'));
    const pe = screen.getByLabelText('Property Editor');
    expect(within(pe).queryByLabelText('Region header text')).toBeNull();
    fireEvent.click(within(pe).getByRole('button', { name: 'Header and Footer' }));
    fireEvent.change(within(pe).getByLabelText('Region header text'), { target: { value: 'Above · {shortcut:times.local}' } });
    expect(status()).toMatch(/Header Text updated/);
    fireEvent.change(within(pe).getByLabelText('Region footer text'), { target: { value: 'Below' } });
    expect(status()).toMatch(/Footer Text updated/);
    fireEvent.click(within(pe).getByRole('button', { name: 'Configuration' }));
    const pills = within(pe).getByRole('group', { name: 'Region build option' });
    expect(within(pills).getByRole('button', { name: 'None' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(pills).getByRole('button', { name: 'Weather' }));
    expect(within(pills).getByRole('button', { name: 'Weather' }).getAttribute('aria-pressed')).toBe('true');
    expect(status()).toMatch(/Build Option: Weather/);
    fireEvent.click(within(pills).getByRole('button', { name: 'None' }));
    expect(status()).toMatch(/Build Option cleared/);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false);
    // A group the person opened stays open across selections: another region, then back.
    fireEvent.click(tile('List: Elsewhere'));
    expect((within(pe).getByLabelText('Region header text') as HTMLInputElement).value).toBe('');
    fireEvent.click(tile('Static Content: A century of speed'));
    expect((within(pe).getByLabelText('Region header text') as HTMLInputElement).value).toBe('Above · {shortcut:times.local}');
    expect((within(pe).getByLabelText('Region footer text') as HTMLInputElement).value).toBe('Below');
  });

  // Walks the Utilities menu: a submenu row, then its item (a checkable one is a menuitemcheckbox).
  // An entry's accessible name starts with its label; a sub or a shortcut may follow it.
  const startsWith = (label: string) => (name: string) => name === label || name.startsWith(label);
  const menuEntry = (label: string) => screen.queryByRole('menuitem', { name: startsWith(label) }) ?? screen.getByRole('menuitemcheckbox', { name: startsWith(label) });
  const utilities = (...path: string[]) => {
    fireEvent.click(screen.getByRole('button', { name: /Utilities/ }));
    for (const name of path) fireEvent.click(menuEntry(name));
  };
  const LAYOUT_KEY = 'paddock-developer.page-designer';

  it('Utilities › Layout: Two Pane Mode hides the left pane, Three Pane Mode brings it back, the mode is remembered, Reset Layout returns to three panes (P1.5)', () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify({ paneMode: 'two', lw: '300px' }));
    mount();
    expect(screen.queryByRole('tablist', { name: 'Left pane' })).toBeNull();
    utilities('Layout', 'Three Pane Mode');
    expect(screen.getByRole('tablist', { name: 'Left pane' })).toBeTruthy();
    utilities('Layout', 'Two Pane Mode');
    expect(screen.queryByRole('tablist', { name: 'Left pane' })).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(LAYOUT_KEY) ?? '{}').paneMode).toBe('two');
    // The submenu opens from the keyboard too: ArrowRight in, ArrowLeft out.
    fireEvent.click(screen.getByRole('button', { name: /Utilities/ }));
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Layout' }), { key: 'ArrowRight' });
    expect(screen.getByRole('menuitemcheckbox', { name: 'Two Pane Mode' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(screen.getByRole('menuitemcheckbox', { name: 'Two Pane Mode' }), { key: 'ArrowLeft' });
    expect(screen.queryByRole('menuitemcheckbox', { name: 'Two Pane Mode' })).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    utilities('Layout', 'Reset Layout');
    expect(screen.getByRole('tablist', { name: 'Left pane' })).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(LAYOUT_KEY) ?? '{}').paneMode ?? 'three').toBe('three');
    expect(JSON.parse(window.localStorage.getItem(LAYOUT_KEY) ?? '{}').lw).toBeUndefined();
    window.localStorage.clear();
  });

  it('Utilities › Show: Tooltips off drops the hover tips; Layout View off removes the Layout tab and lands on Component View, on again returns to it (P1.5)', () => {
    mount();
    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('title')).toBe('Save (Alt+F7)');
    utilities('Show', 'Tooltips');
    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('title')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Layout' }).getAttribute('aria-selected')).toBe('true');
    utilities('Show', 'Layout View');
    expect(screen.queryByRole('tab', { name: 'Layout' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Component View' }).getAttribute('aria-selected')).toBe('true');
    utilities('Show', 'Layout View');
    expect(screen.getByRole('tab', { name: 'Layout' }).getAttribute('aria-selected')).toBe('true');
    // Reset Layout is Layout's: the Show toggles survive it.
    utilities('Layout', 'Two Pane Mode');
    utilities('Layout', 'Reset Layout');
    expect(JSON.parse(window.localStorage.getItem(LAYOUT_KEY) ?? '{}')).toEqual({ tooltips: false, layoutView: true });
    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('title')).toBeNull();
    window.localStorage.clear();
  });

  it('the Layout tab: Display from Here shows the selected region alone and Display from Page returns; Expand hides both side panes and Restore brings them back (P1.5)', () => {
    mount();
    fireEvent.click(tile('Static Content: A century of speed'));
    fireEvent.click(screen.getByRole('button', { name: 'Layout ▾' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Display from Here/ }));
    expect(tile('Static Content: A century of speed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'List: Elsewhere' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Layout ▾' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Display from Page' }));
    expect(tile('List: Elsewhere')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Expand the Layout tab' }));
    expect(screen.queryByRole('tablist', { name: 'Left pane' })).toBeNull();
    expect(screen.queryByLabelText('Property Editor')).toBeNull();
    expect(tile('List: Elsewhere')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Restore the panes' }));
    expect(screen.getByRole('tablist', { name: 'Left pane' })).toBeTruthy();
    expect(screen.getByLabelText('Property Editor')).toBeTruthy();
  });

  it('the Gallery: right-click a tile, Add To, a position: the region lands there (P1.5)', () => {
    mount();
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Gallery: Static Content' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add To' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Footer' }));
    expect(tile('Static Content: text-1')).toBeTruthy();
    expect(status()).toMatch(/Static Content created/);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false);
    const pe = screen.getByLabelText('Property Editor');
    expect(within(within(pe).getByRole('group', { name: 'Region position' })).getByRole('button', { name: 'Footer' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('Ctrl+click selects two regions; the Property Editor shows their common attributes, and Position moves both (P1.6)', () => {
    mount();
    fireEvent.click(tile('Static Content: A century of speed'));
    fireEvent.click(tile('List: Elsewhere'), { ctrlKey: true });
    const pe = screen.getByLabelText('Property Editor');
    expect(within(pe).getByText('2 selected')).toBeTruthy();
    expect(within(pe).queryByLabelText('Region title')).toBeNull();
    // The common groups alone: Layout, Rules, Security, Configuration; no Identification or Source.
    for (const g of ['Layout', 'Rules', 'Security', 'Configuration']) expect(within(pe).getByRole('button', { name: g })).toBeTruthy();
    expect(within(pe).queryByRole('button', { name: 'Identification' })).toBeNull();
    expect(within(pe).queryByRole('button', { name: 'Source' })).toBeNull();
    expect(tile('Static Content: A century of speed').getAttribute('aria-pressed')).toBe('true');
    expect(tile('List: Elsewhere').getAttribute('aria-pressed')).toBe('true');
    // Body and Right Side Column differ: no pill pressed, the note says so.
    const where = within(pe).getByRole('group', { name: 'Region position' });
    expect(within(where).queryAllByRole('button', { pressed: true })).toHaveLength(0);
    expect(within(pe).getByText(/^Mixed/)).toBeTruthy();
    fireEvent.click(within(where).getByRole('button', { name: 'Footer' }));
    expect(status()).toMatch(/Position: Footer/);
    expect(within(where).getByRole('button', { name: 'Footer' }).getAttribute('aria-pressed')).toBe('true');
    // Each alone: both sit in the Footer.
    fireEvent.click(tile('Static Content: A century of speed'));
    expect(within(within(pe).getByRole('group', { name: 'Region position' })).getByRole('button', { name: 'Footer' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(tile('List: Elsewhere'));
    expect(within(within(pe).getByRole('group', { name: 'Region position' })).getByRole('button', { name: 'Footer' }).getAttribute('aria-pressed')).toBe('true');
    // Ctrl+click on a member takes it out again; Delete removes a whole set.
    fireEvent.click(tile('Static Content: A century of speed'), { ctrlKey: true });
    expect(within(pe).getByText('2 selected')).toBeTruthy();
    fireEvent.click(tile('List: Elsewhere'), { ctrlKey: true });
    expect(within(pe).getByText('A century of speed')).toBeTruthy();
    fireEvent.click(tile('List: Elsewhere'), { ctrlKey: true });
    fireEvent.keyDown(document, { key: 'Delete' });
    expect(screen.queryByRole('button', { name: 'List: Elsewhere' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Static Content: A century of speed' })).toBeNull();
    expect(status()).toMatch(/2 regions deleted/);
  });

  it('a changed attribute carries the marker until Save; the reloaded detail clears it (P1.6)', async () => {
    const savedPage = { ...page, title: 'Monza, a history of speed', updatedAt: '2026-09-08T19:00:00+00:00' };
    serve({ GET: () => json(200, { ...detail, page: savedPage, newest: { ...detail.newest!, id: R3, document: (calls.find(c => c.method === 'POST')!.body as { document: PageDocument }).document } }) });
    const { onSaved, rerender } = mount();
    const pe = screen.getByLabelText('Property Editor');
    const markers = () => within(pe).queryAllByRole('img', { name: 'Changed since the last save' });
    expect(markers()).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Page title'), { target: { value: 'Monza, a history of speed' } });
    expect(screen.getByLabelText('Page title').closest('[data-changed]')).not.toBeNull();
    expect(markers()).toHaveLength(1);
    fireEvent.click(tile('Static Content: A century of speed'));
    expect(markers()).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Region title'), { target: { value: 'Winners by decade' } });
    expect(screen.getByLabelText('Region title').closest('[data-changed]')).not.toBeNull();
    expect(screen.getByLabelText('Region text').closest('[data-changed]')).toBeNull();
    expect(markers()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    rerender(onSaved.mock.calls[0][0] as PageDetail);
    expect((screen.getByLabelText('Region title') as HTMLInputElement).value).toBe('Winners by decade');
    expect(markers()).toHaveLength(0);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect((screen.getByLabelText('Page title') as HTMLInputElement).value).toBe('Monza, a history of speed');
    expect(markers()).toHaveLength(0);
  });

  it('holds Save when the parser refuses the document, and Messages says why', () => {
    mount();
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Gallery: Image' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(status()).toMatch(/Not saved: 1 error/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: /^Messages/, selected: true })).toBeTruthy();
    fireEvent.click(screen.getByText('region photo-1: the image must name one of your photos'));
    expect(within(screen.getByLabelText('Property Editor')).getByLabelText('Region photo')).toBeTruthy();
  });

  it('Save posts a draft on the newest revision and reloads; Publish posts on the live one', async () => {
    const { onSaved } = mount();
    fireEvent.change(screen.getByLabelText('Filter the tree'), { target: { value: '' } });
    fireEvent.click(tile('Static Content: A century of speed'));
    fireEvent.change(screen.getByLabelText('Region text'), { target: { value: 'Opened in September 1922.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const post = calls.find(c => c.method === 'POST')!;
    expect(post.url).toBe(`/api/admin/design/pages/${page.id}/revisions`);
    expect(post.body).toMatchObject({ action: 'draft', base: R2 });
    expect((post.body as { document: PageDocument }).document.regions.find((r: Region) => r.id === 'intro')).toMatchObject({ text: 'Opened in September 1922.' });
    expect(calls.some(c => c.method === 'GET' && c.url === `/api/admin/design/pages/${page.id}`)).toBe(true);
    expect(status()).toMatch(/saved · draft b1b2c3d4/);

    calls = [];
    cleanup();
    const second = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(second.onSaved).toHaveBeenCalled());
    expect(calls.find(c => c.method === 'POST')!.body).toMatchObject({ action: 'publish', base: R1 });
    expect(status()).toMatch(/Published/);
  });

  it('saves the page attributes with the same Save, through their own route', async () => {
    const { onSaved } = mount();
    fireEvent.change(screen.getByLabelText('Page title'), { target: { value: 'Monza, a history of speed' } });
    fireEvent.click(within(screen.getByRole('group', { name: 'Page authorization' })).getByRole('button', { name: 'Signed in' }));
    expect(within(screen.getByLabelText('Property Editor')).queryByText('No · public with account')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const put = calls.find(c => c.method === 'PUT')!;
    expect(put.url).toBe(`/api/admin/design/pages/${page.id}`);
    expect(put.body).toEqual({ name: 'Monza, a history', title: 'Monza, a history of speed', group: 'editorial', authz: 'signed_in', indexable: false, comments: null, updatedAt: STAMP });
    expect(calls.some(c => c.method === 'POST')).toBe(false);
  });

  it('shows the conflict when a publish is stale, and Reload hands the stored detail back', async () => {
    const current: PageDetail = { ...detail, live: { ...detail.live!, id: R3 }, revisions: detail.revisions };
    serve({ POST: () => json(409, { error: 'stale', current }) });
    const { onSaved } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('This page was saved again after you loaded it')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reload' }));
    expect(onSaved).toHaveBeenCalledWith(current);
  });

  it('inserts a shortcut into the text at the cursor', () => {
    mount();
    fireEvent.click(tile('Static Content: A century of speed'));
    const text = screen.getByLabelText('Region text') as HTMLTextAreaElement;
    text.setSelectionRange(text.value.length, text.value.length);
    fireEvent.click(screen.getByRole('button', { name: 'times.local' }));
    expect((screen.getByLabelText('Region text') as HTMLTextAreaElement).value).toBe('Opened in 1922.{shortcut:times.local}');
  });

  it('Save and Run Page publishes what is unpublished and opens the live page in the one working tab (R5)', async () => {
    const { onSaved } = mount();
    // The newest revision is a draft: Run publishes it on the live one, then opens the page.
    fireEvent.click(screen.getByRole('button', { name: 'Save and Run Page' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls.find(c => c.method === 'POST')!.body).toMatchObject({ action: 'publish', base: R1 });
    expect(openMock).toHaveBeenCalledWith(expect.stringMatching(/\/history\/monza$/), 'paddock-run');
    expect(status()).toMatch(/Published/);
    // A change after: published again, into the same tab.
    calls = [];
    fireEvent.click(tile('List: Elsewhere'));
    fireEvent.click(within(screen.getByRole('group', { name: 'Region list style' })).getByRole('button', { name: 'Cards' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save and Run Page' }));
    await waitFor(() => expect(openMock).toHaveBeenCalledTimes(2));
    expect(calls.find(c => c.method === 'POST')!.body).toMatchObject({ action: 'publish' });
    expect(openMock.mock.calls[1][1]).toBe('paddock-run');
    // Nothing unpublished and nothing changed: the page opens, nothing is posted.
    cleanup();
    calls = [];
    openMock.mockReset();
    mount({ ...detail, newest: { ...detail.newest!, id: R1, publishedAt: '2026-09-08T17:10:00Z' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and Run Page' }));
    expect(calls.some(c => c.method === 'POST')).toBe(false);
    expect(openMock).toHaveBeenCalledWith(expect.stringMatching(/\/history\/monza$/), 'paddock-run');
    // A page the code serves with no revision yet and nothing changed: it runs as it is, nothing is published.
    cleanup();
    calls = [];
    openMock.mockReset();
    mount({ page: codePage, live: null, newest: null, revisions: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Save and Run Page' }));
    expect(calls.some(c => c.method === 'POST')).toBe(false);
    expect(openMock).toHaveBeenCalledWith(expect.stringMatching(/\/calendar$/), 'paddock-run');
  });

  it('a Layout tile drags from any part of it onto a yellow target; the drop tiles appear one task after dragstart, never inside it (R5, R5b)', async () => {
    mount();
    const dataTransfer = { setData: vi.fn(), effectAllowed: 'move' };
    fireEvent.dragStart(tile('List: Elsewhere'), { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'more');
    // Chromium aborts a drag whose source's DOM changes during dragstart: nothing is drawn inside the handler.
    expect(screen.queryByRole('button', { name: 'Drop here: Region · Footer' })).toBeNull();
    const target = await screen.findByRole('button', { name: 'Drop here: Region · Footer' });
    fireEvent.drop(target, { dataTransfer });
    expect(status()).toMatch(/Elsewhere moved/);
    fireEvent.click(tile('List: Elsewhere'));
    expect(within(within(screen.getByLabelText('Property Editor')).getByRole('group', { name: 'Region position' })).getByRole('button', { name: 'Footer' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('the Column, Size and Column Span pills offer only the free columns of the row; an overlap holds Save with the reason (R5)', () => {
    const twoUp: PageDocument = {
      ...doc,
      regions: [
        { ...doc.regions[0], id: 'left', title: 'Left', span: 6 },
        { ...doc.regions[0], id: 'right', title: 'Right', seq: 20, column: 7, span: 6, newRow: false },
      ],
    };
    mount({ ...detail, newest: { ...detail.newest!, document: twoUp } });
    fireEvent.click(tile('Static Content: Right'));
    const pe = screen.getByLabelText('Property Editor');
    expect(within(within(pe).getByRole('group', { name: 'Region column' })).getAllByRole('button').map(b => b.textContent)).toEqual(['7']);
    const size = within(pe).getByRole('group', { name: 'Region size' });
    expect((within(size).getByRole('button', { name: 'Large' }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(size).getByRole('button', { name: 'Mid' }) as HTMLButtonElement).disabled).toBe(false);
    expect(within(within(pe).getByRole('group', { name: 'Region span' })).getAllByRole('button').map(b => b.textContent)).toEqual(['Half · 6', 'Third · 4', 'Quarter · 3']);
    fireEvent.click(tile('Static Content: Left'));
    expect(within(within(pe).getByRole('group', { name: 'Region column' })).getAllByRole('button').map(b => b.textContent)).toEqual(['1']);
    // A stored overlap: the error names both regions and holds Save.
    cleanup();
    mount({ ...detail, newest: { ...detail.newest!, document: { ...twoUp, regions: [twoUp.regions[0], { ...twoUp.regions[1], column: 1 }] } } });
    fireEvent.click(tile('Static Content: Right'));
    fireEvent.change(screen.getByLabelText('Region title'), { target: { value: 'Right, renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(status()).toMatch(/Not saved: 1 error/);
    expect(screen.getByText('Right, renamed overlaps Left on one row (columns 1 to 6). Move it, or start a new row.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('undoes and redoes the working copy, and the keyboard set switches the panes', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Buttons' }));
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Gallery: Button' }));
    expect(tile('Button: Read more')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('button', { name: 'Button: Read more' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(tile('Button: Read more')).toBeTruthy();
    fireEvent.keyDown(document, { key: '2', altKey: true });
    expect(screen.getByRole('tab', { name: 'Dynamic Actions', selected: true })).toBeTruthy();
    fireEvent.keyDown(document, { key: '1', altKey: true });
    expect(screen.getByRole('tab', { name: 'Rendering', selected: true })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'F1', altKey: true });
    expect(screen.getByRole('tab', { name: 'Help', selected: true })).toBeTruthy();
    fireEvent.keyDown(document, { key: '5', altKey: true });
    expect(screen.getByRole('tab', { name: 'Layout', selected: true })).toBeTruthy();
    fireEvent.click(tile('Button: Read more'));
    fireEvent.keyDown(document, { key: 'Delete' });
    expect(screen.queryByRole('button', { name: 'Button: Read more' })).toBeNull();
    fireEvent.click(tile('List: Elsewhere'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(within(screen.getByLabelText('Property Editor')).getByText('a1b2c3d4: Monza, a history')).toBeTruthy();
  });

  it('creates a dynamic action from the tree and edits it in the Property Editor', () => {
    mount();
    fireEvent.keyDown(document, { key: '2', altKey: true });
    fireEvent.click(screen.getByRole('button', { name: '＋ Create Dynamic Action' }));
    const pe = screen.getByLabelText('Property Editor');
    expect(within(pe).getByText('Dynamic Action')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name of action-1'), { target: { value: 'Unfold' } });
    expect(within(screen.getByRole('tree', { name: 'Dynamic Actions' })).getByText('Unfold')).toBeTruthy();
    fireEvent.click(within(pe).getByRole('button', { name: /^TRUE · Toggle visibility/ }));
    expect(within(pe).getByText(/TRUE Action/)).toBeTruthy();
    expect(screen.getByLabelText('Region of effect 1 of action-1')).toBeTruthy();
  });

  it('a page whose body the code still draws opens with that body as one component tile, takes a region in the Body beside it, and saves attributes and draft together', async () => {
    const { onSaved } = mount({ page: codePage, live: null, newest: null, revisions: [] });
    expect(tile('Component: Body as the code draws it')).toBeTruthy();
    expect(screen.queryByText('Served by the code')).toBeNull();
    expect((screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Page title'), { target: { value: 'Race calendar 2026' } });
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Gallery: Static Content' }));
    expect(tile('Static Content: text-1')).toBeTruthy();
    const where = screen.getByRole('group', { name: 'Region position' });
    expect(within(where).getByRole('button', { name: 'Body' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(where).queryByRole('button', { name: 'Right Side Column' })).toBeNull();
    // The Components gallery offers Home's pieces to any page, and not the transitional body a second time.
    fireEvent.click(within(screen.getByLabelText('Gallery')).getByRole('button', { name: 'Components' }));
    expect(screen.getByRole('button', { name: 'Gallery: The wire' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gallery: Body as the code draws it' })).toBeNull();
    fireEvent.click(tile('Component: Body as the code draws it'));
    expect(within(screen.getByLabelText('Property Editor')).getByText(/The page’s body as its code writes it today/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls.find(c => c.method === 'PUT')!.url).toBe(`/api/admin/design/pages/${codePage.id}`);
    const posted = calls.find(c => c.method === 'POST')!;
    expect(posted.url).toBe(`/api/admin/design/pages/${codePage.id}/revisions`);
    const body = posted.body as { action: string; base: unknown; document: PageDocument };
    expect(body.action).toBe('draft');
    expect(body.base).toBeNull();
    // The transitional body is written explicitly once the page is saved, first in the Body, the new region after it.
    expect(body.document.regions.map(r => `${r.position}:${r.kind}`)).toEqual(['body:component', 'body:static']);
  });

  it('Home splits into its six components from the transitional body’s Until split, and the draft is written with them', async () => {
    const home: PageRow = { ...codePage, id: 'c0de0001-0000-4000-8000-000000000001', path: '/', name: 'Home', group: 'home' };
    const { onSaved } = mount({ page: home, live: null, newest: null, revisions: [] });
    fireEvent.click(tile('Component: Body as the code draws it'));
    fireEvent.click(screen.getByRole('button', { name: 'Split into 6 components' }));
    expect(screen.queryByRole('button', { name: 'Component: Body as the code draws it' })).toBeNull();
    for (const name of ['Lead story', 'This weekend', 'Latest result', 'What it changed', 'What’s next', 'The wire']) expect(tile(`Component: ${name}`)).toBeTruthy();
    expect(status()).toMatch(/Split into components/);
    // The wire's settings render as controls from its spec, under the Attributes tab (APEX: Region · Attributes, P1.6); a region without settings has no tabs.
    fireEvent.click(tile('Component: The wire'));
    const pe = screen.getByLabelText('Property Editor');
    expect(within(pe).queryByLabelText('Items')).toBeNull();
    fireEvent.click(within(pe).getByRole('tab', { name: 'Attributes' }));
    expect((within(pe).getByLabelText('Items') as HTMLInputElement).value).toBe('5');
    fireEvent.click(tile('Component: This weekend'));
    expect(within(pe).queryByRole('tablist', { name: 'Property Editor tabs' })).toBeNull();
    fireEvent.click(tile('Component: The wire'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const posted = calls.find(c => c.method === 'POST')!;
    const body = posted.body as { document: PageDocument };
    expect(body.document.regions.map(r => (r.kind === 'component' ? r.component : r.kind))).toEqual(['home.lead', 'home.live', 'home.result', 'home.changed', 'home.next', 'home.wire']);
  });

  it('is read-only on a preview Worker: nothing saves, the tiles still select', () => {
    mount(detail, true);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    expect(status()).toMatch(/Read-only here/);
    fireEvent.click(tile('List: Elsewhere'));
    expect((screen.getByLabelText('Region title') as HTMLInputElement).disabled).toBe(true);
  });

  it('the page stepper and the finder open other pages; the back arrow returns to the list', () => {
    const { onOpenPage, onBack } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onOpenPage).toHaveBeenCalledWith(codePage.id);
    fireEvent.click(screen.getByRole('button', { name: 'Page Finder' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Calendar'));
    expect(onOpenPage).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Back to all pages' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('the finder searches by number, name and path, and Recently edited keeps the stamped pages', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Page Finder' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Monza, a history')).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('Search pages'), { target: { value: '/cal' } });
    expect(within(dialog).getByText('Calendar')).toBeTruthy();
    expect(within(dialog).queryByText('Monza, a history')).toBeNull();
    fireEvent.change(within(dialog).getByLabelText('Search pages'), { target: { value: 'c0de0002' } });
    expect(within(dialog).getByText('Calendar')).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('Search pages'), { target: { value: 'nothing like this' } });
    expect(within(dialog).getByText('No page matches.')).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('Search pages'), { target: { value: '' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Recently edited' }));
    expect(within(dialog).getByRole('button', { name: 'Recently edited' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(dialog).getByText('Monza, a history')).toBeTruthy();
    expect(within(dialog).getByText('Calendar')).toBeTruthy();
  });

  it('Delete Page asks first, deletes through the route and hands the id back; a page the code serves cannot be deleted', async () => {
    const { onDeleted } = mount();
    fireEvent.click(screen.getByRole('button', { name: /Utilities/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete Page/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete Page')).toBeTruthy();
    expect(within(dialog).getByText(/2 revisions are removed/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete this page' }));
    await waitFor(() => expect(calls.some(c => c.method === 'DELETE' && c.url === `/api/admin/design/pages/${page.id}`)).toBe(true));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(page.id));
    cleanup();
    mount({ ...detail, page: codePage });
    fireEvent.click(screen.getByRole('button', { name: /Utilities/ }));
    const entry = screen.getByRole('menuitem', { name: /Delete Page/ }) as HTMLButtonElement;
    expect(entry.disabled).toBe(true);
    expect(entry.textContent).toMatch(/the route file is still in the code/);
  });
});
