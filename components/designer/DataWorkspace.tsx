'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { DATA_SERVICES, DATA_TIERS, findDataService, type DataService, type DataState } from '@/lib/design/data-services';
import type { DataIndexEntry, DataOverview } from '@/lib/design/data';

// The Data workspace (Paddock Designer v2.4, the Data screen; Phase 4, PR 4.1):
// one card per outside service in three tiers, each with its state, three
// figures and a 28-day chart where the reader gives one; a card opens the
// service's page with Overview, Breakdowns, Health and Connection. Every figure
// comes from /api/admin/design/data/<key>, read through the readers the code
// already has and kept for a minute per process; Refresh reads again. A
// credential is only ever named, never shown.

type LoadedIndex = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; services: DataIndexEntry[] };
type LoadedOverview = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; overview: DataOverview };
type Tab = 'overview' | 'breakdowns' | 'health' | 'connection';

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-50';
const CAP = 'font-mono text-9 uppercase tracking-[0.14em] text-text-faint';

const PILL: Record<DataState, { text: string; cls: string }> = {
  live: { text: 'live', cls: 'border-positive text-positive' },
  connect: { text: 'connect', cls: 'border-[color:var(--amber,#e0a52d)] text-[color:var(--amber,#b8860b)]' },
  own: { text: 'own tables', cls: 'border-edit text-edit' },
  error: { text: 'not answering', cls: 'border-negative text-negative' },
};

function Pill({ state }: { state: DataState }) {
  const p = PILL[state];
  return <span className={`inline-block rounded-full border px-2 font-mono text-9 uppercase leading-[18px] tracking-[0.1em] ${p.cls}`}>{p.text}</span>;
}

/** A 28-point area chart of the series, or the caption for why there is none. */
function Chart({ series, state }: { series: DataOverview['series'] | undefined; state: DataState }) {
  const W = 600;
  const H = 120;
  const pad = 10;
  const pts = series?.points ?? [];
  if (pts.length < 2) {
    return (
      <div className="mt-3 border-t border-dashed border-border pt-2">
        <span className={CAP}>{state === 'connect' ? 'no data until connected' : state === 'error' ? 'no data: the reader did not answer' : 'no daily series from this reader'}</span>
      </div>
    );
  }
  const max = Math.max(...pts, 1);
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (pts.length - 1);
  const y = (v: number) => H - pad - (v / max) * (H - 2 * pad);
  const line = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)} ${H - pad} L${pad} ${H - pad} Z`;
  return (
    <div className="mt-3">
      <span className={CAP}>{series!.label}</span>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 block h-[72px] w-full" preserveAspectRatio="none" role="img" aria-label={`${series!.label}: ${pts.length} days, latest ${pts[pts.length - 1]}`}>
        <path d={area} fill="var(--edit-dim)" />
        <path d={line} fill="none" stroke="var(--edit)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function Kpis({ kpis, cols = 3 }: { kpis: DataOverview['kpis'] | undefined; cols?: number }) {
  const shown = kpis && kpis.length ? kpis.slice(0, cols) : Array.from({ length: cols }, () => ({ label: '—', value: '—' as string, note: undefined as string | undefined }));
  return (
    <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {shown.map((k, i) => (
        <div key={i} className="min-w-0">
          <div className="truncate font-mono text-16 font-semibold tabular-nums text-text">{k.value}</div>
          <div className="text-11 leading-tight text-text-muted">{k.label}</div>
          {k.note && <div className="mt-0.5 truncate font-mono text-9 text-text-faint">{k.note}</div>}
        </div>
      ))}
    </div>
  );
}

async function fetchIndex(): Promise<LoadedIndex> {
  try {
    const res = await fetch('/api/admin/design/data', { cache: 'no-store' });
    if (!res.ok) return { state: 'error', message: `The services could not be listed (HTTP ${res.status}).` };
    const d = (await res.json()) as { services: DataIndexEntry[] };
    return { state: 'ready', services: d.services };
  } catch {
    return { state: 'error', message: 'The services could not be listed: network error.' };
  }
}

async function fetchOverview(key: string, fresh: boolean): Promise<LoadedOverview> {
  try {
    const res = await fetch(`/api/admin/design/data/${key}${fresh ? '?fresh=1' : ''}`, { cache: 'no-store' });
    if (!res.ok) return { state: 'error', message: `The figures could not be read (HTTP ${res.status}).` };
    return { state: 'ready', overview: (await res.json()) as DataOverview };
  } catch {
    return { state: 'error', message: 'The figures could not be read: network error.' };
  }
}

export function DataWorkspace() {
  const [index, setIndex] = useState<LoadedIndex>({ state: 'loading' });
  const [overviews, setOverviews] = useState<Record<string, LoadedOverview>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    let cancelled = false;
    void fetchIndex().then(loaded => {
      if (!cancelled) setIndex(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The figures of every service that can have some, read once the index says
  // which those are; a connect card has nothing to read.
  useEffect(() => {
    if (index.state !== 'ready') return;
    let cancelled = false;
    for (const s of index.services) {
      if (s.state === 'connect') continue;
      void fetchOverview(s.key, false).then(loaded => {
        if (!cancelled) setOverviews(o => ({ ...o, [s.key]: loaded }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [index]);

  const refresh = (key: string) => {
    setOverviews(o => ({ ...o, [key]: { state: 'loading' } }));
    void fetchOverview(key, true).then(loaded => setOverviews(o => ({ ...o, [key]: loaded })));
  };

  const indexed = (s: DataService): DataState => (index.state === 'ready' ? (index.services.find(e => e.key === s.key)?.state ?? 'connect') : s.tier === 'own' ? 'own' : 'connect');
  /** A card that can have figures is loading until its answer arrives; a connect card never reads. */
  const overviewOf = (s: DataService): LoadedOverview | undefined => overviews[s.key] ?? (indexed(s) === 'connect' ? undefined : { state: 'loading' });
  const stateOf = (s: DataService): DataState => {
    const ov = overviews[s.key];
    return ov?.state === 'ready' ? ov.overview.state : indexed(s);
  };

  if (index.state === 'loading') return <p className={`${CAP} text-11`}>Loading the services…</p>;
  if (index.state === 'error') return <p className="text-12 text-negative">{index.message}</p>;

  const service = open ? findDataService(open) : null;
  if (service) {
    const ov = overviewOf(service);
    const state = stateOf(service);
    const overview = ov?.state === 'ready' ? ov.overview : null;
    return (
      <div>
        <button type="button" className={`${TB} mb-3`} onClick={() => setOpen(null)}>
          <ArrowLeft size={13} /> All services
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-8 min-w-8 place-items-center border border-border-strong bg-surface px-1.5 font-mono text-10 font-semibold text-text">{service.mono}</span>
          <h2 className="m-0 text-20 font-bold text-text">{service.name}</h2>
          <Pill state={state} />
          <span className="flex-1" />
          {state !== 'connect' && (
            <button type="button" className={TB} disabled={ov?.state === 'loading'} onClick={() => refresh(service.key)}>
              <RefreshCw size={13} className={ov?.state === 'loading' ? 'animate-spin' : ''} /> Refresh
            </button>
          )}
        </div>
        <p className="m-0 mt-1 text-13 text-text-muted">
          {service.api.name} · {service.api.auth}
        </p>
        <div className="mt-4 flex gap-1 border-b border-border" role="tablist" aria-label="Service">
          {(
            [
              ['overview', 'Overview'],
              ['breakdowns', `Breakdowns · ${overview?.breakdowns.length ?? 0}`],
              ['health', 'Health'],
              ['connection', 'Connection'],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              className={`h-8 px-3 font-mono text-10 uppercase tracking-[0.12em] ${tab === k ? 'text-text shadow-[inset_0_-2px_0_var(--edit)]' : 'text-text-muted hover:text-text'}`}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="mt-4 border border-border-strong bg-surface p-4">
            {ov?.state === 'loading' && <p className={`${CAP} m-0 text-11`}>Reading…</p>}
            {ov?.state === 'error' && <p className="m-0 text-12 text-negative">{ov.message}</p>}
            <Kpis kpis={overview?.kpis} cols={Math.min(Math.max(overview?.kpis.length ?? 3, 3), 4)} />
            <Chart series={overview?.series} state={state} />
            {overview?.note && <p className="m-0 mt-3 text-12 text-text-muted">{overview.note}</p>}
            {overview && <p className={`${CAP} m-0 mt-3`}>Read {overview.fetchedAt.replace('T', ' ').slice(0, 19)}Z · kept for a minute · Refresh reads again</p>}
          </div>
        )}
        {tab === 'breakdowns' && (
          <div className="mt-4 grid gap-4">
            {(overview?.breakdowns ?? []).map(b => (
              <div key={b.title} className="border border-border-strong bg-surface">
                <div className={`${CAP} border-b border-border px-3 py-2`}>{b.title}</div>
                <table className="w-full border-collapse text-12">
                  <thead>
                    <tr className="text-left text-text-faint">
                      {b.cols.map(c => (
                        <th key={c} className="px-3 py-1.5 font-semibold">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        {r.map((cell, j) => (
                          <td key={j} className={`px-3 py-1.5 ${j > 0 ? 'font-mono text-11 tabular-nums text-text-muted' : 'text-text'}`}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {b.rows.length === 0 && (
                      <tr className="border-t border-border">
                        <td colSpan={b.cols.length} className="px-3 py-3 text-center text-text-faint">
                          Nothing yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
            {(overview?.breakdowns ?? []).length === 0 && (
              <p className="m-0 text-12 text-text-faint">{state === 'connect' ? 'Breakdowns arrive once the service is connected.' : 'This reader gives totals; breakdowns arrive with a later step.'}</p>
            )}
          </div>
        )}
        {tab === 'health' && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="border border-border-strong bg-surface">
              <div className={`${CAP} border-b border-border px-3 py-2`}>Freshness and limits</div>
              <table className="w-full border-collapse text-12">
                <tbody>
                  {service.health.map(([k, v]) => (
                    <tr key={k} className="border-t border-border first:border-t-0">
                      <td className="w-40 px-3 py-1.5 text-text-muted">{k}</td>
                      <td className="px-3 py-1.5 text-text">{v}</td>
                    </tr>
                  ))}
                  {overview?.note && (
                    <tr className="border-t border-border">
                      <td className="px-3 py-1.5 text-text-muted">Last read</td>
                      <td className="px-3 py-1.5 text-text">{overview.note}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="border border-border-strong bg-surface p-3">
              <div className={`${CAP} mb-2`}>Gaps · what this service cannot tell</div>
              <ul className="m-0 list-none p-0 text-12 text-text-muted">
                {service.gaps.map(g => (
                  <li key={g} className="py-0.5">
                    · {g}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {tab === 'connection' && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="border border-border-strong bg-surface">
              <div className={`${CAP} border-b border-border px-3 py-2`}>How it connects</div>
              <table className="w-full border-collapse text-12">
                <tbody>
                  <tr>
                    <td className="w-40 px-3 py-1.5 text-text-muted">API</td>
                    <td className="px-3 py-1.5 text-text">{service.api.name}</td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="px-3 py-1.5 text-text-muted">Auth</td>
                    <td className="px-3 py-1.5 text-text">{service.api.auth}</td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="px-3 py-1.5 text-text-muted">Lives in</td>
                    <td className="px-3 py-1.5 text-text">{service.where}</td>
                  </tr>
                </tbody>
              </table>
              <div className={`${CAP} border-t border-border px-3 py-2`}>Credentials · by name, never by value</div>
              <ul className="m-0 list-none px-3 pb-3 pt-1">
                {(overview?.connection ?? service.cred.map(name => ({ name, present: false }))).map(c => (
                  <li key={c.name} className="flex items-center gap-2 py-0.5 font-mono text-11">
                    <span className={c.present ? 'text-positive' : 'text-text-faint'}>{c.present ? '●' : '○'}</span>
                    <span className="text-text">{c.name}</span>
                    <span className="text-text-faint">{overview ? (c.present ? 'present' : 'missing') : ''}</span>
                  </li>
                ))}
                {service.cred.length === 0 && <li className="py-0.5 text-12 text-text-faint">None: nothing to connect.</li>}
              </ul>
            </div>
            {service.steps && (
              <div className="border border-border-strong bg-surface p-3">
                <div className={`${CAP} mb-2`}>To connect</div>
                <ol className="m-0 pl-5 text-12 text-text-muted">
                  {service.steps.map((s, i) => (
                    <li key={i} className="py-0.5">
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2 className="m-0 mb-1 text-20 font-bold text-text">Data · what the outside world reports</h2>
      <p className="m-0 mb-4 max-w-[80ch] text-13 text-text-muted">
        One card per service the site talks to. Live cards read the figures through the readers the code already has, kept for a minute;
        connect cards say which credential you would create; the rest show what our own tables record. Nothing here is written anywhere.
      </p>
      {DATA_TIERS.map(t => {
        const items = DATA_SERVICES.filter(s => s.tier === t.tier);
        return (
          <section key={t.tier} className="mb-5" aria-label={t.label}>
            <h3 className={`${CAP} m-0 mb-2`}>{t.label}</h3>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {items.map(s => {
                const ov = overviewOf(s);
                const state = stateOf(s);
                const overview = ov?.state === 'ready' ? ov.overview : null;
                return (
                  <button
                    key={s.key}
                    type="button"
                    aria-label={`Open ${s.name}`}
                    className="min-w-0 border border-border-strong bg-surface p-3.5 text-left transition-colors duration-(--duration-fast) hover:border-text-muted"
                    onClick={() => {
                      setOpen(s.key);
                      setTab('overview');
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="grid h-8 min-w-8 place-items-center border border-border-strong bg-bg px-1.5 font-mono text-10 font-semibold text-text">{s.mono}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-13 font-semibold text-text">{s.name}</span>
                        <span className="block text-11 leading-tight text-text-muted">{s.api.name}</span>
                      </span>
                      <Pill state={state} />
                    </div>
                    {ov?.state === 'error' && <p className="m-0 mt-3 text-11 text-negative">{ov.message}</p>}
                    <Kpis kpis={overview?.kpis} />
                    <Chart series={overview?.series} state={state} />
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
