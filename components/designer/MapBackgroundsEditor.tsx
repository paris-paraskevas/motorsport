'use client';

import { useEffect, useState } from 'react';
import { MAP_BACKGROUNDS, type TileSet } from '@/lib/design/map-backgrounds';

// Map Backgrounds (the components programme, P2.12; APEX: Shared Components ›
// Map Backgrounds): the code's backgrounds in a table with their two tile sets
// (the hosts), their key (the variable's name and whether it is set, never its
// value), their zoom ceiling, Utilization (the pages whose newest or live
// revision carries a Map region drawing them, each opening in the App Builder)
// and History. The catalogue itself is code and travels with the page; the
// route adds only what needs the server. No delete: a shared object declared in
// code cannot be deleted while the code names it (rule 10 by construction).

const PBTN =
  'border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-35';
const TH = 'px-2.5 py-1.5 text-left font-mono text-9 font-normal uppercase tracking-[0.14em] text-text-faint';
const TD = 'px-2.5 py-1.5 align-top text-12';

interface UsedOn {
  id: string;
  path: string;
  name: string;
  refs: string[];
}
interface ListEntry {
  key: string;
  keySet: boolean | null;
  usedOn: UsedOn[];
}
type LoadedList = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; entries: Record<string, ListEntry> };

const host = (set: TileSet) => set.url.replace(/^https?:\/\//, '').split('/')[0];

async function fetchList(): Promise<LoadedList> {
  try {
    const res = await fetch('/api/admin/design/maps', { cache: 'no-store' });
    if (!res.ok) return { state: 'error', message: `The backgrounds could not be listed (HTTP ${res.status}).` };
    const d = (await res.json()) as { backgrounds: ListEntry[] };
    return { state: 'ready', entries: Object.fromEntries(d.backgrounds.map(e => [e.key, e])) };
  } catch {
    return { state: 'error', message: 'The backgrounds could not be listed: network error.' };
  }
}

export function MapBackgroundsEditor({ onOpenPage }: { onOpenPage: (id: string) => void }) {
  const [list, setList] = useState<LoadedList>({ state: 'loading' });
  useEffect(() => {
    let cancelled = false;
    void fetchList().then(loaded => {
      if (!cancelled) setList(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="m-0 font-serif text-22 font-medium text-text">Map Backgrounds</h2>
        <p className="m-0 mt-1 max-w-[70ch] text-13 text-text-muted">
          The named basemaps a Map region draws its tiles from, each a light and a dark set the theme picks between. Declared in the code and deployed with the site; a keyed provider’s key lives in the
          environment and is named here, never shown.
        </p>
      </div>
      {list.state === 'loading' ? (
        <p className="m-0 font-mono text-11 uppercase tracking-[0.16em] text-text-faint">Loading the backgrounds…</p>
      ) : list.state === 'error' ? (
        <p className="m-0 text-12 text-negative">{list.message}</p>
      ) : (
        <div className="overflow-x-auto border border-border-strong bg-surface">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={TH}>Name</th>
                <th className={TH}>Light tiles</th>
                <th className={TH}>Dark tiles</th>
                <th className={TH}>Key</th>
                <th className={TH}>Max zoom</th>
                <th className={TH}>Used on</th>
                <th className={TH}>History</th>
              </tr>
            </thead>
            <tbody>
              {MAP_BACKGROUNDS.map(b => {
                const e = list.entries[b.key];
                const usedOn = e?.usedOn ?? [];
                return (
                  <tr key={b.key} className="border-b border-border">
                    <td className={TD}>
                      <b className="font-semibold text-text">{b.name}</b>
                      <div className="font-mono text-10 text-text-faint">{b.key}</div>
                      <div className="mt-1 max-w-[40ch] text-11 text-text-muted">{b.holds}</div>
                    </td>
                    <td className={`${TD} font-mono text-11`}>{host(b.light)}</td>
                    <td className={`${TD} font-mono text-11`}>{b.dark ? host(b.dark) : 'the light set'}</td>
                    <td className={`${TD} font-mono text-11`}>{b.keyVar === null ? 'none' : `${b.keyVar} · ${e?.keySet ? 'set' : 'not set'}`}</td>
                    <td className={TD}>{b.light.maxZoom}</td>
                    <td className={TD}>
                      {usedOn.length === 0 ? (
                        'no page'
                      ) : (
                        <ul className="m-0 grid list-none gap-1 p-0">
                          {usedOn.map(p => (
                            <li key={p.id} className="flex flex-wrap items-baseline gap-2">
                              <button type="button" className={PBTN} onClick={() => onOpenPage(p.id)}>
                                {p.name}
                              </button>
                              <span className="font-mono text-10 text-text-faint">
                                {p.path} · {p.refs.join(', ')}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className={`${TD} font-mono text-10 text-text-faint`}>code, deployed with the site</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
