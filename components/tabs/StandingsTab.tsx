import type { Series, DriverStanding, ConstructorStanding } from '@/lib/types';
import { fetchF1Standings } from '@/lib/standings/f1';
import { PlaceholderTab } from '@/components/tabs/PlaceholderTab';

const SOURCE_URL = 'https://github.com/jolpica/jolpica-f1';

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
    <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-6 text-center">
      <div className="text-zinc-400 text-sm">{message}</div>
    </div>
  );
}

function DriversTable({ drivers }: { drivers: DriverStanding[] }) {
  return (
    <section className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-4">
      <h2 className="text-zinc-200 text-sm uppercase tracking-[0.14em] font-semibold mb-3">
        Drivers
      </h2>
      <ul className="divide-y divide-zinc-800/60">
        {drivers.map(d => (
          <li
            key={`${d.position}-${d.driverName}`}
            className="flex items-baseline gap-3 py-2"
          >
            <span className="w-6 text-zinc-500 text-sm font-mono tabular-nums text-right">
              {d.position}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-zinc-100 text-sm font-medium truncate">
                  {d.driverName}
                </span>
                {d.driverCode ? (
                  <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                    {d.driverCode}
                  </span>
                ) : null}
              </div>
              <div className="text-zinc-400 text-xs truncate">{d.team}</div>
            </div>
            <span className="text-zinc-100 text-sm font-mono tabular-nums text-right w-14">
              {d.points}
            </span>
            <span className="text-zinc-500 text-[11px] font-mono tabular-nums text-right w-8">
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
    <section className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-4">
      <h2 className="text-zinc-200 text-sm uppercase tracking-[0.14em] font-semibold mb-3">
        Constructors
      </h2>
      <ul className="divide-y divide-zinc-800/60">
        {constructors.map(c => (
          <li key={`${c.position}-${c.name}`} className="flex items-baseline gap-3 py-2">
            <span className="w-6 text-zinc-500 text-sm font-mono tabular-nums text-right">
              {c.position}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-zinc-100 text-sm font-medium truncate">{c.name}</span>
            </div>
            <span className="text-zinc-100 text-sm font-mono tabular-nums text-right w-14">
              {c.points}
            </span>
            <span className="text-zinc-500 text-[11px] font-mono tabular-nums text-right w-8">
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
    <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-6 text-center">
      <p className="text-zinc-300 text-sm mb-4">
        Live standings are available on the official site.
      </p>
      <a
        href={officialStandingsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-medium transition-colors"
      >
        {label} standings <span aria-hidden>→</span>
      </a>
    </div>
  );
}

export async function StandingsTab({ series }: { series: Series }) {
  if (series.meta.slug === 'f1') {
    const data = await fetchF1Standings();
    if (!data) {
      return (
        <EmptyState message="Standings are temporarily unavailable. Check back shortly." />
      );
    }
    return (
      <div className="space-y-4">
        <DriversTable drivers={data.drivers} />
        <ConstructorsTable constructors={data.constructors} />
        <div className="text-center">
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-zinc-400 text-xs transition-colors"
          >
            Source: jolpi.ca (Ergast mirror) →
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
