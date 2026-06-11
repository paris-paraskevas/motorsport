import type {
  Series,
  DriverStanding,
  ConstructorStanding,
  StandingsOverridesFile,
} from '@/lib/types';
import { fetchF1Standings } from '@/lib/standings/f1';
import { loadStandingsOverrides } from '@/lib/series-content';

const DRIVER_ROWS = 10;
const CONSTRUCTOR_ROWS = 5;

function applyDriverOverrides(
  drivers: DriverStanding[],
  overrides: StandingsOverridesFile['drivers'],
): DriverStanding[] {
  if (!overrides || overrides.length === 0) return drivers;
  return drivers
    .map(d => {
      const o = overrides.find(x => x.driverName === d.driverName);
      return o ? { ...d, position: o.position ?? d.position, points: o.points ?? d.points, wins: o.wins ?? d.wins } : d;
    })
    .sort((a, b) => a.position - b.position);
}

function applyConstructorOverrides(
  constructors: ConstructorStanding[],
  overrides: StandingsOverridesFile['constructors'],
): ConstructorStanding[] {
  if (!overrides || overrides.length === 0) return constructors;
  return constructors
    .map(c => {
      const o = overrides.find(x => x.name === c.name);
      return o ? { ...c, position: o.position ?? c.position, points: o.points ?? c.points, wins: o.wins ?? c.wins } : c;
    })
    .sort((a, b) => a.position - b.position);
}

function officialSiteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'official site';
  }
}

export async function WeekendStandingsSnapshot({
  series,
  round,
  isPast,
}: {
  series: Series;
  round: number;
  isPast: boolean;
}) {
  const label = isPast ? `As of round ${round}` : `Going into round ${round}`;

  if (series.meta.slug === 'f1') {
    const [data, overrides] = await Promise.all([
      fetchF1Standings(),
      loadStandingsOverrides(series.meta.slug),
    ]);
    if (!data) return null;
    const drivers = applyDriverOverrides(data.drivers, overrides?.drivers).slice(0, DRIVER_ROWS);
    const constructors = applyConstructorOverrides(data.constructors, overrides?.constructors).slice(0, CONSTRUCTOR_ROWS);

    return (
      <section className="mb-8 border-y border-border py-4">
        <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text">
            Standings
          </h2>
          <span className="text-[10px] uppercase tracking-[0.14em] text-text-faint font-semibold font-mono">
            {label}
          </span>
        </div>

        <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted font-semibold mb-2">
              Drivers · top {DRIVER_ROWS}
            </div>
            <ul className="divide-y divide-border/60">
              {drivers.map(d => (
                <li key={`${d.position}-${d.driverName}`} className="flex items-baseline gap-3 py-1.5">
                  <span className="w-5 text-text-faint text-xs font-mono tabular-nums text-right">
                    {d.position}
                  </span>
                  <span className="flex-1 min-w-0 text-text text-sm font-medium truncate">
                    {d.driverName}
                  </span>
                  <span className="text-text-muted text-xs truncate max-w-[8rem]">{d.team}</span>
                  <span className="text-text text-sm font-mono tabular-nums text-right w-10">
                    {d.points}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted font-semibold mb-2">
              Constructors · top {CONSTRUCTOR_ROWS}
            </div>
            <ul className="divide-y divide-border/60">
              {constructors.map(c => (
                <li key={`${c.position}-${c.name}`} className="flex items-baseline gap-3 py-1.5">
                  <span className="w-5 text-text-faint text-xs font-mono tabular-nums text-right">
                    {c.position}
                  </span>
                  <span className="flex-1 min-w-0 text-text text-sm font-medium truncate">
                    {c.name}
                  </span>
                  <span className="text-text text-sm font-mono tabular-nums text-right w-10">
                    {c.points}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    );
  }

  if (!series.meta.officialStandingsUrl) return null;
  const host = officialSiteLabel(series.meta.officialStandingsUrl);
  return (
    <section className="mb-8 border-y border-border py-4">
      <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text">
          Standings
        </h2>
        <span className="text-[10px] uppercase tracking-[0.14em] text-text-faint font-semibold font-mono">{label}</span>
      </div>
      <a
        href={series.meta.officialStandingsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block border border-border bg-surface/40 p-5 text-center text-text-muted text-sm hover:bg-surface hover:border-border-strong transition-colors duration-(--duration-fast)"
      >
        Live standings on {host} <span aria-hidden>→</span>
      </a>
    </section>
  );
}
