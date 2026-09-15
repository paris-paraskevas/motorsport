'use client';

import { useEffect, useState } from 'react';

// The Page Performance Timing dialog (P1.7; APEX: Info › Show Page Timing on
// the Developer Toolbar: "Page Performance Timing dialog … Copy button copies
// timing data as a table; Clear removes the current timing events"). Ours reads
// the browser's own navigation and resource timings for the running page; the
// server's steps are the Debug panel's (P1.9). Loaded on demand by the toolbar.
// Every browser API is guarded and comes in as a prop: jsdom has none of them.

export interface TimingRow {
  label: string;
  /** Milliseconds, one decimal; null where the browser has no figure yet. */
  ms: number | null;
  detail?: string;
}

export interface Timings {
  navigation: TimingRow[];
  /** The slowest resources first. */
  resources: TimingRow[];
  /** How many resources the browser timed in all. */
  total: number;
}

const SLOWEST = 8;
const round = (n: number) => Math.round(n * 10) / 10;

/** The browser's timings, empty where the API is missing; never throws. */
export function readTimings(): Timings {
  const perf = typeof performance !== 'undefined' ? performance : undefined;
  if (!perf || typeof perf.getEntriesByType !== 'function') return { navigation: [], resources: [], total: 0 };
  const nav = perf.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const navigation: TimingRow[] = nav
    ? [
        { label: 'Redirect', ms: round(nav.redirectEnd - nav.redirectStart) },
        { label: 'DNS', ms: round(nav.domainLookupEnd - nav.domainLookupStart) },
        { label: 'Connect', ms: round(nav.connectEnd - nav.connectStart) },
        { label: 'Request to first byte', ms: round(nav.responseStart - nav.requestStart) },
        { label: 'Response', ms: round(nav.responseEnd - nav.responseStart) },
        { label: 'DOM interactive', ms: round(nav.domInteractive) },
        { label: 'DOM content loaded', ms: round(nav.domContentLoadedEventEnd) },
        { label: 'Load', ms: nav.loadEventEnd > 0 ? round(nav.loadEventEnd) : null },
      ]
    : [];
  const all = perf.getEntriesByType('resource') as PerformanceResourceTiming[];
  const resources = [...all]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, SLOWEST)
    .map(r => {
      let label = r.name;
      try {
        const u = new URL(r.name);
        label = u.origin === window.location.origin ? u.pathname : `${u.host}${u.pathname}`;
      } catch {
        /* a name that is not an address stays as it is */
      }
      const kb = r.transferSize ? ` · ${Math.round(r.transferSize / 1024)} KB` : '';
      return { label, ms: round(r.duration), detail: `${r.initiatorType}${kb}` };
    });
  return { navigation, resources, total: all.length };
}

/** The dialog's rows as a tab-separated table, what Copy puts on the clipboard. */
export function timingTable(t: Timings): string {
  return [
    'Step\tms',
    ...t.navigation.map(r => `${r.label}\t${r.ms ?? ''}`),
    '',
    'Resource\tms\tkind',
    ...t.resources.map(r => `${r.label}\t${r.ms ?? ''}\t${r.detail ?? ''}`),
  ].join('\n');
}

const defaultCopy = (text: string) => {
  if (typeof navigator !== 'undefined' && navigator.clipboard) void navigator.clipboard.writeText(text).catch(() => {});
};
const defaultClear = () => {
  if (typeof performance !== 'undefined' && typeof performance.clearResourceTimings === 'function') performance.clearResourceTimings();
};

const BTN =
  'border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';
const CELL = 'px-3 py-1 text-12 text-text';
const MS = 'whitespace-nowrap px-3 py-1 text-right font-mono text-10 tabular-nums text-text-muted';

export function PageTiming({
  onClose,
  timings = readTimings,
  copy = defaultCopy,
  clear = defaultClear,
}: {
  onClose: () => void;
  /** Where the rows come from; the browser's timings unless a test hands its own. */
  timings?: () => Timings;
  copy?: (text: string) => void;
  clear?: () => void;
}) {
  // Read once when the dialog opens; Clear reads again, the browser's resource list empty by then.
  const [t, setT] = useState<Timings>(timings);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <section
      role="dialog"
      aria-label="Page Performance Timing"
      className="fixed bottom-16 left-1/2 z-40 flex max-h-[60vh] w-[min(760px,calc(100vw-24px))] -translate-x-1/2 flex-col border border-text/40 bg-bg text-text shadow-2xl"
    >
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-3 py-2 font-mono text-10 uppercase tracking-[0.14em] text-text-muted">
        <span className="font-semibold text-text">Page Performance Timing</span>
        <span>{t.total} resources, the slowest first</span>
        <span className="flex-1" />
        <button type="button" className={BTN} onClick={() => copy(timingTable(t))}>
          Copy
        </button>
        <button
          type="button"
          className={BTN}
          onClick={() => {
            clear();
            setT(timings());
          }}
        >
          Clear
        </button>
        <button type="button" className={BTN} onClick={onClose} aria-label="Close Page Timing">
          Close
        </button>
      </header>
      <div className="grid min-h-0 gap-0 overflow-auto md:grid-cols-2">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left font-mono text-9 uppercase tracking-[0.12em] text-text-faint">
              <th className="px-3 py-1 font-medium">Step</th>
              <th className="px-3 py-1 text-right font-medium">ms</th>
            </tr>
          </thead>
          <tbody>
            {t.navigation.length === 0 && (
              <tr>
                <td className={CELL} colSpan={2}>
                  The browser gave no navigation timing for this page.
                </td>
              </tr>
            )}
            {t.navigation.map(r => (
              <tr key={r.label} className="border-t border-border">
                <td className={CELL}>{r.label}</td>
                <td className={MS}>{r.ms === null ? '' : String(r.ms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="w-full border-collapse md:border-l md:border-border">
          <thead>
            <tr className="text-left font-mono text-9 uppercase tracking-[0.12em] text-text-faint">
              <th className="px-3 py-1 font-medium">Resource</th>
              <th className="px-3 py-1 text-right font-medium">ms</th>
              <th className="px-3 py-1 font-medium">kind</th>
            </tr>
          </thead>
          <tbody>
            {t.resources.map(r => (
              <tr key={`${r.label}-${r.ms}`} className="border-t border-border align-top">
                <td className={`${CELL} break-all`}>{r.label}</td>
                <td className={MS}>{r.ms === null ? '' : String(r.ms)}</td>
                <td className="whitespace-nowrap px-3 py-1 font-mono text-10 text-text-muted">{r.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
