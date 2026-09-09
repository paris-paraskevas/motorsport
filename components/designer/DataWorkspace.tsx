'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { BAND_LABEL, DATA_SERVICES, DATA_TIERS, bandOf, findDataService, type DataBand, type DataService, type DataState } from '@/lib/design/data-services';
import type { DataIndexEntry, DataOverview } from '@/lib/design/data';
import { DataRuns } from './DataRuns';
import { BTN, Band, RuledTable, Strip, Swatch, TONE_VARS, toneColor, type StripCell } from './data-ui';

// The Data workspace (Paddock Designer v2.4, the Data screen; Phase 4, PR 4.1,
// redrawn to the operator's brief in PR 4.2): a strip that counts the states
// in colour, then one card per outside service in three tiers, each wearing a
// solid band (green fine, amber attention, red problem, grey not connected,
// blue-grey our own records) over one large figure and one line of context. A
// card opens the service's page with Overview, Breakdowns, Health and
// Connection; the loader's runs have a page of their own. Every figure comes
// from /api/admin/design/data/<key>, read through the readers the code already
// has and kept for a minute per process; Refresh reads again. A credential is
// only ever named, never shown.

type LoadedIndex = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; services: DataIndexEntry[] };
type LoadedOverview = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; overview: DataOverview };
type Tab = 'overview' | 'breakdowns' | 'health' | 'connection';
type View = { kind: 'home' } | { kind: 'service'; key: string } | { kind: 'runs' };

const RUNS_SERVICES = new Set(['sb', 'upstream']);

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

/** A 28-point area chart of the series, or nothing. */
function Chart({ series }: { series: DataOverview['series'] | undefined }) {
  const W = 600;
  const H = 120;
  const pad = 10;
  const pts = series?.points ?? [];
  if (pts.length < 2) return null;
  const max = Math.max(...pts, 1);
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (pts.length - 1);
  const y = (v: number) => H - pad - (v / max) * (H - 2 * pad);
  const line = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)} ${H - pad} L${pad} ${H - pad} Z`;
  return (
    <div className="border-t border-border-strong px-4 pb-4 pt-3">
      <div className="text-13 text-text-muted">{series!.label}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 block h-[96px] w-full" preserveAspectRatio="none" role="img" aria-label={`${series!.label}: ${pts.length} days, latest ${pts[pts.length - 1]}`}>
        <path d={area} fill="var(--edit-dim)" />
        <path d={line} fill="none" stroke="var(--edit)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

/** The band's word beside a swatch, for a title row. */
function BandWord({ band }: { band: DataBand }) {
  return (
    <span className="text-13 font-semibold uppercase tracking-[0.08em]" style={{ color: toneColor(band) }}>
      <Swatch band={band} />
      {BAND_LABEL[band]}
    </span>
  );
}

export function DataWorkspace() {
  const [index, setIndex] = useState<LoadedIndex>({ state: 'loading' });
  const [overviews, setOverviews] = useState<Record<string, LoadedOverview>>({});
  const [view, setView] = useState<View>({ kind: 'home' });
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
    return ov?.state === 'ready' ? ov.overview.state : ov?.state === 'error' ? 'error' : indexed(s);
  };
  const bandFor = (s: DataService): DataBand => {
    const ov = overviews[s.key];
    return bandOf(stateOf(s), ov?.state === 'ready' ? ov.overview.tone : undefined);
  };

  if (index.state === 'loading') return <p className="m-0 text-15 text-text-muted">Loading the services…</p>;
  if (index.state === 'error') return <p className="m-0 text-15 text-negative">{index.message}</p>;

  if (view.kind === 'runs') {
    return (
      <div style={TONE_VARS}>
        <DataRuns onBack={() => setView({ kind: 'home' })} />
      </div>
    );
  }

  const service = view.kind === 'service' ? findDataService(view.key) : null;
  if (service) {
    const ov = overviewOf(service);
    const band = bandFor(service);
    const overview = ov?.state === 'ready' ? ov.overview : null;
    const h = overview?.headline;
    return (
      <div style={TONE_VARS}>
        <button type="button" className={BTN} onClick={() => setView({ kind: 'home' })}>
          <ArrowLeft size={15} /> All services
        </button>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="grid h-9 min-w-9 place-items-center border border-border-strong bg-surface-elevated px-2 font-mono text-12 font-semibold text-text">{service.mono}</span>
          <h2 className="m-0 text-22 font-bold text-text">{service.name}</h2>
          <BandWord band={band} />
          <span className="flex-1" />
          {RUNS_SERVICES.has(service.key) && (
            <button type="button" className={BTN} onClick={() => setView({ kind: 'runs' })}>
              Open the runs
            </button>
          )}
          {stateOf(service) !== 'connect' && (
            <button type="button" className={BTN} disabled={ov?.state === 'loading'} onClick={() => refresh(service.key)}>
              <RefreshCw size={15} className={ov?.state === 'loading' ? 'animate-spin' : ''} /> Refresh
            </button>
          )}
        </div>
        <p className="m-0 mt-1 text-15 text-text-muted">
          {service.api.name} · {service.api.auth}
        </p>
        <div className="mt-5 flex border-b border-border-strong" role="tablist" aria-label="Service">
          {(
            [
              ['overview', 'Overview'],
              ['breakdowns', `Breakdowns${overview ? ` · ${overview.breakdowns.length}` : ''}`],
              ['health', 'Health'],
              ['connection', 'Connection'],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              className={`h-10 px-4 text-14 font-semibold ${tab === k ? 'text-text shadow-[inset_0_-3px_0_var(--edit)]' : 'text-text-muted hover:text-text'}`}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="mt-5 border border-border-strong bg-surface-elevated">
            <Band band={band}>{BAND_LABEL[band]}</Band>
            <div className="grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
              <div className="grid content-start gap-1.5 border-b border-border-strong px-4 pt-4 pb-5 md:border-b-0 md:border-r">
                {ov?.state === 'loading' && <span className="text-15 text-text-muted">Reading…</span>}
                {ov?.state === 'error' && <span className="text-15" style={{ color: 'var(--bad)' }}>{ov.message}</span>}
                {h && (
                  <>
                    <span className="text-40 font-bold leading-[1.05] tracking-[-0.02em] tabular-nums" style={{ color: band === 'ok' || band === 'own' ? undefined : toneColor(band) }}>
                      {h.value}
                      {h.unit && <span className="ml-2 text-15 font-medium tracking-normal text-text-muted">{h.unit}</span>}
                    </span>
                    <span className="text-15 text-text-muted">{h.context}</span>
                  </>
                )}
                {!h && ov?.state !== 'loading' && ov?.state !== 'error' && <span className="text-15 text-text-muted">Nothing to read until the service is connected.</span>}
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3">
                {(overview?.kpis ?? []).map((k, i) => (
                  <div key={i} className="min-w-0 border-b border-r border-border px-4 py-3 last:border-r-0 [&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(3n)]:border-r-0">
                    <div className="truncate text-24 font-bold tabular-nums text-text">{k.value}</div>
                    <div className="text-13 text-text-muted">{k.label}</div>
                    {k.note && <div className="truncate text-12 text-text-faint">{k.note}</div>}
                  </div>
                ))}
              </div>
            </div>
            <Chart series={overview?.series} />
            {(overview?.note || overview) && (
              <div className="border-t border-border px-4 py-2.5 text-13 text-text-muted">
                {overview?.note && <span className="mr-3 text-text">{overview.note}</span>}
                {overview && <span className="text-text-faint">Read {overview.fetchedAt.replace('T', ' ').slice(0, 19)}Z · kept for a minute · Refresh reads again</span>}
              </div>
            )}
          </div>
        )}
        {tab === 'breakdowns' && (
          <div className="mt-5 grid gap-5">
            {(overview?.breakdowns ?? []).map(b => (
              <RuledTable key={b.title} title={b.title} cols={b.cols} numeric={b.cols.map((_, j) => j).filter(j => j > 0)} rows={b.rows} />
            ))}
            {(overview?.breakdowns ?? []).length === 0 && (
              <p className="m-0 text-15 text-text-muted">{stateOf(service) === 'connect' ? 'Breakdowns arrive once the service is connected.' : 'This reader gives totals; breakdowns arrive with a later step.'}</p>
            )}
          </div>
        )}
        {tab === 'health' && (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <RuledTable
              title="Freshness and limits"
              cols={['What', 'How it stands']}
              rows={[...service.health.map(([k, v]) => [k, v] as string[]), ...(overview?.note ? [['Last read', overview.note]] : [])]}
            />
            <RuledTable title="Gaps · what this service cannot tell" cols={['Gap']} rows={service.gaps.map(g => [g])} empty="None known." />
          </div>
        )}
        {tab === 'connection' && (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="grid content-start gap-5">
              <RuledTable
                title="How it connects"
                cols={['What', 'Where']}
                rows={[
                  ['API', service.api.name],
                  ['Auth', service.api.auth],
                  ['Lives in', service.where],
                ]}
              />
              <RuledTable
                title="Credentials · by name, never by value"
                cols={['Name', 'Held here']}
                rows={(overview?.connection ?? service.cred.map(name => ({ name, present: false }))).map(c => [
                  <span key="n" className="font-mono text-14">
                    {c.name}
                  </span>,
                  <span key="p" style={{ color: c.present ? 'var(--ok)' : 'var(--off)' }}>
                    <Swatch band={c.present ? 'ok' : 'off'} />
                    {overview ? (c.present ? 'present' : 'missing') : 'not read'}
                  </span>,
                ])}
                empty="None: nothing to connect."
              />
            </div>
            {service.steps && <RuledTable title="To connect" cols={['Step']} rows={service.steps.map((s, i) => [`${i + 1}. ${s}`])} />}
          </div>
        )}
      </div>
    );
  }

  const bands = DATA_SERVICES.map(bandFor);
  const count = (...b: DataBand[]) => String(bands.filter(x => b.includes(x)).length);
  const cells: StripCell[] = [
    { n: count('ok', 'own'), label: 'fine', band: 'ok' },
    { n: count('warn'), label: 'need attention', band: 'warn' },
    { n: count('bad'), label: 'problems', band: 'bad' },
    { n: count('off'), label: 'not connected', band: 'off' },
  ];
  const loader = overviews.upstream?.state === 'ready' ? overviews.upstream.overview : null;

  return (
    <div style={TONE_VARS}>
      <h2 className="m-0 text-22 font-bold text-text">Data</h2>
      <p className="m-0 mt-1 mb-5 max-w-[78ch] text-15 text-text-muted">
        What the outside world reports about paddock-tracker.com. Live figures are read through the readers the code already has and kept for a
        minute; nothing here is written anywhere.
      </p>
      <Strip cells={cells} label="What is up" />
      <div className="mt-3 flex flex-wrap items-center gap-3 border border-border-strong bg-surface-elevated px-4 py-2.5">
        <span className="text-15 font-semibold text-text">Loads</span>
        <span className="text-15 text-text-muted">
          {loader?.headline ? `${loader.headline.value} ${loader.headline.unit} · ${loader.headline.context}` : overviews.upstream?.state === 'error' ? overviews.upstream.message : 'Reading the loader’s runs…'}
        </span>
        <span className="flex-1" />
        <button type="button" className={BTN} onClick={() => setView({ kind: 'runs' })}>
          Open the runs
        </button>
      </div>
      {DATA_TIERS.map(t => {
        const items = DATA_SERVICES.filter(s => s.tier === t.tier);
        return (
          <section key={t.tier} aria-label={t.label}>
            <h3 className="m-0 mt-7 mb-2 text-16 font-semibold text-text">{t.label}</h3>
            <div className="grid border border-border-strong border-r-0 border-b-0 bg-surface-elevated md:grid-cols-2 xl:grid-cols-3">
              {items.map(s => {
                const ov = overviewOf(s);
                const band = bandFor(s);
                const overview = ov?.state === 'ready' ? ov.overview : null;
                const h = overview?.headline;
                const figure = ov?.state === 'loading' ? '…' : (h?.value ?? '—');
                const context = ov?.state === 'loading' ? 'Reading…' : ov?.state === 'error' ? ov.message : (h?.context ?? (s.cred.length ? `Not connected · ${s.cred.length} credential${s.cred.length === 1 ? '' : 's'} to add` : 'Not connected'));
                const coloured = band === 'warn' || band === 'bad' || band === 'off';
                return (
                  <button
                    key={s.key}
                    type="button"
                    aria-label={`Open ${s.name}`}
                    className="grid min-w-0 grid-rows-[auto_1fr] border-r border-b border-border-strong text-left transition-colors duration-(--duration-fast) hover:bg-(--edit-dim)"
                    onClick={() => {
                      setView({ kind: 'service', key: s.key });
                      setTab('overview');
                    }}
                  >
                    <Band band={band}>{BAND_LABEL[band]}</Band>
                    <span className="grid content-start gap-1.5 px-4 pt-3.5 pb-4">
                      <span className="truncate text-16 font-semibold text-text">{s.name}</span>
                      <span className="text-32 font-bold leading-[1.1] tracking-[-0.02em] tabular-nums text-text" style={coloured ? { color: toneColor(band) } : undefined}>
                        {figure}
                        {h?.unit && ov?.state === 'ready' && <span className="ml-2 text-14 font-medium tracking-normal text-text-muted">{h.unit}</span>}
                      </span>
                      <span className="text-14 text-text-muted">{context}</span>
                    </span>
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
