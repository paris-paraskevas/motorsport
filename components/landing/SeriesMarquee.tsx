import type { SeriesMeta } from '@/lib/types';
import { groupSeriesByCategory } from '@/lib/categories';

// "15 series. One timetable." — three auto-scrolling rows of series chips
// (middle row reversed), the mockup's signature moving timetable. Chips are
// deliberately non-interactive: focusable links inside an infinite marquee
// make keyboard focus jump around; real series navigation lives in the
// disciplines grid and footer.
export function SeriesMarquee({ seriesList }: { seriesList: SeriesMeta[] }) {
  const categoryBySlug = new Map<string, string>();
  for (const group of groupSeriesByCategory(seriesList)) {
    for (const s of group.series) categoryBySlug.set(s.slug, group.category.label);
  }

  const rows: SeriesMeta[][] = [
    seriesList,
    [...seriesList.slice(5), ...seriesList.slice(0, 5)],
    [...seriesList.slice(10), ...seriesList.slice(0, 10)],
  ];
  const speeds = ['34s', '40s', '30s'];

  const chip = (s: SeriesMeta, k: string) => (
    <span
      key={k}
      className="flex shrink-0 items-center gap-3 rounded-[14px] border border-border bg-surface px-7 py-5"
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
      <span className="font-display text-lg font-extrabold uppercase tracking-wide text-text">
        {s.name}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
        / {categoryBySlug.get(s.slug) ?? 'Racing'}
      </span>
    </span>
  );

  return (
    <section id="series" className="overflow-hidden border-b border-border py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tight text-text sm:text-5xl">
          <span className="text-text-faint">{seriesList.length}</span> series.
          <br />
          One timetable.
        </h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-text-muted">
          Every official ICS feed in one place. Curated when upstream is thin.
          New series added as fans request them.
        </p>
      </div>

      <div className="mt-10 space-y-4" aria-hidden="true">
        {rows.map((row, i) => (
          <div key={i} className="motion-safe:overflow-hidden motion-reduce:overflow-x-auto">
            <div
              className={`flex w-max gap-4 ${i === 1 ? 'p2-marquee-rev' : 'p2-marquee'}`}
              style={{ '--p2-marquee-duration': speeds[i] } as React.CSSProperties}
            >
              <div className="flex shrink-0 gap-4 pr-4">{row.map(s => chip(s, `a-${s.slug}`))}</div>
              <div className="flex shrink-0 gap-4 pr-4">{row.map(s => chip(s, `b-${s.slug}`))}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Screen-reader equivalent of the decorative marquee. */}
      <ul className="sr-only">
        {seriesList.map(s => (
          <li key={s.slug}>{s.name}</li>
        ))}
      </ul>
    </section>
  );
}
