// @vitest-environment jsdom
//
// The page editor's behaviour: the working copy follows the newest revision,
// a region is added, selected and edited, the parser holds Save with the
// reason, Save draft and Publish post to the one write path with the right
// base, a stale publish shows the conflict, a shortcut lands at the cursor.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageEditor, nextRegionId, renumber } from './PageEditor';
import type { PageDetail } from '@/lib/design/page-revisions';
import type { PageDocument, Region } from '@/lib/design/page-document';
import type { EditableAsset } from '@/lib/design/assets';

const STAMP = '2026-09-08T16:00:00.505502+00:00';
const R1 = 'b1b2c3d4-0000-4000-8000-000000000001';
const R2 = 'b1b2c3d4-0000-4000-8000-000000000002';
const ASSET = 'c1b2c3d4-0000-4000-8000-000000000031';
const page = {
  id: 'a1b2c3d4-0000-4000-8000-000000000010',
  path: '/history/monza',
  name: 'Monza, a history',
  kind: 'row' as const,
  group: 'editorial' as const,
  template: 'paddock-standard',
  authz: 'public',
  title: null,
  rendering: 'cached' as const,
  indexable: false,
  comments: null,
  updatedAt: STAMP,
};
const doc: PageDocument = {
  version: 1,
  actions: [],
  regions: [
    { id: 'intro', kind: 'static', title: 'A century of speed', position: 'body', seq: 10, column: 1, span: 8, newRow: false, hidden: false, authz: null, text: 'Opened in 1922.' },
    { id: 'more', kind: 'list', title: 'Elsewhere', position: 'right', seq: 10, column: 1, span: 12, newRow: false, hidden: false, authz: null, listKey: 'footer-site', style: 'links' },
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
const shortcuts = [{ key: 'times.local', text: 'All times are shown in your local time zone.', updatedAt: STAMP }];

const fetchMock = vi.fn();
function mount(d: PageDetail = detail, readOnly = false) {
  const onSaved = vi.fn();
  render(<PageEditor detail={d} readOnly={readOnly} lists={lists} assets={assets} shortcuts={shortcuts} onSaved={onSaved} />);
  return { onSaved };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('renumber and ids', () => {
  it('orders regions by position then sequence and renumbers by tens within each position', () => {
    const r = (id: string, position: Region['position'], seq: number): Region => ({ id, kind: 'static', title: '', position, seq, column: 1, span: 12, newRow: false, hidden: false, authz: null, text: '' });
    expect(renumber([r('c', 'footer', 5), r('b', 'body', 30), r('a', 'body', 7)]).map(x => `${x.id}:${x.position}:${x.seq}`)).toEqual(['a:body:10', 'b:body:20', 'c:footer:10']);
    expect(nextRegionId('static', ['text-1', 'text-2'])).toBe('text-3');
    expect(nextRegionId('image', [])).toBe('photo-1');
    expect(nextRegionId('list', ['list-1'])).toBe('list-2');
  });
});

describe('PageEditor', () => {
  it('draws the newest revision, opens a tile in the properties, and holds Save draft until something changes while Publish is offered for an unpublished draft', () => {
    mount();
    expect(screen.getByText('Draft from 2026-09-08 18:42Z · live from 2026-09-08 17:10Z')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Static Content: A century of speed' }));
    expect((screen.getByLabelText('Region title') as HTMLInputElement).value).toBe('A century of speed');
    fireEvent.change(screen.getByLabelText('Region title'), { target: { value: 'Monza' } });
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('adds an Image region to the chosen position, names the problem until a photo is chosen, and clamps the span to the columns left', () => {
    mount();
    fireEvent.change(screen.getByLabelText('Position for a new region'), { target: { value: 'header' } });
    fireEvent.click(screen.getByRole('button', { name: 'Image' }));
    expect(screen.getByText('region photo-1: the image must name one of your photos')).toBeTruthy();
    expect(screen.getByText('1 problem holds Save')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('1 of 1 in Header')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Region photo'), { target: { value: ASSET } });
    expect(screen.queryByText(/must name one of your photos/)).toBeNull();
    expect((screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(screen.getByLabelText('Region column'), { target: { value: '10' } });
    expect((screen.getByLabelText('Region span') as HTMLInputElement).value).toBe('3');
    fireEvent.change(screen.getByLabelText('Region span'), { target: { value: '12' } });
    expect((screen.getByLabelText('Region span') as HTMLInputElement).value).toBe('3');
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo-1' }));
    expect(screen.queryByText('1 of 1 in Header')).toBeNull();
  });

  it('adds a Button with a destination, a dynamic action that shows a hidden region on its click, and removing the region takes the action with it', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Button' }));
    expect(screen.getByRole('button', { name: 'Button: button-1' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Button label'), { target: { value: 'Open the calendar' } });
    fireEvent.change(screen.getByLabelText('Button destination'), { target: { value: 'calendar' } });
    expect(screen.getByRole('button', { name: 'Button: button-1' }).textContent).toContain('→ calendar');
    fireEvent.click(screen.getByRole('button', { name: 'Static Content: A century of speed' }));
    fireEvent.click(screen.getByLabelText('Hidden until an action shows it'));
    expect(screen.getByRole('button', { name: 'Static Content: A century of speed' }).textContent).toContain('hidden at first');
    fireEvent.click(screen.getByRole('button', { name: 'Add a dynamic action' }));
    fireEvent.change(screen.getByLabelText('Name of action-1'), { target: { value: 'Reveal' } });
    fireEvent.change(screen.getByLabelText('Trigger region of action-1'), { target: { value: 'button-1' } });
    fireEvent.change(screen.getByLabelText('Effect 1 of action-1'), { target: { value: 'show' } });
    fireEvent.change(screen.getByLabelText('Region of effect 1 of action-1'), { target: { value: 'intro' } });
    expect(screen.queryByText(/holds Save/)).toBeNull();
    expect((screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(screen.getByLabelText('When of action-1'), { target: { value: 'timer' } });
    fireEvent.change(screen.getByLabelText('Timer of action-1'), { target: { value: '2' } });
    expect(screen.getByText('action action-1: the timer is 5 to 3600 seconds')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Timer of action-1'), { target: { value: '30' } });
    expect(screen.queryByText(/holds Save/)).toBeNull();
    // The text region is still the selected one; removing it takes the action that named it.
    fireEvent.click(screen.getByRole('button', { name: 'Remove intro' }));
    expect(screen.queryByLabelText('Name of action-1')).toBeNull();
    expect(screen.getByText('None yet.')).toBeTruthy();
  });

  it('moves a region within its position and starts a new row', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Static Content' }));
    expect(screen.getByText('2 of 2 in Body')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Move earlier' }));
    expect(screen.getByText('1 of 2 in Body')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Move earlier' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Start a new row'));
    expect((screen.getByLabelText('Start a new row') as HTMLInputElement).checked).toBe(true);
  });

  it('Save draft posts the document with the newest revision as its base, then reloads the detail and hands it over', async () => {
    const after: PageDetail = { ...detail, newest: { ...detail.newest!, id: 'b1b2c3d4-0000-4000-8000-000000000003', createdAt: '2026-09-08T19:00:00Z' } };
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => after });
    const { onSaved } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Static Content: A century of speed' }));
    fireEvent.change(screen.getByLabelText('Region title'), { target: { value: 'Monza' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(after));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/admin/design/pages/${page.id}/revisions`);
    const body = JSON.parse(String(init.body)) as { action: string; base: string | null; document: PageDocument };
    expect(body.action).toBe('draft');
    expect(body.base).toBe(R2);
    expect(body.document.regions.find(r => r.id === 'intro')?.title).toBe('Monza');
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe(`/api/admin/design/pages/${page.id}`);
  });

  it('Publish carries the live revision as its base and a 409 shows the conflict, whose Reload hands over what is stored', async () => {
    const current: PageDetail = { ...detail, live: { ...detail.live!, id: 'b1b2c3d4-0000-4000-8000-000000000009' } };
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'stale', current }) });
    const { onSaved } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await screen.findByText(/published again after you loaded it/);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)) as { action: string; base: string | null };
    expect(body).toMatchObject({ action: 'publish', base: R1 });
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onSaved).toHaveBeenCalledWith(current);
  });

  it('inserts a shortcut token at the cursor of the text', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Static Content: A century of speed' }));
    const text = screen.getByLabelText('Region text') as HTMLTextAreaElement;
    text.setSelectionRange(7, 7);
    fireEvent.change(screen.getByLabelText('Insert a shortcut'), { target: { value: 'times.local' } });
    expect((screen.getByLabelText('Region text') as HTMLTextAreaElement).value).toBe('Opened {shortcut:times.local}in 1922.');
  });

  it('a stale working copy is replaced when the newest revision changes', () => {
    const { rerender } = render(<PageEditor detail={detail} readOnly={false} lists={lists} assets={assets} shortcuts={shortcuts} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Static Content: A century of speed' }));
    fireEvent.change(screen.getByLabelText('Region title'), { target: { value: 'Changed' } });
    const next: PageDetail = {
      ...detail,
      newest: { ...detail.newest!, id: 'b1b2c3d4-0000-4000-8000-000000000004', document: { ...doc, regions: [{ ...doc.regions[0], title: 'From the server' }] } },
    };
    rerender(<PageEditor detail={next} readOnly={false} lists={lists} assets={assets} shortcuts={shortcuts} onSaved={() => {}} />);
    expect((screen.getByLabelText('Region title') as HTMLInputElement).value).toBe('From the server');
    expect(screen.queryByText('Unsaved changes')).toBeNull();
  });

  it('read-only shows the schematic and the properties disabled, with no Save, Publish or gallery', () => {
    mount(detail, true);
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
    expect(screen.queryByText('Add a region')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Static Content: A century of speed' }));
    expect((screen.getByLabelText('Region title') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Remove intro' })).toBeNull();
  });
});
