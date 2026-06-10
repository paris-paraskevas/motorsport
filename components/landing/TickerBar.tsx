// Broadcast chyron pinned to the top of the landing. Server-rendered from
// real data; the page composes typed segments (stats / next-up / GMT-timed
// events / weather / news). The track is duplicated for a seamless CSS
// marquee loop (copy aria-hidden); static scrollable row under
// prefers-reduced-motion. Sticky so it reads like a live broadcast bar.
export interface TickerSegment {
  /** series dot color, omitted for neutral entries */
  dot?: string;
  /** leading emphasised token, e.g. "NEXT UP" or "WED 15:00 GMT" */
  head?: string;
  body: string;
  /** trailing de-emphasised token, e.g. venue or relative time */
  tail?: string;
}

export function TickerBar({ segments }: { segments: TickerSegment[] }) {
  if (segments.length === 0) return null;

  const items = segments.slice(0, 16);

  const track = (hidden: boolean) => (
    <div aria-hidden={hidden || undefined} className="flex shrink-0 items-center pr-10">
      {items.map((s, i) => (
        <span
          key={`${hidden ? 'b' : 'a'}-${i}`}
          className="flex items-center gap-2 whitespace-nowrap pr-10"
        >
          {s.dot && (
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: s.dot }}
              aria-hidden="true"
            />
          )}
          {s.head && <span className="font-semibold text-text">{s.head}</span>}
          <span>{s.body}</span>
          {s.tail && <span className="text-text-faint">{s.tail}</span>}
          <span className="pl-10 text-text-faint" aria-hidden="true">
            ·
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="sticky top-0 z-50 h-9 border-b border-border bg-bg/95 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted backdrop-blur-sm">
      <div className="h-full motion-safe:overflow-hidden motion-reduce:overflow-x-auto">
        <div
          className="flex h-9 w-max items-center p2-marquee"
          style={{ '--p2-marquee-duration': `${items.length * 7}s` } as React.CSSProperties}
        >
          {track(false)}
          {track(true)}
        </div>
      </div>
    </div>
  );
}
