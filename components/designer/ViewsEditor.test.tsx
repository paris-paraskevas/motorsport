// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ViewsEditor, definitionText } from './ViewsEditor';
import type { EditableSavedView, ViewTarget } from '@/lib/design/views';

const STAMP = '2026-09-23T21:30:00.505502+00:00';
const TOP: EditableSavedView = { key: 'top-five', pageId: 'p1', regionId: 't', name: 'Top five', definition: { sort: { column: 'points', desc: true }, cols: ['name', 'points'], filters: [] }, seq: 10, updatedAt: STAMP };
const GONE: EditableSavedView = { key: 'old', pageId: 'p1', regionId: 'zz', name: 'Old', definition: { filters: [] }, seq: 10, updatedAt: STAMP };
const TARGETS: ViewTarget[] = [{ pageId: 'p1', path: '/history/monza', name: 'Monza', regions: [{ id: 't', label: 'Drivers (t)', live: true }, { id: 'u', label: 'Data region u', live: false }] }];

const calls: { url: string; method: string; body?: unknown }[] = [];
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
  if ((init?.method ?? 'GET') === 'GET') return new Response(JSON.stringify({ views: [TOP, GONE], targets: TARGETS }), { status: 200 });
  return new Response(JSON.stringify({ ok: true }), { status: init?.method === 'POST' ? 201 : 200 });
});

describe('ViewsEditor', () => {
  beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('draws each view with its definition in the vocabulary’s words, its History and its Utilization (the page and the region, or that the region is gone)', () => {
    render(<ViewsEditor views={[TOP, GONE]} targets={TARGETS} readOnly={false} onSaved={() => {}} />);
    expect(definitionText(TOP)).toBe('sort=-points&cols=name,points');
    expect((screen.getByLabelText('Definition of top-five') as HTMLInputElement).value).toBe('sort=-points&cols=name,points');
    expect(screen.getAllByText('2026-09-23 21:30Z')).toHaveLength(2);
    expect(screen.getByText('/history/monza · Drivers (t)')).toBeTruthy();
    expect(screen.getByText('/history/monza · region zz gone')).toBeTruthy();
    expect(screen.getByText('Stored')).toBeTruthy();
  });

  it('adds a view with a page and a region picked from the targets, refuses a definition that names a view, and saves creates then edits then deletes through the routes, reloading the list', async () => {
    const onSaved = vi.fn();
    render(<ViewsEditor views={[TOP, GONE]} targets={TARGETS} readOnly={false} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a view' }));
    fireEvent.change(screen.getByLabelText('Key of the new view'), { target: { value: 'Mercedes' } });
    fireEvent.change(screen.getByLabelText('Name of the new view'), { target: { value: 'Mercedes' } });
    fireEvent.change(screen.getByLabelText('Definition of the new view'), { target: { value: 'filter=team.eq:Mercedes&view=x' } });
    expect(screen.getByText(/a definition never names a view/)).toBeTruthy();
    expect((screen.getByRole('button', { name: /Save/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Definition of the new view'), { target: { value: 'filter=team.eq:Mercedes' } });
    fireEvent.change(screen.getByLabelText('Region of the new view'), { target: { value: 'u' } });
    fireEvent.change(screen.getByLabelText('Name of top-five'), { target: { value: 'Top 5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete old' }));
    expect(screen.getByText(/3 unsaved/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save 3 changes' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls.map(c => [c.method, c.url])).toEqual([
      ['POST', '/api/admin/design/views'],
      ['PUT', '/api/admin/design/views/top-five'],
      ['DELETE', '/api/admin/design/views/old'],
      ['GET', '/api/admin/design/views'],
    ]);
    expect(calls[0].body).toEqual({ key: 'mercedes', name: 'Mercedes', pageId: 'p1', regionId: 'u', definition: 'filter=team.eq:Mercedes' });
    expect(calls[1].body).toEqual({ name: 'Top 5', definition: 'sort=-points&cols=name,points', updatedAt: STAMP });
    expect(calls[2].body).toEqual({ updatedAt: STAMP });
    expect(onSaved).toHaveBeenCalledWith({ views: [TOP, GONE], targets: TARGETS });
  });

  it('shows a conflict with Reload when a route answers 409', async () => {
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ error: 'moved', current: [TOP] }), { status: 409 }));
    const onSaved = vi.fn();
    render(<ViewsEditor views={[TOP]} targets={TARGETS} readOnly={false} onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText('Name of top-five'), { target: { value: 'Top 5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText(/saved again after you loaded them/)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onSaved).toHaveBeenCalledWith({ views: [TOP], targets: TARGETS });
  });
});
