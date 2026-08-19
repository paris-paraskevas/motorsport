'use client';
import { useState, type ReactNode } from 'react';

// Panel 12c: class is the primary filter, not a column. Chips switch which
// class block is visible; Overall shows every block. The blocks arrive
// server-rendered as children (one per class, same order as `labels`) and are
// hidden with CSS rather than unmounted, so the full field stays in the HTML
// for crawlers and switching never refetches.
export function SessionClassChips({
  labels,
  children,
}: {
  labels: string[];
  children: ReactNode[];
}) {
  const [active, setActive] = useState(-1); // -1 = Overall
  const chip = (label: string, idx: number) => {
    const current = active === idx;
    return (
      <button
        key={`${label}-${idx}`}
        type="button"
        onClick={() => setActive(idx)}
        aria-pressed={current}
        data-heatmap-id={`session:class:${label.toLowerCase().replace(/\s+/g, '-')}`}
        className={`inline-flex min-h-[38px] items-center border px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors duration-(--duration-fast) ${
          current
            ? 'border-text bg-surface-elevated text-text'
            : 'border-border-strong text-text-muted hover:text-text'
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {chip('Overall', -1)}
        {labels.map((l, i) => chip(l, i))}
        <span className="ml-1 font-mono text-[9px] uppercase tracking-[0.14em] text-text-faint">
          Class is the primary filter, not a column
        </span>
      </div>
      <div>
        {children.map((block, i) => (
          <div key={labels[i] ?? i} style={active === -1 || active === i ? undefined : { display: 'none' }}>
            {block}
          </div>
        ))}
      </div>
    </div>
  );
}
