// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationDefinitionEditor } from './ApplicationDefinitionEditor';
import { DEFAULT_DEFINITION } from '@/lib/design/application-defaults';

const STAMP = '2026-09-08T15:30:00.505502+00:00';
const loaded = { definition: DEFAULT_DEFINITION, updatedAt: STAMP };
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ApplicationDefinitionEditor', () => {
  it("shows the definition in the Property Editor's groups with the running version read-only", () => {
    render(<ApplicationDefinitionEditor loaded={loaded} readOnly={false} onSaved={() => {}} />);
    for (const g of ['Definition', 'Availability', 'Properties']) expect(screen.getByRole('button', { name: g })).toBeTruthy();
    expect(screen.getByText(/^v\d+\.\d+\.\d+$/)).toBeTruthy();
    expect(screen.getByText('paddock')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save definition' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('holds Save until something changes, refuses an empty name, and saves the whole definition on the stamp', async () => {
    const onSaved = vi.fn();
    const next = { ...DEFAULT_DEFINITION, wordmark: 'Paddock', dateChip: false, availability: 'maintenance' as const };
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, definition: next, updatedAt: '2026-09-08T18:00:00+00:00' }) });
    render(<ApplicationDefinitionEditor loaded={loaded} readOnly={false} onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText('Application name'), { target: { value: ' ' } });
    expect(screen.getByText('the application needs a name')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Application name'), { target: { value: 'Paddock Tracker' } });
    fireEvent.change(screen.getByLabelText('Wordmark'), { target: { value: 'Paddock' } });
    fireEvent.click(within(screen.getByRole('group', { name: 'Date chip in the header' })).getByRole('button', { name: 'No' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Availability' })).getByRole('button', { name: 'Maintenance' }));
    expect(screen.getByText(/Every page shows:/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save definition' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ definition: next, updatedAt: '2026-09-08T18:00:00+00:00' }));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/admin/design/application');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({ definition: next, updatedAt: STAMP });
  });

  it('shows the conflict on 409 and hands the stored definition back through Reload', async () => {
    const onSaved = vi.fn();
    const current = { definition: { ...DEFAULT_DEFINITION, wordmark: 'Elsewhere' }, updatedAt: 'moved' };
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'moved', current }) });
    render(<ApplicationDefinitionEditor loaded={loaded} readOnly={false} onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText('Wordmark'), { target: { value: 'Paddock' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save definition' }));
    await screen.findByText(/saved again after you loaded it/);
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onSaved).toHaveBeenCalledWith(current);
  });

  it('is read-only on a preview Worker', () => {
    render(<ApplicationDefinitionEditor loaded={loaded} readOnly onSaved={() => {}} />);
    expect((screen.getByLabelText('Application name') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Save definition' })).toBeNull();
  });

  it('lands on a field when asked (P1.8: the toolbar’s Edit Logo opens the Wordmark): the Properties group open, the field focused', async () => {
    render(<ApplicationDefinitionEditor loaded={loaded} readOnly={false} onSaved={() => {}} focus="wordmark" />);
    const wordmark = screen.getByLabelText('Wordmark') as HTMLInputElement;
    await waitFor(() => expect(document.activeElement).toBe(wordmark));
    expect(screen.getByRole('button', { name: 'Properties' }).getAttribute('aria-expanded')).toBe('true');
  });
});
