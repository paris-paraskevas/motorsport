// @vitest-environment jsdom
//
// The Page Designer's behaviour: the three panes open on the newest revision,
// a region is added from the gallery, selected and edited in the Property
// Editor, the parser holds Save with the reasons in Messages, Save and Publish
// post to the one write path with the right base and the attributes save with
// them, a stale publish shows the conflict, a shortcut lands at the cursor,
// Save and Run Page opens the preview, undo and redo walk the working copy,
// the keyboard set switches panes, and a page the code serves edits its
// attributes alone.

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
function serve(over: Partial<Record<'PUT' | 'POST' | 'GET', () => unknown>> = {}) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (over[method as 'PUT' | 'POST' | 'GET']) return over[method as 'PUT' | 'POST' | 'GET']!();
    if (method === 'PUT') return json(200, { ok: true, page: { ...page, updatedAt: '2026-09-08T19:00:00+00:00' } });
    if (method === 'POST') return json(200, { revision: { id: R3 } });
    return json(200, { ...detail, newest: { ...detail.newest!, id: R3 }, revisions: [{ id: R3, createdAt: '2026-09-08T19:00:00Z', publishedAt: null, author: 'user_admin', base: R2 }, ...detail.revisions] });
  });
}

function mount(d: PageDetail = detail, readOnly = false) {
  const onSaved = vi.fn();
  const onOpenPage = vi.fn();
  const onBack = vi.fn();
  render(
    <PageDesigner
      detail={d}
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
    />,
  );
  return { onSaved, onOpenPage, onBack };
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

  it('Save and Run Page opens the newest revision when nothing changed, and saves a draft first when something did', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Save and Run Page' }));
    expect(openMock).toHaveBeenCalledWith(`/preview/${R2}`, '_blank', 'noopener');
    fireEvent.click(tile('List: Elsewhere'));
    fireEvent.click(within(screen.getByRole('group', { name: 'Region list style' })).getByRole('button', { name: 'Cards' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save and Run Page' }));
    await waitFor(() => expect(openMock).toHaveBeenCalledWith(`/preview/${R3}`, '_blank', 'noopener'));
    expect(calls.find(c => c.method === 'POST')!.body).toMatchObject({ action: 'draft', base: R2 });
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

  it('a page the code serves shows its body as served by the code, keeps the gallery inert and saves its attributes alone', async () => {
    const { onSaved } = mount({ page: codePage, live: null, newest: null, revisions: [] });
    expect(screen.getByText('Served by the code')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gallery: Static Content' }).getAttribute('aria-disabled')).toBe('true');
    expect((screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Page title'), { target: { value: 'Race calendar 2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls.find(c => c.method === 'PUT')!.url).toBe(`/api/admin/design/pages/${codePage.id}`);
    expect(calls.some(c => c.method === 'POST')).toBe(false);
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
});
