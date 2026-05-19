import type {
  Series,
  DriverStanding,
  ConstructorStanding,
  StandingsOverridesFile,
} from '@/lib/types';
import { fetchF1Standings } from '@/lib/standings/f1';
import { fetchIndyCarStandings } from '@/lib/standings/indycar';
import { loadStandingsOverrides } from '@/lib/series-content';
import { PlaceholderTab } from '@/components/tabs/PlaceholderTab';

const SOURCE_URL = 'https://github.com/jolpica/jolpica-f1';

function applyDriverOverrides(
  drivers: DriverStanding[],
  overrides: StandingsOverridesFile['drivers'],
): DriverStanding[] {
  if (!overrides || overrides.length === 0) return drivers;
  const patched = drivers.map(d => {
    const o = overrides.find(x => x.driverName === d.driverName);
    if (!o) return d;
    return {
      ...d,
      position: o.position ?? d.position,
      points: o.points ?? d.points,
      wins: o.wins ?? d.wins,
    };
  });
  return patched.sort((a, b) => a.position - b.position);
}

function applyConstructorOverrides(
  constructors: ConstructorStanding[],
  overrides: StandingsOverridesFile['constructors'],
): ConstructorStanding[] {
  if (!overrides || overrides.length === 0) return constructors;
  const patched = constructors.map(c => {
    const o = overrides.find(x => x.name === c.name);
    if (!o) return c;
    return {
      ...c,
      position: o.position ?? c.position,
      points: o.points ?? c.points,
      wins: o.wins ?? c.wins,
    };
  });
  return patched.sort((a, b) => a.position - b.position);
}

function officialSiteLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host;
  } catch {
    return 'official site';
  }
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-surface/40 border border-border/60 p-6 text-center">
      <div className="text-text-muted text-sm">{message}</div>
    </div>
  );
}

function DriversTable({ drivers }: { drivers: DriverStanding[] }) {
  return (
    <section className="rounded-xl bg-surface/40 border border-border/60 p-4">
      <h2 className="text-text-muted text-sm uppercase tracking-[0.14em] font-semibold mb-3">
        Drivers
      </h2>
      <ul className="divide-y divide-border/60">
        {drivers.map(d => (
          <li
            key={`${d.position}-${d.driverName}`}
            className="flex items-baseline gap-3 py-2"
          >
            <span className="w-6 text-text-faint text-sm font-mono tabular-nums text-right">
              {d.position}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-text text-sm font-medium truncate">
                  {d.driverName}
                </span>
                {d.driverCode ? (
                  <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-text-faint bg-border/60 px-1.5 py-0.5 rounded font-mono">
                    {d.driverCode}
                  </span>
                ) : null}
              </div>
              <div className="text-text-muted text-xs truncate">{d.team}</div>
            </div>
            <span className="text-text text-sm font-mono tabular-nums text-right w-14">
              {d.points}
            </span>
            <span className="text-text-faint text-[11px] font-mono tabular-nums text-right w-8">
              {d.wins != null ? `${d.wins}W` : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ConstructorsTable({ constructors }: { constructors: ConstructorStanding[] }) {
  return (
    <section className="rounded-xl bg-surface/40 border border-border/60 p-4">
      <h2 className="text-text-muted text-sm uppercase tracking-[0.14em] font-semibold mb-3">
        Constructors
      </h2>
      <ul className="divide-y divide-border/60">
        {constructors.map(c => (
          <li key={`${c.position}-${c.name}`} className="flex items-baseline gap-3 py-2">
            <span className="w-6 text-text-faint text-sm font-mono tabular-nums text-right">
              {c.position}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-text text-sm font-medium truncate">{c.name}</span>
            </div>
            <span className="text-text text-sm font-mono tabular-nums text-right w-14">
              {c.points}
            </span>
            <span className="text-text-faint text-[11px] font-mono tabular-nums text-right w-8">
              {c.wins != null ? `${c.wins}W` : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LinkOutCard({
  officialStandingsUrl,
  officialSite,
}: {
  officialStandingsUrl: string;
  officialSite?: string;
}) {
  const label = officialSite
    ? officialSiteLabel(officialSite)
    : officialSiteLabel(officialStandingsUrl);
  return (
    <div className="rounded-xl bg-surface/40 border border-border/60 p-6 text-center">
      <p className="text-text-muted text-sm mb-4">
        Live standings are available on the official site.
      </p>
      <a
        href={officialStandingsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-border hover:bg-border-strong text-text text-sm font-medium transition-colors duration-(--duration-fast)"
      >
        {label} standings <span aria-hidden>→</span>
      </a>
    </div>
  );
}

export async function StandingsTab({ series }: { series: Series }) {
  if (series.meta.slug === 'f1') {
    const [data, overrides] = await Promise.all([
      fetchF1Standings(),
      loadStandingsOverrides(series.meta.slug),
    ]);
    if (!data) {
      return (
        <EmptyState message="Standings are temporarily unavailable. Check back shortly." />
      );
    }
    const drivers = applyDriverOverrides(data.drivers, overrides?.drivers);
    const constructors = applyConstructorOverrides(
      data.constructors,
      overrides?.constructors,
    );
    return (
      <div className="space-y-4">
        <DriversTable drivers={drivers} />
        <ConstructorsTable constructors={constructors} />
        <div className="text-center">
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-faint hover:text-text-muted text-xs transition-colors duration-(--duration-fast)"
          >
            Source: jolpi.ca (Ergast mirror) →
          </a>
        </div>
      </div>
    );
  }

  if (series.meta.slug === 'indycar') {
    const [data, overrides] = await Promise.all([
      fetchIndyCarStandings(),
      loadStandingsOverrides(series.meta.slug),
    ]);
    if (!data) {
      return (
        <EmptyState message="Standings are temporarily unavailable. Check back shortly." />
      );
    }
    const drivers = applyDriverOverrides(data.drivers, overrides?.drivers);
    return (
      <div className="space-y-4">
        <DriversTable drivers={drivers} />
        <div className="text-center">
          <a
            href="https://www.indycar.com/Standings"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-faint hover:text-text-muted text-xs transition-colors duration-(--duration-fast)"
          >
            Source: indycar.com →
          </a>
        </div>
      </div>
    );
  }

  if (!series.meta.officialStandingsUrl) {
    return <PlaceholderTab tabLabel="Standings" />;
  }

  return (
    <LinkOutCard
      officialStandingsUrl={series.meta.officialStandingsUrl}
      officialSite={series.meta.officialSite}
    />
  );
}
