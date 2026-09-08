// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
const codePage: PageRow = {
  ...page,
  id: 'c0de0000-0000-4000-8000-000000000002',
  path: '/calendar',
  name: 'Calendar',
  kind: 'code',
  group: 'calendar',
  indexable: true,
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

const pill = (group: string, label: string) => within(screen.getByRole('group', { name: group })).getByRole('button', { name: label });

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
    fireEvent.click(pill('Search engines may index this page', 'Yes'));
    fireEvent.click(pill('Page authorization', 'Signed in'));
    expect(pill('Page authorization', 'Signed in').getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(screen.getByLabelText('Page comments'), { target: { value: 'Opened for the Monza weekend.' } });
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
      comments: 'Opened for the Monza weekend.',
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
    expect((pill('Page group', 'Editorial') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Save attributes' })).toBeNull();
  });

  it("shows the approved designer's groups and rows: the page's number is its id, the alias is the fixed path with its note", () => {
    render(<PageAttributesEditor page={codePage} readOnly={false} onSaved={() => {}} onConflict={() => {}} />);
    for (const g of ['Identification', 'Security', 'Advanced']) expect(screen.getByRole('button', { name: g })).toBeTruthy();
    expect(screen.getByText('c0de0000: Calendar')).toBeTruthy();
    expect(screen.getByText('/calendar')).toBeTruthy();
    expect(screen.getByText('Built-in route. Its path is code.')).toBeTruthy();
    expect(screen.getByText('No · public with account')).toBeTruthy();
    expect(screen.getByText('Cached')).toBeTruthy();
    expect(pill('Search engines may index this page', 'Yes').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(pill('Page authorization', 'Administrator'));
    expect(screen.getByText('Yes', { selector: 'div' })).toBeTruthy();
  });

  it('filters the properties, shows the common ones alone, folds a group, and reads help for a property', () => {
    render(<PageAttributesEditor page={codePage} readOnly={false} onSaved={() => {}} onConflict={() => {}} />);
    fireEvent.change(screen.getByLabelText('Filter properties'), { target: { value: 'title' } });
    expect(screen.getByLabelText('Page title')).toBeTruthy();
    expect(screen.queryByLabelText('Page name')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Security' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Filter properties'), { target: { value: 'zzz' } });
    expect(screen.getByText('No property matches.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Filter properties'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show Common' }));
    expect(screen.queryByLabelText('Page comments')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show All' }));
    expect(screen.getByLabelText('Page comments')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(screen.queryByLabelText('Page comments')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Go to Group' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Advanced' }));
    expect(screen.getByLabelText('Page comments')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show help' }));
    expect(screen.getByText("Click a property's label, or focus a field, to read its help here.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Page Group' }));
    expect(screen.getByText(/How the App Builder home groups pages/)).toBeTruthy();
  });
});
