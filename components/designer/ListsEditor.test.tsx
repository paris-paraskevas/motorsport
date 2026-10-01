// @vitest-environment jsdom
//
// The Lists page: the shell's lists open their own entries, a list of the
// operator's own is created with a key and a label, opened in the list editor,
// and deleted after a confirmation, with the store's refusals shown in words.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ListsEditor } from './ListsEditor';
import type { ListSummary } from '@/lib/design/lists';

const STAMP = '2026-09-09T02:00:00.000001+00:00';
const lists: ListSummary[] = [
  { key: 'doors', role: 'menu', label: 'Navigation Menu', updatedAt: STAMP, entries: 4 },
  { key: 'useful-links', role: 'generic', label: 'Useful links', updatedAt: STAMP, entries: 2 },
];
const fetchMock = vi.fn();
type Call = { url: string; method: string; body: unknown };
let calls: Call[] = [];
const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });

beforeEach(() => {
  calls = [];
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (method === 'POST') return json(201, { ok: true, list: { key: 'more-links', role: 'generic', label: 'More links', updatedAt: STAMP, entries: [] } });
    if (method === 'DELETE') return json(200, { ok: true, key: 'useful-links' });
    return json(200, { key: 'useful-links', role: 'generic', label: 'Useful links', updatedAt: STAMP, entries: [{ label: 'Calendar', dest: 'calendar', note: 'Every session, your time.' }, { label: 'Blog', dest: 'blog' }] });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ListsEditor', () => {
  it('lists the shell’s lists as such, opening them in their own entries, and the operator’s own with Open and Delete', () => {
    const onOpenShell = vi.fn();
    render(<ListsEditor lists={lists} readOnly={false} onOpenShell={onOpenShell} onChanged={vi.fn()} />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('shell')).toBeTruthy();
    fireEvent.click(within(rows[0]).getByRole('button', { name: 'Open' }));
    expect(onOpenShell).toHaveBeenCalledWith('doors');
    expect(within(rows[1]).getByRole('button', { name: 'Delete useful-links' })).toBeTruthy();
  });

  it('creates a list through the collection route once the key and the label pass the rules, then opens it', async () => {
    const onChanged = vi.fn();
    render(<ListsEditor lists={lists} readOnly={false} onOpenShell={vi.fn()} onChanged={onChanged} />);
    const create = screen.getByRole('button', { name: 'Create list' }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Key of the new list'), { target: { value: 'More Links' } });
    fireEvent.change(screen.getByLabelText('Label of the new list'), { target: { value: 'More links' } });
    expect(create.disabled).toBe(true);
    expect(screen.getByText(/lower-case letters, digits and hyphens, starting/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Key of the new list'), { target: { value: 'more-links' } });
    expect(create.disabled).toBe(false);
    fireEvent.click(create);
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const posted = calls.find(c => c.method === 'POST')!;
    expect(posted.url).toBe('/api/admin/design/lists');
    expect(posted.body).toEqual({ key: 'more-links', label: 'More links' });
    expect((onChanged.mock.calls[0][0] as ListSummary[]).map(l => l.key)).toEqual(['doors', 'more-links', 'useful-links']);
    expect(await screen.findByRole('heading', { name: 'More links' })).toBeTruthy();
  });

  it('opens a list of the operator’s own in the list editor, and deletes one after asking', async () => {
    const onChanged = vi.fn();
    render(<ListsEditor lists={lists} readOnly={false} onOpenShell={vi.fn()} onChanged={onChanged} />);
    const row = screen.getAllByRole('row')[2];
    fireEvent.click(within(row).getByRole('button', { name: 'Open' }));
    expect(await screen.findByRole('heading', { name: 'Useful links' })).toBeTruthy();
    expect(screen.getByLabelText('Preview of the list')).toBeTruthy();
    // R18 PR C: the Note column (a sentence a card draws), with its cap, shown in the preview.
    const note = screen.getByLabelText('Note of entry 1') as HTMLInputElement;
    expect(note.value).toBe('Every session, your time.');
    expect(note.maxLength).toBe(120);
    expect((screen.getByLabelText('Note of entry 2') as HTMLInputElement).value).toBe('');
    expect(within(screen.getByLabelText('Preview of the list')).getByText('Every session, your time.')).toBeTruthy();
    // R18: the series tabs in the catalogue select, flat by label among the rest (the designer's selects group them).
    const add = screen.getByLabelText('Add an entry from the catalogue') as HTMLSelectElement;
    expect(Array.from(add.options).map(o => o.textContent?.trim())).toContain('Formula 1 · Champions · /series/f1/champions');
    expect(add.querySelector('optgroup')).toBeNull();
    expect(calls.find(c => c.method === 'GET')!.url).toBe('/api/admin/design/lists/useful-links');
    fireEvent.click(within(row).getByRole('button', { name: 'Delete useful-links' }));
    fireEvent.click(within(row).getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const deleted = calls.find(c => c.method === 'DELETE')!;
    expect(deleted.url).toBe('/api/admin/design/lists/useful-links');
    expect(deleted.body).toEqual({ updatedAt: STAMP });
    expect((onChanged.mock.calls[0][0] as ListSummary[]).map(l => l.key)).toEqual(['doors']);
  });

  it('shows the store’s refusal in words when a page still names the list', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') return json(409, { error: 'A page’s revision names this list, and revisions are kept, so the list stays. Empty its entries if it should show nothing.' });
      return json(200, {});
    });
    render(<ListsEditor lists={lists} readOnly={false} onOpenShell={vi.fn()} onChanged={vi.fn()} />);
    const row = screen.getAllByRole('row')[2];
    fireEvent.click(within(row).getByRole('button', { name: 'Delete useful-links' }));
    fireEvent.click(within(row).getByRole('button', { name: 'Yes' }));
    expect(await screen.findByText(/revision names this list, and revisions are kept/)).toBeTruthy();
  });
});
