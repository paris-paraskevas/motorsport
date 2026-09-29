// @vitest-environment jsdom
//
// Map Backgrounds (P2.12; APEX: Shared Components › Map Backgrounds): the code's
// backgrounds in a table with their tiles, their key, their zoom ceiling,
// Utilization and History; the list from the route.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A keyed provider without a dark set beside the real catalogue (none ships today), so the Key and Dark tiles cells are exercised.
vi.mock('@/lib/design/map-backgrounds', async importOriginal => {
  const real = await importOriginal<typeof import('@/lib/design/map-backgrounds')>();
  return { ...real, MAP_BACKGROUNDS: [...real.MAP_BACKGROUNDS, { key: 'keyed', name: 'Keyed', holds: 'a test provider with a key', light: { url: 'https://tiles.example/{z}/{x}/{y}?key={key}', attribution: 'Test', maxZoom: 18 }, dark: null, keyVar: 'PADDOCK_TEST_TILES_KEY' }] };
});
import { MapBackgroundsEditor } from './MapBackgroundsEditor';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('MapBackgroundsEditor', () => {
  it('lists the backgrounds from the code with their tiles, their key, their zoom ceiling, Used on and History; a page opens in the App Builder', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ backgrounds: [{ key: 'canvas', keySet: null, usedOn: [{ id: 'p1', path: '/information/map', name: 'Tracks map', refs: ['map'] }] }] }) });
    const onOpenPage = vi.fn();
    render(<MapBackgroundsEditor onOpenPage={onOpenPage} />);
    expect(screen.getByRole('heading', { name: 'Map Backgrounds' })).toBeTruthy();
    await screen.findByRole('button', { name: 'Tracks map' });
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/design/maps', expect.anything());
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    const row = rows[0];
    expect(within(row).getByText('Canvas')).toBeTruthy();
    expect(within(row).getAllByText('server.arcgisonline.com')).toHaveLength(2);
    expect(within(row).getByText('none')).toBeTruthy();
    expect(within(row).getByText('16')).toBeTruthy();
    expect(within(row).getByText('code, deployed with the site')).toBeTruthy();
    fireEvent.click(within(row).getByRole('button', { name: 'Tracks map' }));
    expect(onOpenPage).toHaveBeenCalledWith('p1');
  });

  it('shows a keyed background’s variable by name and whether it is set (never its value), the light set standing in for a missing dark set, and no page while nothing uses a background', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ backgrounds: [{ key: 'canvas', keySet: null, usedOn: [] }, { key: 'keyed', keySet: true, usedOn: [] }] }) });
    render(<MapBackgroundsEditor onOpenPage={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText('no page')).toHaveLength(2));
    const keyed = screen.getAllByRole('row').slice(1)[1];
    expect(within(keyed).getByText('PADDOCK_TEST_TILES_KEY · set')).toBeTruthy();
    expect(within(keyed).getByText('tiles.example')).toBeTruthy();
    expect(within(keyed).getByText('the light set')).toBeTruthy();
    expect(within(keyed).getByText('18')).toBeTruthy();
    cleanup();
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ backgrounds: [{ key: 'canvas', keySet: null, usedOn: [] }, { key: 'keyed', keySet: false, usedOn: [] }] }) });
    render(<MapBackgroundsEditor onOpenPage={vi.fn()} />);
    await screen.findByText('PADDOCK_TEST_TILES_KEY · not set');
  });

  it('says when the list cannot be read', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(<MapBackgroundsEditor onOpenPage={vi.fn()} />);
    await screen.findByText(/could not be listed \(HTTP 500\)/);
  });
});
