'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { FRESH_NOTE, REMOTE_SERVERS, SERIES_OPTIONS, SOURCES, defaultSourceRef, encodeSourceRef, type SourceColumn, type SourceDefinition, type SourceParameter, type SourceRef } from '@/lib/design/sources';

// Data Sources (the components programme, P2.1; APEX: REST Data Sources, ours
// by name: the sources are the code's readers, not endpoints): the catalogue's
// thirteen in a table with their parameters, columns (APEX: the Data Profile),
// how they are kept fresh, Utilization and History; one opened below with how
// it is read (the tier, the loader keys, the remote server per series), its
// loading method, where it is used, and a Preview through the reader. The same
// browser, in its `data` mode, is the Data workspace's Object Browser (APEX's
// name, SQL Workshop): the loader's work behind a source in its two tiers, the
// rows tier's runs and the snapshot tier's fetches, in the catalogue's words.
// The catalogue itself is code and travels with the page; the route adds only
// what needs the database.

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';
const TB_PRIMARY = `${TB} border-edit text-edit hover:bg-edit-dim hover:text-text`;
const PBTN =
  'border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-35';
const FIELD = 'w-full border border-border-strong bg-bg px-2 py-1 text-12-5 leading-snug text-text focus:border-edit focus:outline-none disabled:opacity-60';
const CHIP = 'inline-block border px-1.5 py-0.5 font-mono text-9 uppercase tracking-[0.12em]';
const TH = 'px-2.5 py-1.5 text-left font-mono text-9 font-normal uppercase tracking-[0.14em] text-text-faint';
const TD = 'px-2.5 py-1.5 align-top text-12';
const DT = 'font-mono text-10 uppercase tracking-[0.14em] text-text-faint';

export interface SeriesName {
  slug: string;
  name: string;
}
interface UsedOn {
  id: string;
  path: string;
  name: string;
  refs: string[];
}
interface RunEntry {
  key: string;
  label: string;
  state: string;
  newest: { status: string; rows: number; started: string | null; finished: string | null; runner: string | null; error: string | null } | null;
}
interface SnapshotEntry {
  key: string;
  label: string;
  fetchedAt: string | null;
  ok: boolean;
  stale: boolean;
  meta: { run: string; at: string; F?: number; W?: number } | null;
}
interface ListEntry {
  key: string;
  usedOn: UsedOn[];
  runs: RunEntry[];
  snapshots: SnapshotEntry[];
}
type LoadedList = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; entries: Record<string, ListEntry> };
type Cell = string | number | boolean | null;
interface Preview {
  key: string;
  label: string;
  columns: SourceColumn[];
  rows: Record<string, Cell>[];
  total: number;
  provenance: { tier: string; rows: number; run?: { id: string; status: string; runner: string | null } | null; meta?: { run: string; at: string; F?: number; W?: number } | null; error?: string };
}
type LoadedPreview = { state: 'idle' } | { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; preview: Preview };

const EMPTY_ENTRY = (key: string): ListEntry => ({ key, usedOn: [], runs: [], snapshots: [] });
const stamp = (iso: string | null | undefined) => (iso ? `${iso.replace('T', ' ').slice(0, 16)}Z` : '—');
const pagesText = (n: number) => (n === 0 ? 'no page' : `${n} ${n === 1 ? 'page' : 'pages'}`);
const paramsText = (s: SourceDefinition) => (s.parameters.length ? s.parameters.map(p => p.key).join(' · ') : 'none');
const cellText = (v: Cell) => (v === null ? '—' : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v));

/** Where the rows come from, in words: the tiers behind each freshness. */
function readFromText(s: SourceDefinition): string {
  if (s.key === 'standings') return 'the rows tier (standing_current, the loader’s runs), else the snapshot tier (the loader’s last good copy)';
  switch (s.fresh) {
    case 'loader':
      return 'the snapshot tier, the loader’s last good copy';
    case 'content':
      return 'the content bundle, deployed with the site';
    case 'db':
      return 'the database tables, read at request time';
    default:
      return 'upstream at request time, the content fallback when it fails';
  }
}

/** The remote servers behind a source, per series: `Jolpica API (Formula 1) · FOM API (Formula 2, Formula 3)`. */
function hostsText(s: SourceDefinition, series: readonly SeriesName[]): string {
  const byHost = new Map<string, string[]>();
  for (const [slug, host] of Object.entries(s.hosts ?? {})) byHost.set(host, [...(byHost.get(host) ?? []), series.find(x => x.slug === slug)?.name ?? SERIES_OPTIONS.find(o => o.key === slug)?.label ?? slug]);
  return [...byHost].map(([host, names]) => `${REMOTE_SERVERS.find(r => r.key === host)?.name ?? host} (${names.join(', ')})`).join(' · ');
}

/** The series a parameter offers, by the names the designer holds (the catalogue's when it has none). */
function seriesChoices(param: SourceParameter, series: readonly SeriesName[]): SeriesName[] {
  const offered = param.options ?? SERIES_OPTIONS;
  const names = series.length ? series : offered.map(o => ({ slug: o.key, name: o.label }));
  return names.filter(n => offered.some(o => o.key === n.slug));
}

function parameterWords(p: SourceParameter): string {
  const range = p.kind === 'series' ? `one of ${p.options?.length ?? SERIES_OPTIONS.length} series` : p.kind === 'season' ? 'the season the loader warms' : p.kind === 'number' ? `a number from ${p.min ?? 0} to ${p.max ?? '∞'}` : p.kind === 'choice' ? (p.options ?? []).map(o => o.label).join(' · ') : 'text';
  return `${range} · default ${p.default === undefined ? 'none' : String(p.default)}${p.required ? '' : ' · optional'}`;
}

async function fetchList(): Promise<LoadedList> {
  try {
    const res = await fetch('/api/admin/design/data/sources', { cache: 'no-store' });
    if (!res.ok) return { state: 'error', message: `The sources could not be listed (HTTP ${res.status}).` };
    const d = (await res.json()) as { sources: ListEntry[] };
    return { state: 'ready', entries: Object.fromEntries(d.sources.map(e => [e.key, e])) };
  } catch {
    return { state: 'error', message: 'The sources could not be listed: network error.' };
  }
}

function ParameterField({ param, value, series, onChange }: { param: SourceParameter; value: string | number | undefined; series: readonly SeriesName[]; onChange: (v: string | number | undefined) => void }) {
  if (param.kind === 'series') {
    return (
      <select className={FIELD} value={String(value ?? '')} onChange={e => onChange(e.target.value)}>
        {!param.required && <option value="">every series</option>}
        {seriesChoices(param, series).map(o => (
          <option key={o.slug} value={o.slug}>
            {o.name}
          </option>
        ))}
      </select>
    );
  }
  if (param.kind === 'season' || param.kind === 'choice') {
    return (
      <select className={FIELD} value={String(value ?? '')} onChange={e => onChange(param.kind === 'season' ? Number(e.target.value) : e.target.value)}>
        {(param.options ?? []).map(o => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (param.kind === 'number') return <input type="number" className={FIELD} value={value === undefined ? '' : Number(value)} min={param.min} max={param.max} onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />;
  return <input type="text" className={FIELD} value={String(value ?? '')} maxLength={120} onChange={e => onChange(e.target.value)} />;
}

/**
 * The catalogue as a table, one source opened below it. `shared` shows the
 * shared component's side (Utilization, History); `data` the Object Browser's
 * (the loader's work in its two tiers). Both preview the rows.
 */
export function SourceBrowser({ series, mode, onOpenPage }: { series: readonly SeriesName[]; mode: 'shared' | 'data'; onOpenPage?: (id: string) => void }) {
  const [list, setList] = useState<LoadedList>({ state: 'loading' });
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [pick, setPick] = useState<SourceRef | null>(null);
  const [preview, setPreview] = useState<LoadedPreview>({ state: 'idle' });

  useEffect(() => {
    let cancelled = false;
    void fetchList().then(loaded => {
      if (!cancelled) setList(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const open = openKey ? (SOURCES.find(s => s.key === openKey) ?? null) : null;
  const entry = open && list.state === 'ready' ? (list.entries[open.key] ?? EMPTY_ENTRY(open.key)) : open ? EMPTY_ENTRY(open.key) : null;

  const openSource = (s: SourceDefinition) => {
    setOpenKey(s.key);
    setPick(defaultSourceRef(s));
    setPreview({ state: 'idle' });
  };

  const load = async () => {
    if (!open || !pick) return;
    setPreview({ state: 'loading' });
    const encoded = encodeSourceRef(pick);
    const q = encoded.includes('?') ? encoded.slice(encoded.indexOf('?')) : '';
    try {
      const res = await fetch(`/api/admin/design/data/sources/${encodeURIComponent(open.key)}${q}`, { cache: 'no-store' });
      const d = (await res.json().catch(() => ({}))) as Preview & { error?: string };
      if (!res.ok) {
        setPreview({ state: 'error', message: d.error ?? `The rows could not be read (HTTP ${res.status}).` });
        return;
      }
      setPreview({ state: 'ready', preview: d });
    } catch {
      setPreview({ state: 'error', message: 'The rows could not be read: network error.' });
    }
  };

  const statusText = (): string => {
    if (preview.state === 'loading') return 'Reading…';
    if (preview.state === 'error') return preview.message;
    if (preview.state !== 'ready') return '';
    const p = preview.preview;
    const parts = [`${p.rows.length} of ${p.total} rows`, `the ${p.provenance.tier} tier`];
    if (p.provenance.run) parts.push(`run ${p.provenance.run.runner ?? p.provenance.run.id}`, p.provenance.run.status);
    if (p.provenance.meta) parts.push(p.provenance.meta.run, stamp(p.provenance.meta.at));
    if (p.provenance.error) parts.push(p.provenance.error);
    return parts.join(' · ');
  };

  if (list.state === 'loading') return <p className="m-0 font-mono text-11 uppercase tracking-[0.16em] text-text-faint">Loading the sources…</p>;
  if (list.state === 'error') return <p className="m-0 text-12 text-negative">{list.message}</p>;

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto border border-border-strong bg-surface">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={TH}>Name</th>
              <th className={TH}>Parameters</th>
              <th className={TH}>Columns</th>
              <th className={TH}>Kept fresh</th>
              <th className={TH}>Used on</th>
              <th className={TH}>Changed</th>
              <th className={TH}></th>
            </tr>
          </thead>
          <tbody>
            {SOURCES.map(s => {
              const e = list.entries[s.key] ?? EMPTY_ENTRY(s.key);
              return (
                <tr key={s.key} className={`border-b border-border ${openKey === s.key ? 'bg-edit-dim/40' : ''}`}>
                  <td className={TD}>
                    <b className="font-semibold text-text">{s.name}</b>
                    <div className="font-mono text-10 text-text-faint">{s.key}</div>
                  </td>
                  <td className={`${TD} font-mono text-11`}>{paramsText(s)}</td>
                  <td className={TD}>{s.columns.length}</td>
                  <td className={TD}>{FRESH_NOTE[s.fresh]}</td>
                  <td className={TD}>{pagesText(e.usedOn.length)}</td>
                  <td className={`${TD} font-mono text-10 text-text-faint`}>shipped</td>
                  <td className={TD}>
                    <button type="button" className={PBTN} aria-label={`Open ${s.name}`} onClick={() => openSource(s)}>
                      Open
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && entry && pick && (
        <section aria-label={`Data Source: ${open.name}`} className="grid gap-3 border border-border-strong bg-surface p-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="m-0 font-serif text-18 font-medium text-text">{open.name}</h3>
            <span className="font-mono text-10 text-text-faint">{open.key}</span>
            <span className={`${CHIP} border-border-strong text-text-muted`}>{open.fresh}</span>
            <span className="text-12 text-text-muted">{open.holds}</span>
          </div>

          <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-12">
            <dt className={DT}>Parameters</dt>
            <dd className="m-0 text-text-muted">
              {open.parameters.length === 0 ? (
                'none'
              ) : (
                <ul className="m-0 grid list-none gap-0.5 p-0">
                  {open.parameters.map(p => (
                    <li key={p.key}>
                      <b className="font-semibold text-text">{p.label}</b> <span className="font-mono text-10 text-text-faint">{p.key}</span> · {parameterWords(p)}
                      {p.help ? <span className="text-text-faint"> · {p.help}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
            <dt className={DT}>Columns</dt>
            <dd className="m-0 text-text-muted">
              <span className="flex flex-wrap gap-1">
                {open.columns.map(c => (
                  <code key={c.key} className={`${CHIP} border-border-strong text-text`} title={`${c.label} · ${c.type}`}>
                    {c.key}
                  </code>
                ))}
              </span>
              <span className="mt-1 block text-11 text-text-faint">The Data Profile: {open.columns.map(c => `${c.label} (${c.type})`).join(', ')}.</span>
            </dd>
            <dt className={DT}>Kept fresh</dt>
            <dd className="m-0 text-text-muted">{FRESH_NOTE[open.fresh]}</dd>
            <dt className={DT}>Read from</dt>
            <dd className="m-0 text-text-muted">
              {readFromText(open)}
              {open.hosts ? ` · remote servers: ${hostsText(open, series)}` : ''}
            </dd>
            <dt className={DT}>Loading</dt>
            <dd className="m-0 text-text-muted">{open.load}</dd>
            {mode === 'shared' && (
              <>
                <dt className={DT}>Used on</dt>
                <dd className="m-0 text-text-muted">
                  {entry.usedOn.length === 0
                    ? 'no page yet'
                    : entry.usedOn.map((p, i) => (
                        <span key={p.id}>
                          {i > 0 && ', '}
                          {onOpenPage ? (
                            <button type="button" className="text-edit underline-offset-2 hover:underline" aria-label={`Open ${p.name}`} onClick={() => onOpenPage(p.id)}>
                              {p.name}
                            </button>
                          ) : (
                            p.name
                          )}
                          <span className="ml-1 font-mono text-10 text-text-faint">{p.refs.join(', ')}</span>
                        </span>
                      ))}
                </dd>
                <dt className={DT}>History</dt>
                <dd className="m-0 text-text-muted">shipped with the code; no row yet (rows arrive with the first remote source)</dd>
              </>
            )}
          </dl>

          {mode === 'data' && (
            <div className="grid gap-3">
              {entry.runs.length > 0 && (
                <table className="w-full border-collapse border border-border" aria-label="The rows tier">
                  <caption className="px-2.5 py-1.5 text-left font-mono text-10 uppercase tracking-[0.14em] text-text-muted">The rows tier · the loader’s runs</caption>
                  <thead>
                    <tr className="border-b border-border">
                      <th className={TH}>Source</th>
                      <th className={TH}>Key</th>
                      <th className={TH}>State</th>
                      <th className={TH}>Rows</th>
                      <th className={TH}>Finished</th>
                      <th className={TH}>Runner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entry.runs.map(r => (
                      <tr key={r.key} className="border-b border-border last:border-b-0">
                        <td className={TD}>{r.label}</td>
                        <td className={`${TD} font-mono text-10 text-text-faint`}>{r.key}</td>
                        <td className={TD}>{r.state}</td>
                        <td className={`${TD} tabular-nums`}>{r.newest ? r.newest.rows.toLocaleString('en-GB') : '—'}</td>
                        <td className={TD}>{stamp(r.newest?.finished ?? r.newest?.started)}</td>
                        <td className={`${TD} font-mono text-10 text-text-muted`}>{r.newest?.runner ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {entry.snapshots.length > 0 && (
                <table className="w-full border-collapse border border-border" aria-label="The snapshot tier">
                  <caption className="px-2.5 py-1.5 text-left font-mono text-10 uppercase tracking-[0.14em] text-text-muted">The snapshot tier · the loader’s last good copies</caption>
                  <thead>
                    <tr className="border-b border-border">
                      <th className={TH}>Source</th>
                      <th className={TH}>Key</th>
                      <th className={TH}>Fetched</th>
                      <th className={TH}>State</th>
                      <th className={TH}>Run</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entry.snapshots.map(sn => (
                      <tr key={sn.key} className="border-b border-border last:border-b-0">
                        <td className={TD}>{sn.label}</td>
                        <td className={`${TD} font-mono text-10 text-text-faint`}>{sn.key}</td>
                        <td className={TD}>{stamp(sn.fetchedAt)}</td>
                        <td className={TD}>{sn.stale ? 'stale' : sn.ok ? 'fine' : 'failed'}</td>
                        <td className={`${TD} font-mono text-10 text-text-muted`}>
                          {sn.meta ? [sn.meta.run, stamp(sn.meta.at), ...[sn.meta.F !== undefined ? `F ${sn.meta.F}ms` : null, sn.meta.W !== undefined ? `W ${sn.meta.W}ms` : null].filter(Boolean)].join(' · ') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {entry.runs.length === 0 && entry.snapshots.length === 0 && <p className="m-0 text-12 text-text-muted">The loader keeps nothing for this source.</p>}
            </div>
          )}

          <form
            aria-label="Preview"
            className="grid items-end gap-2 border border-border bg-bg p-3 sm:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]"
            onSubmit={e => {
              e.preventDefault();
              void load();
            }}
          >
            {open.parameters.map(p => (
              <label key={p.key} className="grid gap-1 text-11 text-text-muted">
                {p.label}
                <ParameterField
                  param={p}
                  value={pick.params[p.key]}
                  series={series}
                  onChange={v => {
                    const params = { ...pick.params };
                    if (v === undefined || v === '') delete params[p.key];
                    else params[p.key] = v;
                    setPick({ ...pick, params });
                  }}
                />
              </label>
            ))}
            <div className="flex gap-2">
              <button type="submit" className={TB_PRIMARY} disabled={preview.state === 'loading'}>
                {preview.state === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null} Load
              </button>
            </div>
          </form>

          {preview.state === 'ready' && preview.preview.rows.length > 0 && (
            <div className="overflow-x-auto border border-border">
              <table className="w-full border-collapse" aria-label="Preview rows">
                <thead>
                  <tr className="border-b border-border">
                    {preview.preview.columns.map(c => (
                      <th key={c.key} className={TH}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border last:border-b-0">
                      {preview.preview.columns.map(c => (
                        <td key={c.key} className={`${TD} ${c.type === 'number' ? 'tabular-nums' : ''}`}>
                          {cellText(row[c.key] ?? null)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p role="status" className={`m-0 text-12 ${preview.state === 'error' ? 'text-negative' : 'text-text-muted'}`}>
            {statusText()}
          </p>
        </section>
      )}
    </div>
  );
}

/** Shared Components › Data Sources › Data Sources: the browser in its shared mode, with a heading. */
export function DataSourcesEditor({ series, onOpenPage }: { series: readonly SeriesName[]; onOpenPage?: (id: string) => void }) {
  return (
    <div className="grid gap-4">
      <header className="grid gap-1">
        <h2 className="m-0 font-serif text-22 font-medium text-text">Data Sources</h2>
        <p className="m-0 max-w-[72ch] text-12-5 text-text-muted">
          The sources a component may read (APEX: REST Data Sources; ours are the site’s own readers): each a name, its parameters, its columns, how it is kept fresh and where it is used. A component picks one in its Source group; the code reads it. New sources are code; remote servers and profiles of your own arrive with the first remote source.
        </p>
      </header>
      <SourceBrowser series={series} mode="shared" onOpenPage={onOpenPage} />
    </div>
  );
}
