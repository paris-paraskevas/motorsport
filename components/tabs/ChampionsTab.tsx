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

// Cumulative-title tally, derived purely from the champions list already on the
// page — no new data. For a given championship section we count how many titles
// each champion holds (keyed by the exact display string, so GT World's
// comma-joined crews are matched as a unit, not split) and stamp each year with
// that champion's running count *up to and including* that season. Because rows
// render newest-first, the top row shows the champion's highest tally (e.g.
// Verstappen's 2024 row → 4), making dynasties scannable at a glance. The
// section total lets the UI show the pip visual as "k of total".
interface TitleTally {
  /** This champion's cumulative title number as of this year (1 = first). */
  count: number;
  /** This champion's total titles within this section. */
  total: number;
}

function computeTitleTally<T extends { year: number }>(
  rows: T[],
  keyOf: (row: T) => string,
): Map<T, TitleTally> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = keyOf(row).trim();
    if (!key) continue;
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }
  // Walk oldest-first so the running count increments chronologically, then
  // attach the season's number + the champion's section total to each row.
  const chronological = [...rows].sort((a, b) => a.year - b.year);
  const running = new Map<string, number>();
  const out = new Map<T, TitleTally>();
  for (const row of chronological) {
    const key = keyOf(row).trim();
    if (!key) continue;
    const next = (running.get(key) ?? 0) + 1;
    running.set(key, next);
    out.set(row, { count: next, total: totals.get(key) ?? next });
  }
  return out;
}

// Compact "cumulative titles" marker: an "×N" pill in the series tint plus a
// mini bar of `count`-filled pips out of `total`, capped so a 7-time champion
// stays as tight as a 2-time one. Rendered only for repeat champions (total > 1)
// so one-off winners stay clean. Read-only; the count is the current season's
// running total, so scanning a repeat champion's rows shows the tally climb.
const PIP_CAP = 7;

function TitleTallyBadge({ tally }: { tally: TitleTally | undefined }) {
  if (!tally || tally.total < 2) return null;
  const shown = Math.min(tally.total, PIP_CAP);
  const filled = Math.min(tally.count, shown);
  return (
    <span
      className="inline-flex items-center gap-1 align-middle"
      title={`Title ${tally.count} of ${tally.total}`}
      aria-label={`Title ${tally.count} of ${tally.total}`}
    >
      <span className="text-[10px] leading-none font-semibold font-mono tabular-nums text-tint">
        ×{tally.total}
      </span>
      <span className="hidden sm:inline-flex items-center gap-[2px]" aria-hidden>
        {Array.from({ length: shown }, (_, i) => (
          <span
            key={i}
            className={`h-2 w-[3px] rounded-full ${
              i < filled ? 'bg-tint' : 'bg-border'
            }`}
          />
        ))}
      </span>
    </span>
  );
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

// Wikipedia's champions tables decorate repeated names with annotations like
// "Alex Palou (1)", "Alex Palou (2)" for successive titles, and occasional
// markers ("*", "†", "‡"). Strip those for slug-matching, but display the
// original text. Without this, only the un-annotated first title links.
function nameForSlugMatch(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/\s*[*†‡]+\s*$/g, '')
    .trim();
}

// Champions tables and current drivers.json can disagree on team-name form
// (e.g. champions: "Red Bull"; drivers.json: "Red Bull Racing"). Build a slug
// → canonical-ref map so a champion name slug-matches via the suffix-stripped
// alias but the Link still routes to the real team page slug. The ref also
// carries the drivers.json team color: champion team names render in their
// team color where the team is on the current grid; historic teams with no
// color mapping stay plain (curated historic color map is a future task).
const TEAM_SUFFIX_STRIP = /\s+(Racing|F1 Team|GP|Team)$/i;

interface TeamRef {
  slug: string;
  color?: string;
}

// drivers.json colors were curated for 3px team bars, where dark hues work;
// as TEXT on the near-black background some fail contrast (Red Bull navy
// ≈ 2:1). Lift only the dark ones toward white — bright hexes untouched.
function readableTeamColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const lum =
    0.2126 * lin((n >> 16) & 255) +
    0.7152 * lin((n >> 8) & 255) +
    0.0722 * lin(n & 255);
  return lum < 0.12 ? `color-mix(in srgb, ${hex} 60%, white)` : hex;
}

function TeamLinkResolver({
  name,
  teamSlugMap,
}: {
  name: string;
  teamSlugMap: Map<string, TeamRef>;
}) {
  const slug = slugify(nameForSlugMatch(name));
  const ref = teamSlugMap.get(slug);
  if (ref) {
    return (
      <Link
        href={`/teams/${ref.slug}`}
        className={LINK_CLASS}
        style={ref.color ? { color: ref.color } : undefined}
      >
        {name}
      </Link>
    );
  }
  return <>{name}</>;
}

function DriverCell({
  name,
  driverSlugs,
}: {
  name: string;
  driverSlugs: Set<string>;
}) {
  const slug = slugify(nameForSlugMatch(name));
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
  teamSlugMap,
}: {
  name: string;
  teamSlugMap: Map<string, TeamRef>;
}) {
  return <TeamLinkResolver name={name} teamSlugMap={teamSlugMap} />;
}

function DriversSection({
  champions,
  driverSlugs,
  teamSlugMap,
}: {
  champions: Champion[];
  driverSlugs: Set<string>;
  teamSlugMap: Map<string, TeamRef>;
}) {
  const groups = groupByDecade(champions);
  const tally = computeTitleTally(champions, c => c.driver);
  return (
    <div className="space-y-3">
      {groups.map((group, idx) => (
        <details
          key={group.decade}
          open={idx === 0}
          className="group border-y border-border overflow-hidden"
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
                  <div className="text-text text-sm leading-snug flex items-baseline gap-2">
                    <DriverCell name={c.driver} driverSlugs={driverSlugs} />
                    <TitleTallyBadge tally={tally.get(c)} />
                  </div>
                  <div className="text-xs text-text-muted leading-snug">
                    {c.constructor ? (
                      <TeamCell name={c.constructor} teamSlugMap={teamSlugMap} />
                    ) : (
                      ''
                    )}
                  </div>
                </div>
                <div className="sm:hidden">
                  <div className="flex items-baseline gap-2">
                    <span className="text-text-muted tabular-nums text-sm font-medium tnum font-mono w-12 shrink-0">
                      {c.year}
                    </span>
                    <span className="text-text text-sm">
                      <DriverCell name={c.driver} driverSlugs={driverSlugs} />
                    </span>
                    <TitleTallyBadge tally={tally.get(c)} />
                  </div>
                  {c.constructor && (
                    <div className="ml-[3.75rem] mt-0.5 text-[11px] text-text-faint">
                      <TeamCell name={c.constructor} teamSlugMap={teamSlugMap} />
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
  teamSlugMap,
}: {
  champions: ConstructorChampion[];
  teamSlugMap: Map<string, TeamRef>;
}) {
  const groups = groupByDecade(champions);
  const tally = computeTitleTally(champions, c => c.team);
  return (
    <div className="space-y-3">
      {groups.map((group, idx) => (
        <details
          key={group.decade}
          open={idx === 0}
          className="group border-y border-border overflow-hidden"
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
                <div className="flex items-baseline gap-2">
                  <span className="text-text-muted tabular-nums text-sm font-medium tnum font-mono w-12 shrink-0">
                    {c.year}
                  </span>
                  <span className="text-text text-sm leading-snug">
                    <TeamCell name={c.team} teamSlugMap={teamSlugMap} />
                  </span>
                  <TitleTallyBadge tally={tally.get(c)} />
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
  teamSlugMap,
}: {
  champions: SecondaryChampion[];
  driverSlugs: Set<string>;
  teamSlugMap: Map<string, TeamRef>;
}) {
  const groups = groupByDecade(champions);
  const tally = computeTitleTally(champions, c => c.driver);
  return (
    <div className="space-y-3">
      {groups.map((group, idx) => (
        <details
          key={group.decade}
          open={idx === 0}
          className="group border-y border-border overflow-hidden"
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
                  <div className="text-text text-sm leading-snug flex items-baseline gap-2">
                    <DriverCell name={c.driver} driverSlugs={driverSlugs} />
                    <TitleTallyBadge tally={tally.get(c)} />
                  </div>
                  <div className="text-xs text-text-muted leading-snug">
                    {c.team ? (
                      <TeamCell name={c.team} teamSlugMap={teamSlugMap} />
                    ) : (
                      ''
                    )}
                  </div>
                </div>
                <div className="sm:hidden">
                  <div className="flex items-baseline gap-2">
                    <span className="text-text-muted tabular-nums text-sm font-medium tnum font-mono w-12 shrink-0">
                      {c.year}
                    </span>
                    <span className="text-text text-sm">
                      <DriverCell name={c.driver} driverSlugs={driverSlugs} />
                    </span>
                    <TitleTallyBadge tally={tally.get(c)} />
                  </div>
                  {c.team && (
                    <div className="ml-[3.75rem] mt-0.5 text-[11px] text-text-faint">
                      <TeamCell name={c.team} teamSlugMap={teamSlugMap} />
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
  // Single-event series (e.g. the 24h Nürburgring) have no season championship —
  // this tab is a list of past race winners, so "Champions" / "Drivers'
  // Championship" is the wrong word. Reuse the same meta flag that drives the
  // slim tab set (SINGLE_EVENT_TAB_KEYS) and the tab-strip label.
  const isSingleEvent = series.meta.singleEvent === true;
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
  // Team-slug map: every slug variant points to the canonical drivers.json slug,
  // so the champion text "Red Bull" matches and links to /teams/red-bull-racing
  // (the real page). Suffix-stripped aliases handle the common "X Racing" /
  // "X F1 Team" / "X GP" / "X Team" forms.
  const teamSlugMap = new Map<string, TeamRef>();
  for (const t of curatedDrivers?.teams ?? []) {
    const canonical = slugify(t.name);
    const ref: TeamRef = {
      slug: canonical,
      color: t.color ? readableTeamColor(t.color) : undefined,
    };
    teamSlugMap.set(canonical, ref);
    const stripped = slugify(t.name.replace(TEAM_SUFFIX_STRIP, ''));
    if (stripped !== canonical && !teamSlugMap.has(stripped)) {
      teamSlugMap.set(stripped, ref);
    }
  }

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
      return <PlaceholderTab tabLabel={isSingleEvent ? 'Past Winners' : 'Champions'} />;
    }
    champions = await fetchChampions(candidates);
    sourceLabel = 'Wikipedia';
    pageUrl = wikipediaUrl(
      series.meta.championsPage ?? series.meta.wikipediaPage ?? '',
    );
  }

  if (champions.length === 0) {
    return (
      <div className="border border-border bg-surface/40 p-8 text-center">
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
          teamSlugMap={teamSlugMap}
        />
        {sourceFooter}
      </>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <SectionHeading>
          {isSingleEvent ? 'Past Winners' : <>Drivers&apos; Championship</>}
        </SectionHeading>
        <DriversSection
          champions={champions}
          driverSlugs={driverSlugs}
          teamSlugMap={teamSlugMap}
        />
      </section>
      {hasConstructorChampionship && (
        <section>
          <SectionHeading>Constructors&apos; Championship</SectionHeading>
          <ConstructorsSection
            champions={constructorChampions}
            teamSlugMap={teamSlugMap}
          />
        </section>
      )}
      {hasSecondaryChampionship && (
        <section>
          <SectionHeading>{secondaryLabel}</SectionHeading>
          <SecondarySection
            champions={secondaryChampions}
            driverSlugs={driverSlugs}
            teamSlugMap={teamSlugMap}
          />
        </section>
      )}
      {sourceFooter}
    </div>
  );
}
