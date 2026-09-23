// @vitest-environment jsdom
//
// Plug-ins (P2.0, PR B; APEX: Plug-ins): the component definitions in a table
// with Utilization and History, one opened below it with its attributes by
// group, its events, capabilities and slots; Add Attribute and Add Group grow
// an overlay the operator saves as a row; a shipped attribute cannot be
// removed; a row that moved comes back as a conflict with Reload.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginsEditor } from './PluginsEditor';
import { DEFINITIONS, EMPTY_OVERLAY, mergeDefinition, type EditableDefinition } from '@/lib/design/component-definitions';

const STAMP = '2026-09-17T11:00:00.000001+00:00';
const CAL = 'a1b2c3d4-0000-4000-8000-000000000001';
const list: EditableDefinition[] = DEFINITIONS.map(d => ({
  key: d.key,
  definition: d,
  overlay: EMPTY_OVERLAY,
  updatedAt: null,
  updatedBy: null,
  usedOn: d.key === 'page.heading' || d.key === 'calendar.month' ? [{ id: CAL, path: '/calendar', name: 'Calendar' }] : [],
  regions: d.key === 'page.heading' || d.key === 'calendar.month' ? 1 : 0,
}));
const accent = { key: 'accent', label: 'Accent', kind: 'colour' as const, default: '#8c1c13', group: 'colours' };
const colours = { key: 'colours', title: 'Colours', seq: 10 };
const heading = DEFINITIONS.find(d => d.key === 'page.heading')!;
const savedHeading: EditableDefinition = { ...list.find(d => d.key === 'page.heading')!, definition: mergeDefinition(heading, { attributes: [accent], groups: [colours] }), overlay: { attributes: [accent], groups: [colours] }, updatedAt: STAMP, updatedBy: 'user_admin' };

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
    if (method === 'PUT') return json(200, { ok: true, definition: savedHeading });
    return json(200, { definitions: list.map(d => (d.key === 'page.heading' ? savedHeading : d)) });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PluginsEditor', () => {
  it('lists every definition with its type, attributes, Used on and History, and opens one with its groups, a shipped attribute marked and not removable', () => {
    const onOpenPage = vi.fn();
    render(<PluginsEditor definitions={list} readOnly={false} onSaved={vi.fn()} onOpenPage={onOpenPage} />);
    expect(screen.getByRole('heading', { name: 'Plug-ins' })).toBeTruthy();
    const rows = screen.getAllByRole('row').slice(1);
    // The four region kinds and the five components (the Data region since P2.2, the Live band since P2.9; Home's six left in P2.24 C).
    expect(rows).toHaveLength(9);
    expect(within(rows[0]).getByText('Static Content')).toBeTruthy();
    expect(within(rows[0]).getByText('Region')).toBeTruthy();
    const headingRow = rows.find(r => within(r).queryByText('Page heading'))!;
    expect(within(headingRow).getByText('Component')).toBeTruthy();
    expect(within(headingRow).getByText('shipped')).toBeTruthy();
    expect(within(headingRow).getByText('1 page')).toBeTruthy();
    fireEvent.click(within(headingRow).getByRole('button', { name: 'Open Page heading' }));
    const open = screen.getByRole('region', { name: 'Plug-in: Page heading' });
    expect(within(open).getByText('Settings')).toBeTruthy();
    const words = within(open).getByRole('row', { name: /Words/ });
    expect(within(words).getByText('shipped')).toBeTruthy();
    expect(within(words).queryByRole('button', { name: /^Remove/ })).toBeNull();
    fireEvent.click(within(open).getByRole('button', { name: 'Open Calendar' }));
    expect(onOpenPage).toHaveBeenCalledWith(CAL);
    expect(within(open).getByText(/Events/)).toBeTruthy();
  });

  it('P2.1: the opened definition names the sources it may read: the five for the Data region, none for the heading', () => {
    render(<PluginsEditor definitions={list} readOnly={false} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Data region' }));
    const region = screen.getByRole('region', { name: 'Plug-in: Data region' });
    expect(within(region).getByText('Sources').nextElementSibling?.textContent).toMatch(/^Standings.*Results.*Posts.*News.*Weekends$/);
    fireEvent.click(screen.getByRole('button', { name: 'Open Page heading' }));
    const heading = screen.getByRole('region', { name: 'Plug-in: Page heading' });
    expect(within(heading).getByText('Sources').nextElementSibling?.textContent).toMatch(/^none/);
  });

  it('adds an attribute with a colour editor into a new group and saves the overlay through the key route with a null stamp; the answer replaces the definition', async () => {
    const onSaved = vi.fn();
    render(<PluginsEditor definitions={list} readOnly={false} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Page heading' }));
    const open = screen.getByRole('region', { name: 'Plug-in: Page heading' });
    fireEvent.click(within(open).getByRole('button', { name: 'Add Attribute' }));
    const form = within(open).getByRole('form', { name: 'Add Attribute' });
    fireEvent.change(within(form).getByLabelText('Label'), { target: { value: 'Accent' } });
    fireEvent.change(within(form).getByLabelText('Type'), { target: { value: 'colour' } });
    fireEvent.change(within(form).getByLabelText('Default'), { target: { value: '#8c1c13' } });
    fireEvent.change(within(form).getByLabelText('Group'), { target: { value: '__new__' } });
    fireEvent.change(within(form).getByLabelText('New group title'), { target: { value: 'Colours' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add' }));
    const added = within(open).getByRole('row', { name: /Accent/ });
    expect(within(added).getByText('added')).toBeTruthy();
    expect(within(added).getByRole('button', { name: 'Remove accent' })).toBeTruthy();
    expect(within(open).getByText('Colours')).toBeTruthy();
    fireEvent.click(within(open).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const put = calls.find(c => c.method === 'PUT')!;
    expect(put.url).toBe('/api/admin/design/definitions/page.heading');
    expect(put.body).toEqual({ overlay: { attributes: [accent], groups: [colours] }, updatedAt: null });
    const next = onSaved.mock.calls[0][0] as EditableDefinition[];
    expect(next.find(d => d.key === 'page.heading')?.updatedAt).toBe(STAMP);
    expect(screen.getByRole('status').textContent).toMatch(/Saved/);
  });

  it('a conflict shows the reason and Reload, which reads the list again', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (method === 'PUT') return json(409, { error: 'This definition was saved again after you loaded it.', current: list });
      return json(200, { definitions: list });
    });
    const onSaved = vi.fn();
    render(<PluginsEditor definitions={list} readOnly={false} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Page heading' }));
    const open = screen.getByRole('region', { name: 'Plug-in: Page heading' });
    fireEvent.click(within(open).getByRole('button', { name: 'Add Group' }));
    fireEvent.change(within(open).getByLabelText('Group title'), { target: { value: 'Colours' } });
    fireEvent.click(within(open).getByRole('button', { name: 'Add group' }));
    fireEvent.click(within(open).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/saved again after you loaded it/));
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls.some(c => c.method === 'GET' && c.url === '/api/admin/design/definitions')).toBe(true);
  });

  it('an added attribute leaves the draft on Remove, and nothing is left to save', () => {
    render(<PluginsEditor definitions={list} readOnly={false} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Page heading' }));
    const open = screen.getByRole('region', { name: 'Plug-in: Page heading' });
    fireEvent.click(within(open).getByRole('button', { name: 'Add Attribute' }));
    const form = within(open).getByRole('form', { name: 'Add Attribute' });
    fireEvent.change(within(form).getByLabelText('Label'), { target: { value: 'Badge' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add' }));
    expect(within(open).getByRole('row', { name: /Badge/ })).toBeTruthy();
    expect((within(open).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(within(open).getByRole('button', { name: 'Remove badge' }));
    expect(within(open).queryByRole('row', { name: /Badge/ })).toBeNull();
    expect((within(open).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('is read-only on a preview: no Add Attribute, no Save', () => {
    render(<PluginsEditor definitions={list} readOnly={true} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Page heading' }));
    const open = screen.getByRole('region', { name: 'Plug-in: Page heading' });
    expect(within(open).queryByRole('button', { name: 'Add Attribute' })).toBeNull();
    expect(within(open).queryByRole('button', { name: 'Save' })).toBeNull();
  });
});
