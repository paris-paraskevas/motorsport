import { CountUp } from './CountUp';

export interface LandingStats {
  series: number;
  sessions: number;
  races: number;
  drivers: number;
}

// The acid band — diagonal hatch, display numerals counting up on scroll.
// Every number is computed from the real data layer at render time.
export function StatsBand({ stats }: { stats: LandingStats }) {
  const items = [
    { value: stats.series, label: 'series', sub: 'tracked live' },
    { value: stats.races, label: 'race weekends', sub: 'in 2026' },
    { value: stats.sessions, label: 'sessions', sub: 'practice to flag' },
    { value: stats.drivers, label: 'drivers', sub: 'across grids', suffix: '+' },
  ];

  return (
    <section aria-label="Coverage in numbers" className="bg-acid text-black">
      <div className="p2-hatch">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-y-10 px-4 py-14 sm:px-6 lg:grid-cols-4">
          {items.map(item => (
            <div key={item.label} className="border-l-2 border-black/80 pl-4">
              <div className="font-display text-5xl font-extrabold tracking-tight sm:text-6xl">
                <CountUp value={item.value} suffix={item.suffix ?? ''} />
              </div>
              <div className="mt-2 text-sm font-bold uppercase tracking-[0.12em]">
                {item.label}
              </div>
              <div className="text-xs text-black/60">{item.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
