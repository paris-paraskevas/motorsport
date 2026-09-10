'use client';

import { useSyncExternalStore } from 'react';
import { LEVEL_NAMES, type DebugEntry, type DebugReport, type OnLevel } from '@/lib/design/debug';
import { NO_ENTRIES, clientEntries, subscribe } from '@/lib/design/debug-client';

// The Debug panel (P1.9; APEX: View Debug opens the debug report, a bar graph
// of the steps above the messages, a hover shows a step's timing and a click
// jumps to it; the Debugging chapter, run 13). Ours is a drawer over the
// working tab rather than a report page, so the page stays in view. The server's
// trace comes from the admin route through the toolbar; the browser's own lines
// (the dynamic actions bound and fired) come from the client store and are
// appended live. Export writes the whole thing as JSON, which the two of us
// read or paste.

const BTN =
  'border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';

const rowId = (cid: string, i: number) => `pd-debug-${cid}-${i}`;

function Row({ id, e }: { id?: string; e: DebugEntry }) {
  return (
    <tr id={id} className="border-t border-border align-top">
      <td className="whitespace-nowrap px-3 py-1 font-mono text-10 tabular-nums text-text-faint">{e.at}</td>
      <td className="whitespace-nowrap px-2 py-1 font-mono text-10 text-text-muted">{e.phase}</td>
      <td className="px-2 py-1 text-12 text-text">{e.text}</td>
      <td className="whitespace-nowrap px-2 py-1 text-right font-mono text-10 tabular-nums text-text-muted">{e.ms !== undefined ? `${e.ms}` : ''}</td>
      <td className="px-2 py-1 font-mono text-10 text-text-muted">
        {e.src && e.src.length > 0 && <div>{e.src.join(' · ')}</div>}
        {e.run && <div className="whitespace-pre-line text-text-faint">{e.run}</div>}
      </td>
    </tr>
  );
}

export function DebugPanel({ report, loading, onRefresh, onClose }: { report: DebugReport | null; loading: boolean; onRefresh: () => void; onClose: () => void }) {
  const browser = useSyncExternalStore(subscribe, clientEntries, () => NO_ENTRIES);
  // The graph: the timed top-level steps, a region's own lines left to the table.
  const steps = report ? report.entries.map((e, i) => ({ e, i })).filter(({ e }) => e.ms !== undefined && !e.phase.includes(':')) : [];
  const longest = Math.max(1, ...steps.map(({ e }) => e.ms ?? 0));
  const exportJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify({ ...report, browser }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-${report.cid}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section
      role="dialog"
      aria-label="Debug"
      className="fixed bottom-16 left-1/2 z-40 flex max-h-[60vh] w-[min(1100px,calc(100vw-24px))] -translate-x-1/2 flex-col border border-text/40 bg-bg text-text shadow-2xl"
    >
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-3 py-2 font-mono text-10 uppercase tracking-[0.14em] text-text-muted">
        <span className="font-semibold text-text">Debug</span>
        {report && (
          <>
            <span>{report.page}</span>
            <span>id {report.cid}</span>
            <span>{LEVEL_NAMES[report.level as OnLevel] ?? 'Off'}</span>
            <span>{report.totalMs} ms</span>
          </>
        )}
        {loading && <span>tracing…</span>}
        <span className="flex-1" />
        <button type="button" className={BTN} onClick={onRefresh} disabled={loading}>
          Refresh
        </button>
        <button type="button" className={BTN} onClick={exportJson} disabled={!report}>
          Export
        </button>
        <button type="button" className={BTN} onClick={onClose} aria-label="Close Debug">
          Close
        </button>
      </header>
      {report && steps.length > 0 && (
        <div className="grid gap-1 border-b border-border px-3 py-2" aria-label="Step timing">
          {steps.map(({ e, i }) => (
            <button
              key={i}
              type="button"
              title={`${e.phase} ${e.ms} ms`}
              className="grid grid-cols-[88px_minmax(0,1fr)_64px] items-center gap-2 text-left"
              onClick={() => document.getElementById(rowId(report.cid, i))?.scrollIntoView({ block: 'center' })}
            >
              <span className="truncate font-mono text-10 text-text-muted">{e.phase}</span>
              <span className="h-2 bg-border">
                <span className="block h-2 bg-brand" style={{ width: `${Math.max(1, ((e.ms ?? 0) / longest) * 100)}%` }} />
              </span>
              <span className="text-right font-mono text-10 tabular-nums text-text-muted">{e.ms} ms</span>
            </button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left font-mono text-9 uppercase tracking-[0.14em] text-text-faint">
              <th className="px-3 py-1.5 font-medium">ms</th>
              <th className="px-2 py-1.5 font-medium">Phase</th>
              <th className="px-2 py-1.5 font-medium">Message</th>
              <th className="px-2 py-1.5 text-right font-medium">Took</th>
              <th className="px-2 py-1.5 font-medium">Source · loader run</th>
            </tr>
          </thead>
          <tbody>
            {report?.entries.map((e, i) => <Row key={i} id={rowId(report.cid, i)} e={e} />)}
            {browser.length > 0 && (
              <tr className="border-t border-border">
                <td colSpan={5} className="px-3 py-1.5 font-mono text-9 uppercase tracking-[0.14em] text-text-faint">
                  Browser · ms since the page began
                </td>
              </tr>
            )}
            {browser.map((e, i) => (
              <Row key={`b${i}`} e={e} />
            ))}
            {!report && !loading && (
              <tr>
                <td colSpan={5} className="px-3 py-3 text-12 text-text-faint">
                  No trace yet: enable Debug at a level, then View Debug.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
