'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import type { DataBand } from '@/lib/design/data-services';
import type { RunsLog, SourceState } from '@/lib/design/data';
import { describeLoaderKey } from '@/lib/design/sources';
import { BTN, RuledTable, Strip, Swatch, ago, took, when, type StripCell } from './data-ui';

/** A loader key in the catalogue's words (P2.1), the raw key kept beside it; a key the vocabulary lacks stands as it is. */
function SourceName({ keyName, fallback }: { keyName: string; fallback?: string }) {
  const d = describeLoaderKey(keyName);
  const label = d?.label ?? fallback ?? keyName;
  return (
    <span className="font-medium">
      {label}
      {label !== keyName && <span className="ml-2 font-mono text-12 text-text-faint">{keyName}</span>}
    </span>
  );
}

// The loader's runs (Phase 4, PR 4.2): what the site's own data loader has been
// doing. A strip that answers "is it running and is anything failing", one row
// per source with its state, then the newest runs with two filters. Everything
// comes from /api/admin/design/data/runs, read-only, kept for a minute; Refresh
// reads again, "Show 1000" asks for more.

type Loaded = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; log: RunsLog };

const SOURCE_STATE: Record<SourceState, { word: string; band: DataBand }> = {
  fine: { word: 'fine', band: 'ok' },
  running: { word: 'running', band: 'own' },
  failed: { word: 'failed', band: 'bad' },
  stale: { word: 'stale', band: 'warn' },
  never: { word: 'never ran', band: 'off' },
};

const RESULT_BAND: Record<string, DataBand> = { ok: 'ok', failed: 'bad', running: 'own' };

async function fetchLog(limit: number, fresh: boolean): Promise<Loaded> {
  try {
    const res = await fetch(`/api/admin/design/data/runs?limit=${limit}${fresh ? '&fresh=1' : ''}`, { cache: 'no-store' });
    if (!res.ok) return { state: 'error', message: res.status === 503 ? 'The loader’s runs could not be read.' : `The runs could not be read (HTTP ${res.status}).` };
    return { state: 'ready', log: (await res.json()) as RunsLog };
  } catch {
    return { state: 'error', message: 'The runs could not be read: network error.' };
  }
}

export function DataRuns({ onBack }: { onBack: () => void }) {
  const [limit, setLimit] = useState(200);
  // The answer remembers which limit it was read for, so a new limit shows as
  // loading until its own answer arrives without a state write in the effect.
  const [answer, setAnswer] = useState<{ limit: number; loaded: Loaded } | null>(null);
  const [source, setSource] = useState('');
  const [result, setResult] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetchLog(limit, false).then(loaded => {
      if (!cancelled) setAnswer({ limit, loaded });
    });
    return () => {
      cancelled = true;
    };
  }, [limit]);

  const refresh = () => {
    setAnswer(null);
    void fetchLog(limit, true).then(loaded => setAnswer({ limit, loaded }));
  };

  const loaded: Loaded = answer && answer.limit === limit ? answer.loaded : { state: 'loading' };
  const log = loaded.state === 'ready' ? loaded.log : null;
  // Ages are measured from the read, never from the render.
  const now = log ? new Date(log.fetchedAt).getTime() : 0;

  const cells: StripCell[] = (() => {
    if (!log) return [];
    const n = (state: SourceState) => log.sources.filter(s => s.state === state).length;
    const fine = n('fine') + n('running');
    const trouble = n('failed') + n('stale') + n('never');
    const lastRun = log.runs[0]?.finished ?? log.runs[0]?.started ?? null;
    const lastAge = lastRun ? now - new Date(lastRun).getTime() : Infinity;
    return [
      { n: `${fine} / ${log.sources.length}`, label: 'sources fine', band: fine === 0 && log.sources.length > 0 ? 'bad' : trouble > 0 ? 'warn' : 'ok' },
      { n: String(log.last24h.failed), label: 'failed · 24 hours', band: log.last24h.failed > 0 ? 'bad' : 'ok' },
      { n: String(log.last24h.runs), label: 'loads · 24 hours', band: log.last24h.runs === 0 ? 'bad' : 'ok' },
      { n: lastRun ? when(lastRun).split(' · ')[0] : '—', label: lastRun ? `last run · ${ago(lastRun, now)}` : 'no run yet', band: lastAge > log.staleAfterMinutes * 60_000 ? 'warn' : 'ok' },
    ];
  })();

  const shown = (log?.runs ?? []).filter(r => (!source || r.source === source) && (!result || r.status === result));
  const sourcesSeen = [...new Set((log?.runs ?? []).map(r => r.source))].sort();

  return (
    <div>
      <button type="button" className={BTN} onClick={onBack}>
        <ArrowLeft size={15} /> Data
      </button>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h2 className="m-0 text-22 font-bold text-text">Loads · the loader’s runs</h2>
        <span className="flex-1" />
        <button type="button" className={BTN} disabled={loaded.state === 'loading'} onClick={refresh}>
          <RefreshCw size={15} className={loaded.state === 'loading' ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>
      <p className="m-0 mt-1 mb-5 max-w-[78ch] text-15 text-text-muted">
        The loader runs every {log?.periodMinutes ?? 20} minutes from GitHub Actions and writes each source under its own run. A source with no
        successful run for {log?.staleAfterMinutes ?? 65} minutes is stale. Runs older than 30 days are pruned.
      </p>

      {loaded.state === 'loading' && <p className="m-0 text-15 text-text-muted">Reading the runs…</p>}
      {loaded.state === 'error' && <p className="m-0 text-15" style={{ color: 'var(--bad)' }}>{loaded.message}</p>}

      {log && (
        <>
          <Strip cells={cells} label="The loader now" />

          <h3 className="m-0 mt-7 mb-2 text-16 font-semibold text-text">Sources · the newest run of each</h3>
          <RuledTable
            cols={['Source', 'State', 'Rows', 'Finished', 'Runner', 'Error']}
            numeric={[2]}
            rows={log.sources.map(s => {
              const st = SOURCE_STATE[s.state];
              const at = s.newest?.finished ?? s.newest?.started ?? null;
              return [
                <SourceName key="s" keyName={s.key} fallback={s.label} />,
                <span key="st" style={{ color: `var(--${st.band})` }}>
                  <Swatch band={st.band} />
                  {st.word}
                  {s.state === 'stale' && s.lastOk && <span className="ml-2 text-13 text-text-muted">last ok {ago(s.lastOk, now)}</span>}
                </span>,
                s.newest ? s.newest.rows.toLocaleString('en-GB') : '—',
                <span key="w" title={at ?? undefined}>
                  {when(at)}
                  {at && <span className="ml-2 text-13 text-text-muted">{ago(at, now)}</span>}
                </span>,
                <span key="r" className="font-mono text-13 text-text-muted">
                  {s.newest?.runner ?? '—'}
                </span>,
                <span key="e" className="block max-w-[36ch] truncate text-14" title={s.newest?.error ?? undefined} style={s.newest?.error ? { color: 'var(--bad)' } : undefined}>
                  {s.newest?.error ?? ''}
                </span>,
              ];
            })}
            empty="No source has registered yet: the loader has not run against this database."
          />

          <div className="mt-7 mb-2 flex flex-wrap items-center gap-3">
            <h3 className="m-0 flex-1 text-16 font-semibold text-text">
              Runs · the newest {log.runs.length.toLocaleString('en-GB')}
              {shown.length !== log.runs.length && <span className="ml-2 font-normal text-text-faint">· {shown.length.toLocaleString('en-GB')} shown</span>}
            </h3>
            <label className="flex items-center gap-2 text-14 text-text-muted">
              Source
              <select value={source} onChange={e => setSource(e.target.value)} className="h-[34px] border border-border-strong bg-surface-elevated px-2 text-14 text-text">
                <option value="">all</option>
                {sourcesSeen.map(k => (
                  <option key={k} value={k}>
                    {describeLoaderKey(k)?.label ?? k}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-14 text-text-muted">
              Result
              <select value={result} onChange={e => setResult(e.target.value)} className="h-[34px] border border-border-strong bg-surface-elevated px-2 text-14 text-text">
                <option value="">all</option>
                <option value="ok">ok</option>
                <option value="failed">failed</option>
                <option value="running">running</option>
              </select>
            </label>
            {limit < 1000 && (
              <button type="button" className={BTN} onClick={() => setLimit(1000)}>
                Show 1000
              </button>
            )}
          </div>
          <RuledTable
            cols={['Started', 'Source', 'Result', 'Rows', 'Took', 'Runner', 'Error']}
            numeric={[3, 4]}
            rows={shown.map(r => [
              <span key="w" title={r.started ?? undefined}>{when(r.started)}</span>,
              <SourceName key="s" keyName={r.source} />,
              <span key="st" style={{ color: `var(--${RESULT_BAND[r.status] ?? 'off'})` }}>
                <Swatch band={RESULT_BAND[r.status] ?? 'off'} />
                {r.status}
              </span>,
              r.rows.toLocaleString('en-GB'),
              took(r.started, r.finished),
              <span key="r" className="font-mono text-13 text-text-muted">
                {r.runner ?? '—'}
              </span>,
              <span key="e" className="block max-w-[40ch] truncate text-14" title={r.error ?? undefined} style={r.error ? { color: 'var(--bad)' } : undefined}>
                {r.error ?? ''}
              </span>,
            ])}
            empty={log.runs.length ? 'No run matches the two filters.' : 'No run recorded yet.'}
          />
          <p className="m-0 mt-3 text-13 text-text-faint">Read {log.fetchedAt.replace('T', ' ').slice(0, 19)}Z · kept for a minute · Refresh reads again</p>
        </>
      )}
    </div>
  );
}
