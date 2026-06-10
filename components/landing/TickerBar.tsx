import { formatRelative } from '@/lib/date';
import { cleanSessionTitle } from './clean-title';

export interface TickerEntry {
  seriesName: string;
  seriesColor: string;
  title: string;
  start: Date;
  dateOnly?: boolean;
}

// Broadcast-style data ticker pinned above the nav. Server-rendered from real
// upcoming sessions; the track is duplicated for a seamless CSS marquee loop
// (the copy is aria-hidden). Collapses to a static scrollable row under
// prefers-reduced-motion.
export function TickerBar({ entries, now }: { entries: TickerEntry[]; now: Date }) {
  if (entries.length === 0) return null;

  const items = entries.slice(0, 12);

  const track = (hidden: boolean) => (
    <div
      aria-hidden={hidden || undefined}
      className="flex shrink-0 items-center gap-8 pr-8"
    >
      {items.map(e => (
        <span
          key={`${hidden ? 'b' : 'a'}-${e.seriesName}-${e.title}-${e.start.getTime()}`}
          className="flex items-center gap-2 whitespace-nowrap"
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: e.seriesColor }}
            aria-hidden="true"
          />
          <span className="font-semibold text-text">{e.seriesName}</span>
          <span>{cleanSessionTitle(e.seriesName, e.title)}</span>
          <span className="text-text-faint">
            {e.dateOnly ? 'time TBC' : formatRelative(e.start, now)}
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="border-b border-border bg-bg font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
      <div className="motion-safe:overflow-hidden motion-reduce:overflow-x-auto">
        <div
          className="flex w-max motion-safe:p2-marquee py-2"
          style={{ '--p2-marquee-duration': `${items.length * 6}s` } as React.CSSProperties}
        >
          {track(false)}
          {track(true)}
        </div>
      </div>
    </div>
  );
}
