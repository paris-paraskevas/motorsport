// @vitest-environment jsdom
//
// The Ghost lap 3D build option reaches the decoder as one prop. These tests
// pin what the prop does once traces have arrived: included, the Replay row
// offers 2D and Onboard and the 3D view mounts only when Onboard is pressed;
// excluded, the 2D replay stands alone and the 3D view is never mounted, so its
// code is never fetched.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DecoderSummary } from '@/lib/openf1/decoder';

vi.mock('@/components/f1/LazyDeltaTrace', () => ({ LazyDeltaTrace: () => <div data-testid="delta" /> }));
vi.mock('@/components/f1/LazyGhostLap3D', () => ({ LazyGhostLap3D: () => <div data-testid="ghost-3d" /> }));
vi.mock('@/components/f1/GhostLapReplay', () => ({ GhostLapReplay: () => <div data-testid="ghost-2d" /> }));
vi.mock('@/components/f1/MinisectorMap', () => ({ MinisectorMap: () => null }));
vi.mock('@/components/f1/SectorBars', () => ({ SectorBars: () => null }));
vi.mock('@/components/f1/OpenF1Attribution', () => ({ OpenF1Attribution: () => null }));

import { QualifyingDecoder } from './QualifyingDecoder';

const summary: DecoderSummary = {
  sessionKey: 9999,
  drivers: [
    { number: 1, code: 'VER', name: 'Max Verstappen', team: 'Red Bull Racing', teamColour: '#3671C6' },
    { number: 4, code: 'NOR', name: 'Lando Norris', team: 'McLaren', teamColour: '#FF8000' },
  ],
  laps: [
    { driverNumber: 4, lapNumber: 12, lapTime: 79.5, sectors: [26, 27, 26.5] },
    { driverNumber: 1, lapNumber: 10, lapTime: 79.8, sectors: [26.1, 27, 26.7] },
  ],
};

// What /api/f1/decoder/trace answers: two traces with telemetry, no circuit.
const traces = {
  sessionKey: 9999,
  drivers: summary.drivers,
  traces: [
    { driverNumber: 4, lapNumber: 12, lapTime: 79.5, telemetry: [{ d: 0 }], track: null },
    { driverNumber: 1, lapNumber: 10, lapTime: 79.8, telemetry: [{ d: 0 }], track: null },
  ],
  circuit: null,
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => traces })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('QualifyingDecoder and the Ghost lap 3D build option', () => {
  it('included (the default): offers Onboard beside 2D, and mounts the 3D view only when Onboard is pressed', async () => {
    render(<QualifyingDecoder summary={summary} />);
    await screen.findByTestId('ghost-2d');
    expect(screen.getByRole('button', { name: '2D' })).toBeTruthy();
    expect(screen.queryByTestId('ghost-3d')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Onboard' }));
    expect(screen.getByTestId('ghost-3d')).toBeTruthy();
    expect(screen.queryByTestId('ghost-2d')).toBeNull();
  });

  it('excluded: the 2D replay stands alone, no Replay toggle, the 3D view never mounts', async () => {
    render(<QualifyingDecoder summary={summary} ghostLap3d={false} />);
    await screen.findByTestId('ghost-2d');
    expect(screen.queryByRole('button', { name: 'Onboard' })).toBeNull();
    expect(screen.queryByRole('button', { name: '2D' })).toBeNull();
    expect(screen.queryByText('Replay')).toBeNull();
    expect(screen.queryByTestId('ghost-3d')).toBeNull();
    expect(screen.getByTestId('delta')).toBeTruthy();
  });
});
