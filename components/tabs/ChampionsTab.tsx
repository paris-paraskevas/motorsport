import Link from 'next/link';
import type { Champion, Series } from '@/lib/types';
import { fetchChampions } from '@/lib/wikipedia-champions';
import { loadCuratedChampions, loadCuratedDrivers } from '@/lib/series-content';
import { slugify } from '@/lib/slug';
import { PlaceholderTab } from './PlaceholderTab';

function wikipediaUrl(pageTitle: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`;
}

interface DecadeGroup<T extends { year: number }> {
  decade: number;
  label: string;
  rows: T[];
}

function groupByDecade<T extends { year: number }>(items: T[]): DecadeGroup<T>[] {
  const buckets = new Map<number, T[]>();
  for (const c of items) {
    const decade = Math.floor(c.year / 10) * 10;
    if (!buckets.has(decade)) buckets.set(decade, []);
    buckets.get(decade)!.push(c);
  }
  const groups = [...buckets.entries()].map(([decade, list]) => ({
    decade,
    label: `${decade}s`,
    rows: list.sort((a, b) => b.year - a.year),
  }));
  groups.sort((a, b) => b.decade - a.decade);
  return groups;
}

interface ConstructorChampion {
  year: number;
  team: string;
}

interface SecondaryChampion {
  year: number;
  driver: string;
  team?: string;
}

const LINK_CLASS =
  'hover:text-text underline-offset-4 hover:underline transition-colors duration-(--duration-fast)';

function DriverCell({
  name,
  driverSlugs,
}: {
  name: string;
  driverSlugs: Set<string>;
}) {
  const slug = slugify(name);
  if (driverSlugs.has(slug)) {
    return (
      <Link href={`/drivers/${slug}`} className={LINK_CLASS}>
        {name}
      </Link>
    );
  }
  return <>{name}</>;
}

function TeamCell({
  name,
  teamSlugs,
}: {
  name: string;
  teamSlugs: Set<string>;
}) {
  const slug = slugify(name);
  if (teamSlugs.has(slug)) {
    return (
      <Link href={`/teams/${slug}`} className={LINK_CLASS}>
        {name}
      </Link>
    );
  }
  return <>{name}</>;
}

function DriversSection({
  champions,
  driverSlugs,
  teamSlugs,
}: {
  champions: Champion[];
  driverSlugs: Set<string>;
  teamSlugs: Set<string>;
}) {
  const groups = groupByDecade(champions);
  return (
    <div className="space-y-3">
      {groups.map((group, idx) => (
        <details
          key={group.decade}
          open={idx === 0}
          className="group rounded-xl bg-surface/40 border border-border/60 overflow-hidden"
        >
          <summary className="flex items-baseline justify-between px-4 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:bg-surface transition-colors duration-(--duration-fast)">
            <span className="text-text text-base font-semibold tracking-tight">
              {group.label}
            </span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-text-faint font-semibold font-mono">
              {group.rows.length}{' '}
              {group.rows.length === 1 ? 'champion' : 'champions'}
            </span>
          </summary>
          <div className="divide-y divide-border/40 border-t border-border/60">
            {group.rows.map((c, i) => (
              <div key={`${c.year}-${i}`} className="px-4 py-2.5">
                <div className="hidden sm:grid grid-cols-[3.5rem_1fr_minmax(0,1fr)] gap-x-3 items-baseline">
                  <div className="text-text-muted tabular-nums text-sm font-medium tnum font-mono">
                    {c.year}
                  </div>
                  <div className="text-text text-sm leading-snug">
                    <DriverCell name={c.driver} driverSlugs={driverSlugs} />
                  </div>
                  <div className="text-xs text-text-muted leading-snug">
                    {c.constructor ? (
                      <TeamCell name={c.constructor} teamSlugs={teamSlugs} />
                    ) : (
                      ''
                    )}
                  </div>
                </div>
                <div className="sm:hidden">
                  <div className="flex items-baseline gap-3">
                    <span className="text-text-muted tabular-nums text-sm font-medium tnum font-mono w-12 shrink-0">
                      {c.year}
                    </span>
                    <span className="text-text text-sm">
                      <DriverCell name={c.driver} driverSlugs={driverSlugs} />
                    </span>
                  </div>
                  {c.constructor && (
                    <div className="ml-[3.75rem] mt-0.5 text-[11px] text-text-faint">
                      <TeamCell name={c.constructor} teamSlugs={teamSlugs} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

function ConstructorsSection({
  champions,
  teamSlugs,
}: {
  champions: ConstructorChampion[];
  teamSlugs: Set<string>;
}) {
  const groups = groupByDecade(champions);
  return (
    <div className="space-y-3">
      {groups.map((group, idx) => (
        <details
          key={group.decade}
          open={idx === 0}
          className="group rounded-xl bg-surface/40 border border-border/60 overflow-hidden"
        >
          <summary className="flex items-baseline justify-between px-4 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:bg-surface transition-colors duration-(--duration-fast)">
            <span className="text-text text-base font-semibold tracking-tight">
              {group.label}
            </span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-text-faint font-semibold font-mono">
              {group.rows.length}{' '}
              {group.rows.length === 1 ? 'champion' : 'champions'}
            </span>
          </summary>
          <div className="divide-y divide-border/40 border-t border-border/60">
            {group.rows.map((c, i) => (
              <div key={`${c.year}-${i}`} className="px-4 py-2.5">
                <div className="flex items-baseline gap-3">
                  <span className="text-text-muted tabular-nums text-sm font-medium tnum font-mono w-12 shrink-0">
                    {c.year}
                  </span>
                  <span className="text-text text-sm leading-snug">
                    <TeamCell name={c.team} teamSlugs={teamSlugs} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

function SecondarySection({
  champions,
  driverSlugs,
  teamSlugs,
}: {
  champions: SecondaryChampion[];
  driverSlugs: Set<string>;
  teamSlugs: Set<string>;
}) {
  const groups = groupByDecade(champions);
  return (
    <div className="space-y-3">
      {groups.map((group, idx) => (
        <details
          key={group.decade}
          open={idx === 0}
          className="group rounded-xl bg-surface/40 border border-border/60 overflow-hidden"
        >
          <summary className="flex items-baseline justify-between px-4 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:bg-surface transition-colors duration-(--duration-fast)">
            <span className="text-text text-base font-semibold tracking-tight">
              {group.label}
            </span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-text-faint font-semibold font-mono">
              {group.rows.length}{' '}
              {group.rows.length === 1 ? 'champion' : 'champions'}
            </span>
          </summary>
          <div className="divide-y divide-border/40 border-t border-border/60">
            {group.rows.map((c, i) => (
              <div key={`${c.year}-${i}`} className="px-4 py-2.5">
                <div className="hidden sm:grid grid-cols-[3.5rem_1fr_minmax(0,1fr)] gap-x-3 items-baseline">
                  <div className="text-text-muted tabular-nums text-sm font-medium tnum font-mono">
                    {c.year}
                  </div>
                  <div className="text-text text-sm leading-snug">
                    <DriverCell name={c.driver} driverSlugs={driverSlugs} />
                  </div>
                  <div className="text-xs text-text-muted leading-snug">
                    {c.team ? (
                      <TeamCell name={c.team} teamSlugs={teamSlugs} />
                    ) : (
                      ''
                    )}
                  </div>
                </div>
                <div className="sm:hidden">
                  <div className="flex items-baseline gap-3">
                    <span className="text-text-muted tabular-nums text-sm font-medium tnum font-mono w-12 shrink-0">
                      {c.year}
                    </span>
                    <span className="text-text text-sm">
                      <DriverCell name={c.driver} driverSlugs={driverSlugs} />
                    </span>
                  </div>
                  {c.team && (
                    <div className="ml-[3.75rem] mt-0.5 text-[11px] text-text-faint">
                      <TeamCell name={c.team} teamSlugs={teamSlugs} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] uppercase tracking-[0.18em] text-text-faint font-semibold mb-3">
      {children}
    </h2>
  );
}

export async function ChampionsTab({ series }: { series: Series }) {
  const [curated, curatedDrivers] = await Promise.all([
    loadCuratedChampions(series.meta.slug),
    loadCuratedDrivers(series.meta.slug),
  ]);

  // Build per-series slug sets from the current series's curated drivers/teams.
  // Champion names that slug-match resolve to /drivers/<slug> or /teams/<slug>.
  // Past champions outside the current curated roster render as plain text.
  const driverSlugs = new Set(
    curatedDrivers?.teams.flatMap(t => t.drivers.map(d => slugify(d.name))) ??
      [],
  );
  const teamSlugs = new Set(
    curatedDrivers?.teams.map(t => slugify(t.name)) ?? [],
  );

  let champions: Champion[];
  let sourceLabel: string;
  let pageUrl: string;

  if (curated && curated.length > 0) {
    champions = [...curated].sort((a, b) => b.year - a.year);
    sourceLabel = 'curated';
    pageUrl = wikipediaUrl(
      series.meta.championsPage ?? series.meta.wikipediaPage ?? '',
    );
  } else {
    const candidates: string[] = [];
    if (series.meta.championsPage) candidates.push(series.meta.championsPage);
    if (
      series.meta.wikipediaPage &&
      series.meta.wikipediaPage !== series.meta.championsPage
    ) {
      candidates.push(series.meta.wikipediaPage);
    }
    if (candidates.length === 0) {
      return <PlaceholderTab tabLabel="Champions" />;
    }
    champions = await fetchChampions(candidates);
    sourceLabel = 'Wikipedia';
    pageUrl = wikipediaUrl(
      series.meta.championsPage ?? series.meta.wikipediaPage ?? '',
    );
  }

  if (champions.length === 0) {
    return (
      <div className="rounded-xl bg-surface/40 border border-border/60 p-8 text-center">
        <div className="text-text text-base font-medium mb-1">
          No champions data
        </div>
        <div className="text-text-faint text-sm mb-4">
          We couldn&apos;t parse a champions table for {series.meta.name}.
        </div>
        <a
          href={pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-text-muted text-sm underline underline-offset-4 hover:text-text transition-colors duration-(--duration-fast)"
        >
          View on Wikipedia
        </a>
      </div>
    );
  }

  const constructorChampions: ConstructorChampion[] = champions
    .filter(c => !!c.constructorChampion)
    .map(c => ({ year: c.year, team: c.constructorChampion! }));
  const hasConstructorChampionship = constructorChampions.length > 0;

  const secondaryChampions: SecondaryChampion[] = champions
    .filter(c => !!c.secondaryDriver)
    .map(c => ({
      year: c.year,
      driver: c.secondaryDriver!,
      team: c.secondaryTeam,
    }));
  const hasSecondaryChampionship = secondaryChampions.length > 0;
  const secondaryLabel =
    champions.find(c => c.secondaryLabel)?.secondaryLabel ??
    'Secondary Championship';

  const sourceFooter = (
    <div className="px-2 py-2 text-[11px] text-text-faint">
      {sourceLabel === 'curated' ? (
        <span>Source: curated</span>
      ) : (
        <a
          href={pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-text-muted transition-colors duration-(--duration-fast)"
        >
          Source: Wikipedia →
        </a>
      )}
    </div>
  );

  if (!hasConstructorChampionship && !hasSecondaryChampionship) {
    return (
      <>
        <DriversSection
          champions={champions}
          driverSlugs={driverSlugs}
          teamSlugs={teamSlugs}
        />
        {sourceFooter}
      </>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <SectionHeading>Drivers&apos; Championship</SectionHeading>
        <DriversSection
          champions={champions}
          driverSlugs={driverSlugs}
          teamSlugs={teamSlugs}
        />
      </section>
      {hasConstructorChampionship && (
        <section>
          <SectionHeading>Constructors&apos; Championship</SectionHeading>
          <ConstructorsSection
            champions={constructorChampions}
            teamSlugs={teamSlugs}
          />
        </section>
      )}
      {hasSecondaryChampionship && (
        <section>
          <SectionHeading>{secondaryLabel}</SectionHeading>
          <SecondarySection
            champions={secondaryChampions}
            driverSlugs={driverSlugs}
            teamSlugs={teamSlugs}
          />
        </section>
      )}
      {sourceFooter}
    </div>
  );
}
