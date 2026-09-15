// @vitest-environment jsdom
//
// The pages list's Deleted view (P1.12): the Deleted button with its count, the
// deleted rows with their state (the days left, expired, held), Reinstate and
// Delete permanently through the routes, Remove expired pages, the Page Groups
// sheet's Deleted row, and the counts.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PagesList } from './PagesList';
import type { PageRow } from '@/lib/design/pages';

const STAMP = '2026-09-08T16:00:00.505502+00:00';
const NOW = Date.parse('2026-09-15T12:00:00.000Z');
const base: Omit<PageRow, 'id' | 'path' | 'name'> = { kind: 'row', served: 'rows', group: 'editorial', template: 'paddock-standard', authz: 'public', title: null, rendering: 'cached', indexable: false, comments: null, updatedAt: STAMP };
const monza: PageRow = { ...base, id: 'a1b2c3d4-0000-4000-8000-000000000010', path: '/history/monza', name: 'Monza, a history' };
const calendar: PageRow = { ...base, id: 'c0de0002-0000-4000-8000-000000000002', path: '/calendar', name: 'Calendar', kind: 'code', group: 'calendar', indexable: true };
const imola: PageRow = { ...base, id: 'a1b2c3d4-0000-4000-8000-000000000021', path: '/history/imola', name: 'Imola', deletedAt: '2026-09-13T10:00:00.000+00:00', deletedBy: 'user_admin' };
const zolder: PageRow = { ...base, id: 'a1b2c3d4-0000-4000-8000-000000000022', path: '/history/zolder', name: 'Zolder', deletedAt: '2026-08-01T10:00:00.000+00:00', deletedBy: 'user_admin' };

const fetchMock = vi.fn();
type Call = { url: string; method: string; body: unknown };
let calls: Call[] = [];
const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });

function mount(deleted: PageRow[] = [imola, zolder], readOnly = false) {
  const onOpen = vi.fn();
  const onReinstated = vi.fn();
  const onPurged = vi.fn();
  render(<PagesList pages={[calendar, monza]} deleted={deleted} readOnly={readOnly} onOpen={onOpen} onCreated={vi.fn()} onReinstated={onReinstated} onPurged={onPurged} now={() => NOW} />);
  return { onOpen, onReinstated, onPurged };
}

beforeEach(() => {
  calls = [];
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (method === 'POST') return json(200, { ok: true, page: { ...imola, deletedAt: undefined, deletedBy: undefined } });
    if (method === 'DELETE' && url.endsWith('?expired=1')) return json(200, { ok: true, purged: [zolder.id], held: [] });
    if (method === 'DELETE') return json(200, { ok: true, id: url.match(/pages\/([^?]+)/)![1], purged: true });
    return json(200, {});
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PagesList · Deleted (P1.12)', () => {
  it('shows the Deleted button with its count and, on it, the deleted rows with their state, Reinstate and Delete permanently and no Open; the Page Groups sheet counts them', () => {
    const { onOpen } = mount();
    expect(screen.getByRole('button', { name: 'Open Monza, a history' })).toBeTruthy();
    expect(screen.queryByText('Imola')).toBeNull();
    const button = screen.getByRole('button', { name: /^Deleted · 2/ });
    fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toMatch(/Deleted/);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map(r => within(r).getAllByRole('cell')[1].textContent)).toEqual(['Imola', 'Zolder']);
    expect(within(rows[0]).getByText(/deleted 2026-09-13 · 28 days left/)).toBeTruthy();
    expect(within(rows[1]).getByText(/expired · can be removed for good/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Open/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Reinstate Imola' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete Imola permanently' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove 1 expired page' })).toBeTruthy();
    fireEvent.click(rows[0]);
    expect(onOpen).toHaveBeenCalledWith(imola.id);
    fireEvent.click(screen.getByRole('button', { name: /^Page Groups/ }));
    const sheet = screen.getByRole('dialog', { name: 'Page Groups' });
    const deletedRow = within(sheet).getAllByRole('row').find(r => r.textContent?.includes('Deleted'))!;
    expect(within(deletedRow).getAllByRole('cell')[1].textContent).toBe('2');
    expect(within(deletedRow).getByRole('button', { name: 'showing' })).toBeTruthy();
    const allRow = within(sheet).getAllByRole('row').find(r => r.textContent?.includes('All pages'))!;
    fireEvent.click(within(allRow).getByRole('button'));
    expect(screen.getByRole('button', { name: 'Open Monza, a history' })).toBeTruthy();
  });

  it('is absent without deleted pages, and the Application card counts the live pages', () => {
    mount([]);
    expect(screen.queryByRole('button', { name: /^Deleted/ })).toBeNull();
    const card = screen.getByRole('heading', { name: 'Application' }).parentElement!;
    expect(within(card).getByText('Pages').nextElementSibling?.textContent).toBe('2');
    expect(within(card).queryByText('Deleted')).toBeNull();
    cleanup();
    mount();
    const withDeleted = screen.getByRole('heading', { name: 'Application' }).parentElement!;
    expect(within(withDeleted).getByText('Pages').nextElementSibling?.textContent).toBe('2');
    expect(within(withDeleted).getByText('Deleted').nextElementSibling?.textContent).toBe('2');
  });

  it('Reinstate posts the action to the page’s route and hands the page back', async () => {
    const { onReinstated } = mount();
    fireEvent.click(screen.getByRole('button', { name: /^Deleted/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Reinstate Imola' }));
    await waitFor(() => expect(onReinstated).toHaveBeenCalledTimes(1));
    expect(calls).toEqual([{ url: `/api/admin/design/pages/${imola.id}`, method: 'POST', body: { action: 'reinstate' } }]);
    expect(onReinstated.mock.calls[0][0]).toMatchObject({ id: imola.id, path: '/history/imola' });
  });

  it('Delete permanently asks first, purges through the page’s route and hands the id back; a refusal names the pages holding it', async () => {
    const { onPurged } = mount();
    fireEvent.click(screen.getByRole('button', { name: /^Deleted/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Imola permanently' }));
    const sheet = screen.getByRole('dialog', { name: 'Delete permanently' });
    expect(within(sheet).getByText('Imola · /history/imola')).toBeTruthy();
    expect(within(sheet).getByText(/removed for good .* \/history\/imola is free for a new page/)).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete permanently' }));
    await waitFor(() => expect(onPurged).toHaveBeenCalledWith([imola.id]));
    expect(calls).toEqual([{ url: `/api/admin/design/pages/${imola.id}?purge=1`, method: 'DELETE', body: null }]);
    expect(screen.queryByRole('dialog')).toBeNull();
    fetchMock.mockImplementationOnce(async () => json(409, { error: 'Zolder is named by Home; it cannot be removed while a live page names it.', pages: ['Home'] }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Zolder permanently' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete permanently' })).getByRole('button', { name: 'Delete permanently' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/named by Home/));
    expect(onPurged).toHaveBeenCalledTimes(1);
  });

  it('shows every page again once Deleted empties itself', () => {
    const { rerender } = render(<PagesList pages={[calendar, monza]} deleted={[imola]} readOnly={false} onOpen={vi.fn()} onCreated={vi.fn()} now={() => NOW} />);
    fireEvent.click(screen.getByRole('button', { name: /^Deleted · 1/ }));
    expect(screen.getByText('Imola')).toBeTruthy();
    rerender(<PagesList pages={[calendar, monza]} deleted={[]} readOnly={false} onOpen={vi.fn()} onCreated={vi.fn()} now={() => NOW} />);
    expect(screen.getByRole('button', { name: 'Open Monza, a history' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2 }).textContent).not.toMatch(/Deleted/);
  });

  it('Remove expired pages calls the collection route once and hands the purged ids back, naming the held ones', async () => {
    const { onPurged } = mount();
    fireEvent.click(screen.getByRole('button', { name: /^Deleted/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove 1 expired page' }));
    await waitFor(() => expect(onPurged).toHaveBeenCalledWith([zolder.id]));
    expect(calls).toEqual([{ url: '/api/admin/design/pages?expired=1', method: 'DELETE', body: null }]);
    fetchMock.mockImplementationOnce(async () => json(200, { ok: true, purged: [], held: [{ id: zolder.id, pages: ['Home'] }] }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove 1 expired page' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Zolder.*Home/));
  });

  it('read-only offers neither Reinstate nor Delete permanently nor Remove expired', () => {
    mount([imola, zolder], true);
    fireEvent.click(screen.getByRole('button', { name: /^Deleted/ }));
    expect(screen.queryByRole('button', { name: /^Reinstate/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /permanently$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();
    expect(screen.getByText(/deleted 2026-09-13 · 28 days left/)).toBeTruthy();
  });
});
