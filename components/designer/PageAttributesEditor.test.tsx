// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageAttributesEditor } from './PageAttributesEditor';
import type { PageRow } from '@/lib/design/pages';
import type { PageDetail } from '@/lib/design/page-revisions';

const STAMP = '2026-09-08T16:00:00.505502+00:00';
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
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PageAttributesEditor', () => {
  it('holds Save until something changes, refuses an empty name, and saves the attributes on the stamp', async () => {
    const onSaved = vi.fn();
    const saved = { ...page, name: 'Monza', title: 'Monza, a history of speed', indexable: true, updatedAt: '2026-09-08T18:00:00+00:00' };
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, page: saved }) });
    render(<PageAttributesEditor page={page} readOnly={false} onSaved={onSaved} onConflict={() => {}} />);
    const save = () => screen.getByRole('button', { name: 'Save attributes' }) as HTMLButtonElement;
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Page name'), { target: { value: ' ' } });
    expect(screen.getByText('needs a name')).toBeTruthy();
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Page name'), { target: { value: 'Monza' } });
    fireEvent.change(screen.getByLabelText('Page title'), { target: { value: 'Monza, a history of speed' } });
    fireEvent.click(screen.getByLabelText('Search engines may index this page'));
    fireEvent.change(screen.getByLabelText('Page authorization'), { target: { value: 'signed_in' } });
    expect(save().disabled).toBe(false);
    fireEvent.click(save());
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/admin/design/pages/${page.id}`);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({
      name: 'Monza',
      title: 'Monza, a history of speed',
      group: 'editorial',
      authz: 'signed_in',
      indexable: true,
      updatedAt: STAMP,
    });
  });

  it('hands a 409’s current detail to onConflict', async () => {
    const onConflict = vi.fn();
    const current = { page: { ...page, updatedAt: 'moved' }, live: null, newest: null, revisions: [] } as PageDetail;
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'moved', current }) });
    render(<PageAttributesEditor page={page} readOnly={false} onSaved={() => {}} onConflict={onConflict} />);
    fireEvent.change(screen.getByLabelText('Page name'), { target: { value: 'Monza' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save attributes' }));
    await waitFor(() => expect(onConflict).toHaveBeenCalledWith(current));
  });

  it('is disabled throughout when read-only', () => {
    render(<PageAttributesEditor page={page} readOnly onSaved={() => {}} onConflict={() => {}} />);
    expect((screen.getByLabelText('Page name') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Save attributes' })).toBeNull();
  });
});
