import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchMotoGPSeasonResults } from './motogp';

// Mock the four-stage Pulselive fetch chain:
//   1) /results/seasons
//   2) /results/events?seasonUuid=&isFinished=true
//   3) /results/sessions?eventUuid=&categoryUuid=
//   4) /results/session/<id>/classification?test=false
function setupFetch(opts: {
  seasons?: unknown;
  events?: unknown;
  sessionsByEvent?: Record<string, unknown>;
  classificationsBySession?: Record<string, unknown>;
}) {
  globalThis.fetch = vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.includes('/results/seasons')) {
      return { ok: true, status: 200, json: async () => opts.seasons } as Response;
    }
    if (u.includes('/results/events')) {
      return { ok: true, status: 200, json: async () => opts.events } as Response;
    }
    if (u.includes('/results/sessions')) {
      const m = u.match(/eventUuid=([^&]+)/);
      const eventId = m ? decodeURIComponent(m[1]) : '';
      const sessions = opts.sessionsByEvent?.[eventId] ?? [];
      return { ok: true, status: 200, json: async () => sessions } as Response;
    }
    const sessionMatch = u.match(/\/results\/session\/([^/]+)\/classification/);
    if (sessionMatch) {
      const sessionId = sessionMatch[1];
      const cls = opts.classificationsBySession?.[sessionId];
      if (!cls) return { ok: false, status: 404, json: async () => null } as Response;
      return { ok: true, status: 200, json: async () => cls } as Response;
    }
    return { ok: false, status: 404, json: async () => null } as Response;
  }) as unknown as typeof fetch;
}

const SEASONS_2026 = [
  { id: 'season-2026', year: 2026, current: true },
];

function event(opts: {
  id: string;
  name: string;
  dateStart: string;
  dateEnd: string;
  circuit?: { name: string; place: string };
  test?: boolean;
}) {
  return {
    id: opts.id,
    name: opts.name,
    sponsored_name: opts.name,
    short_name: opts.name.slice(0, 3),
    date_start: opts.dateStart,
    date_end: opts.dateEnd,
    country: { iso: 'TH', name: 'Thailand', region_iso: '' },
    circuit: {
      id: 'c-1',
      name: opts.circuit?.name ?? 'Test Circuit',
      legacy_id: 1,
      place: opts.circuit?.place ?? 'Test Town',
      nation: 'THA',
    },
    test: opts.test ?? false,
    status: 'FINISHED',
  };
}

function rider(opts: {
  position: number;
  fullName: string;
  number: number;
  team: string;
  constructorName?: string;
  points: number;
  status?: string;
  time?: string;
  gap?: string;
}) {
  return {
    id: `cls-${opts.position}`,
    position: opts.position,
    rider: { id: `r-${opts.number}`, full_name: opts.fullName, number: opts.number },
    team: { id: `t-${opts.team}`, name: opts.team },
    constructor: { id: `c-${opts.constructorName ?? opts.team}`, name: opts.constructorName ?? opts.team },
    average_speed: 179.3,
    gap: { first: opts.gap ?? (opts.position === 1 ? '0.000' : `${opts.position * 1.5}.000`), lap: '0' },
    total_laps: 26,
    time: opts.time ?? (opts.position === 1 ? '39:36.270' : ''),
    points: opts.points,
    status: opts.status ?? 'INSTND',
  };
}

function dnf(opts: { fallbackOrder: number; fullName: string; number: number; team: string }) {
  return {
    id: `cls-dnf-${opts.fallbackOrder}`,
    position: null,
    rider: { id: `r-${opts.number}`, full_name: opts.fullName, number: opts.number },
    team: { id: `t-${opts.team}`, name: opts.team },
    constructor: { id: `c-${opts.team}`, name: opts.team },
    gap: { first: '', lap: '0' },
    total_laps: 12,
    time: '',
    points: 0,
    status: 'OUTSTND',
  };
}

const RAC_CLASSIFICATION = {
  classification: [
    rider({ position: 1, fullName: 'Marco Bezzecchi', number: 72, team: 'Aprilia Racing', points: 25 }),
    rider({ position: 2, fullName: 'Pedro Acosta', number: 37, team: 'Red Bull KTM Factory Racing', points: 20, gap: '5.543' }),
    rider({ position: 3, fullName: 'Marc Marquez', number: 93, team: 'Ducati Lenovo Team', points: 16, gap: '8.012' }),
    rider({ position: 4, fullName: 'Francesco Bagnaia', number: 1, team: 'Ducati Lenovo Team', points: 13, gap: '12.001' }),
    rider({ position: 5, fullName: 'Jorge Martin', number: 89, team: 'Aprilia Racing', points: 11, gap: '15.500' }),
    rider({ position: 6, fullName: 'Brad Binder', number: 33, team: 'Red Bull KTM Factory Racing', points: 10, gap: '18.100' }),
    rider({ position: 7, fullName: 'Fabio Di Giannantonio', number: 49, team: 'Team VR46', points: 9, gap: '22.000' }),
    rider({ position: 8, fullName: 'Alex Marquez', number: 73, team: 'Gresini Racing', points: 8, gap: '24.500' }),
    rider({ position: 9, fullName: 'Enea Bastianini', number: 23, team: 'Tech3 KTM', points: 7, gap: '28.100' }),
    rider({ position: 10, fullName: 'Maverick Vinales', number: 12, team: 'Tech3 KTM', points: 6, gap: '32.000' }),
    rider({ position: 11, fullName: 'Johann Zarco', number: 5, team: 'LCR Honda', points: 5, gap: '40.000' }),
    dnf({ fallbackOrder: 1, fullName: 'Joan Mir', number: 36, team: 'Honda HRC' }),
  ],
};

const SPR_CLASSIFICATION = {
  classification: [
    rider({ position: 1, fullName: 'Marc Marquez', number: 93, team: 'Ducati Lenovo Team', points: 12 }),
    rider({ position: 2, fullName: 'Marco Bezzecchi', number: 72, team: 'Aprilia Racing', points: 9, gap: '1.234' }),
    rider({ position: 3, fullName: 'Pedro Acosta', number: 37, team: 'Red Bull KTM Factory Racing', points: 7, gap: '2.500' }),
    rider({ position: 4, fullName: 'Francesco Bagnaia', number: 1, team: 'Ducati Lenovo Team', points: 6, gap: '3.001' }),
    rider({ position: 5, fullName: 'Jorge Martin', number: 89, team: 'Aprilia Racing', points: 5, gap: '4.500' }),
    rider({ position: 6, fullName: 'Brad Binder', number: 33, team: 'Red Bull KTM Factory Racing', points: 4, gap: '5.100' }),
    rider({ position: 7, fullName: 'Alex Marquez', number: 73, team: 'Gresini Racing', points: 3, gap: '6.000' }),
    rider({ position: 8, fullName: 'Enea Bastianini', number: 23, team: 'Tech3 KTM', points: 2, gap: '7.500' }),
    rider({ position: 9, fullName: 'Maverick Vinales', number: 12, team: 'Tech3 KTM', points: 1, gap: '8.100' }),
    rider({ position: 10, fullName: 'Fabio Di Giannantonio', number: 49, team: 'Team VR46', points: 0, gap: '9.500' }),
    rider({ position: 11, fullName: 'Johann Zarco', number: 5, team: 'LCR Honda', points: 0, gap: '12.000' }),
    rider({ position: 12, fullName: 'Joan Mir', number: 36, team: 'Honda HRC', points: 0, gap: '15.000' }),
  ],
};

describe('fetchMotoGPSeasonResults', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('emits Grand Prix + Sprint per round with full classification', async () => {
    setupFetch({
      seasons: SEASONS_2026,
      events: [
        event({ id: 'tha-1', name: 'GRAND PRIX OF THAILAND', dateStart: '2026-02-27', dateEnd: '2026-03-01', circuit: { name: 'Chang International Circuit', place: 'Buriram' } }),
      ],
      sessionsByEvent: {
        'tha-1': [
          { id: 'fp-1', type: 'FP', date: '2026-02-27T10:45:00+00:00' },
          { id: 'q-1', type: 'Q', date: '2026-02-28T07:15:00+00:00' },
          { id: 'spr-1', type: 'SPR', date: '2026-02-28T12:00:00+00:00' },
          { id: 'rac-1', type: 'RAC', date: '2026-03-01T12:00:00+00:00' },
        ],
      },
      classificationsBySession: {
        'rac-1': RAC_CLASSIFICATION,
        'spr-1': SPR_CLASSIFICATION,
      },
    });
    const races = await fetchMotoGPSeasonResults(2026);
    expect(races).toHaveLength(2);

    const gp = races.find(r => r.raceName.includes('Grand Prix'));
    const sprint = races.find(r => r.raceName.includes('Sprint'));
    expect(gp).toBeDefined();
    expect(sprint).toBeDefined();
    // Grand Prix card before Sprint card.
    expect(races[0].raceName).toBe('Grand Prix Of Thailand — Grand Prix');
    expect(races[1].raceName).toBe('Grand Prix Of Thailand — Sprint');

    // Both have 12 entries including the DNF in RAC.
    expect(gp!.results).toHaveLength(12);
    expect(sprint!.results).toHaveLength(12);

    // RAC winner: Bezzecchi 25pts. Sprint winner: Marquez 12pts.
    expect(gp!.results[0]).toMatchObject({
      position: 1,
      driverName: 'Marco Bezzecchi',
      team: 'Aprilia Racing',
      status: 'Finished',
      points: 25,
    });
    expect(sprint!.results[0].driverName).toBe('Marc Marquez');
    expect(sprint!.results[0].points).toBe(12);

    // DNF in RAC sorts to the bottom with status pulled from Pulselive.
    const dnfEntry = gp!.results[gp!.results.length - 1];
    expect(dnfEntry.driverName).toBe('Joan Mir');
    expect(dnfEntry.status).toBe('OUTSTND');
    expect(dnfEntry.points).toBe(0);

    // Circuit string combines name + place.
    expect(gp!.circuit).toBe('Chang International Circuit, Buriram');

    // Date pulled from date_end.
    expect(gp!.date.toISOString().startsWith('2026-03-01')).toBe(true);
  });

  it('orders rounds chronologically by date_start', async () => {
    setupFetch({
      seasons: SEASONS_2026,
      events: [
        // Returned out-of-order; parser must reorder by date_start.
        event({ id: 'arg-2', name: 'GRAND PRIX OF ARGENTINA', dateStart: '2026-03-13', dateEnd: '2026-03-15', circuit: { name: 'Termas de Río Hondo', place: 'Río Hondo' } }),
        event({ id: 'tha-1', name: 'GRAND PRIX OF THAILAND', dateStart: '2026-02-27', dateEnd: '2026-03-01', circuit: { name: 'Chang', place: 'Buriram' } }),
      ],
      sessionsByEvent: {
        'tha-1': [{ id: 'rac-tha', type: 'RAC' }],
        'arg-2': [{ id: 'rac-arg', type: 'RAC' }],
      },
      classificationsBySession: {
        'rac-tha': RAC_CLASSIFICATION,
        'rac-arg': RAC_CLASSIFICATION,
      },
    });
    const races = await fetchMotoGPSeasonResults(2026);
    // Round numbers follow date_start order; rendering order is newest
    // round first (matches WSBK + the results panel default, audit 1a-9).
    expect(races[0].round).toBe(2);
    expect(races[0].raceName).toContain('Argentina');
    expect(races[1].round).toBe(1);
    expect(races[1].raceName).toContain('Thailand');
  });

  it('filters out test events even when isFinished=true returns them', async () => {
    setupFetch({
      seasons: SEASONS_2026,
      events: [
        event({ id: 'test-sepang', name: 'SEPANG TEST', dateStart: '2026-02-01', dateEnd: '2026-02-03', test: true }),
        event({ id: 'tha-1', name: 'GRAND PRIX OF THAILAND', dateStart: '2026-02-27', dateEnd: '2026-03-01' }),
      ],
      sessionsByEvent: {
        'tha-1': [{ id: 'rac-tha', type: 'RAC' }],
      },
      classificationsBySession: {
        'rac-tha': RAC_CLASSIFICATION,
      },
    });
    const races = await fetchMotoGPSeasonResults(2026);
    expect(races).toHaveLength(1);
    expect(races[0].raceName).toContain('Thailand');
  });

  it('drops a session whose classification has fewer than 10 finishers', async () => {
    const tiny = {
      classification: RAC_CLASSIFICATION.classification.slice(0, 5),
    };
    setupFetch({
      seasons: SEASONS_2026,
      events: [
        event({ id: 'tha-1', name: 'GRAND PRIX OF THAILAND', dateStart: '2026-02-27', dateEnd: '2026-03-01' }),
      ],
      sessionsByEvent: {
        'tha-1': [
          { id: 'rac-1', type: 'RAC' },
          { id: 'spr-1', type: 'SPR' },
        ],
      },
      classificationsBySession: {
        'rac-1': tiny,
        'spr-1': SPR_CLASSIFICATION,
      },
    });
    const races = await fetchMotoGPSeasonResults(2026);
    // RAC dropped under the floor; SPR survives.
    expect(races).toHaveLength(1);
    expect(races[0].raceName).toContain('Sprint');
  });

  it('returns an empty array when seasons fetch fails', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false, status: 500, json: async () => null,
    } as Response)) as unknown as typeof fetch;
    const races = await fetchMotoGPSeasonResults(2026);
    expect(races).toEqual([]);
  });

  it('returns an empty array when no finished events are returned', async () => {
    setupFetch({ seasons: SEASONS_2026, events: [] });
    const races = await fetchMotoGPSeasonResults(2026);
    expect(races).toEqual([]);
  });

  it('returns an empty array when fetch throws', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const races = await fetchMotoGPSeasonResults(2026);
    expect(races).toEqual([]);
  });
});
