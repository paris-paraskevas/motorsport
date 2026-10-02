import { listSeriesSlugs, loadSeriesMeta } from './series';
import { loadCuratedDrivers } from './series-content';
import { namesMatch, slugify } from './slug';

export interface DriverDetail {
  slug: string;
  name: string;
  code?: string;
  number?: number;
  team: string;
  teamSlug: string;
  teamColor?: string;
  seriesSlug: string;
  seriesName: string;
  seriesColor: string;
}

export interface TeamDriverEntry {
  name: string;
  slug: string;
  code?: string;
  number?: number;
}

export interface TeamDetail {
  slug: string;
  name: string;
  color?: string;
  seriesSlug: string;
  seriesName: string;
  seriesColor: string;
  drivers: TeamDriverEntry[];
}

async function collectFromCuratedSeries<T>(
  visitor: (
    seriesMeta: { slug: string; name: string; color: string },
    teams: Array<{ name: string; color?: string; drivers: Array<{ name: string; code?: string; number?: number }> }>,
  ) => T[],
): Promise<T[]> {
  const slugs = await listSeriesSlugs();
  const lists = await Promise.all(
    slugs.map(async slug => {
      const [meta, curated] = await Promise.all([
        loadSeriesMeta(slug),
        loadCuratedDrivers(slug),
      ]);
      if (!curated) return [];
      return visitor(
        { slug: meta.slug, name: meta.name, color: meta.color },
        curated.teams,
      );
    }),
  );
  return lists.flat();
}

// Last hyphen-token of a series slug — the short disambiguator appended to a
// colliding driver slug (adac-ravenol-24h → "24h", nls → "nls").
function seriesSlugToken(seriesSlug: string): string {
  const parts = seriesSlug.split('-');
  return parts[parts.length - 1];
}

// Two drivers can slugify to the same /drivers/<slug> across series — e.g. Max
// Verstappen races both F1 and the ADAC Ravenol 24h. Give the bare slug to the
// highest-priority series (F1 first, otherwise series-listing order) and suffix
// the rest with their series' last slug token, so every driver page stays
// reachable and unambiguous (F1 → /drivers/max-verstappen; the 24h entry →
// /drivers/max-verstappen-24h). Mutates + returns the list; exported for tests.
export function disambiguateDriverSlugs(all: DriverDetail[]): DriverDetail[] {
  const order = [...new Set(all.map(d => d.seriesSlug))];
  const rank = (seriesSlug: string) =>
    seriesSlug === 'f1' ? -1 : order.indexOf(seriesSlug);
  const byBase = new Map<string, DriverDetail[]>();
  for (const d of all) {
    const g = byBase.get(d.slug);
    if (g) g.push(d);
    else byBase.set(d.slug, [d]);
  }
  for (const group of byBase.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => rank(a.seriesSlug) - rank(b.seriesSlug));
    // Highest-priority series keeps the base slug; the rest get suffixed.
    for (let i = 1; i < sorted.length; i++) {
      sorted[i].slug = `${sorted[i].slug}-${seriesSlugToken(sorted[i].seriesSlug)}`;
    }
  }
  return all;
}

export async function loadAllDrivers(): Promise<DriverDetail[]> {
  const all = await collectFromCuratedSeries<DriverDetail>((series, teams) => {
    const out: DriverDetail[] = [];
    for (const team of teams) {
      const teamSlug = slugify(team.name);
      for (const d of team.drivers) {
        out.push({
          slug: slugify(d.name),
          name: d.name,
          code: d.code,
          number: d.number,
          team: team.name,
          teamSlug,
          teamColor: team.color,
          seriesSlug: series.slug,
          seriesName: series.name,
          seriesColor: series.color,
        });
      }
    }
    return out;
  });
  return disambiguateDriverSlugs(all);
}

export function loadAllTeams(): Promise<TeamDetail[]> {
  return collectFromCuratedSeries<TeamDetail>((series, teams) => {
    return teams.map(team => ({
      slug: slugify(team.name),
      name: team.name,
      color: team.color,
      seriesSlug: series.slug,
      seriesName: series.name,
      seriesColor: series.color,
      drivers: team.drivers.map(d => ({
        slug: slugify(d.name),
        name: d.name,
        code: d.code,
        number: d.number,
      })),
    }));
  });
}

export async function findDriverBySlug(slug: string): Promise<DriverDetail | null> {
  const all = await loadAllDrivers();
  return all.find(d => d.slug === slug) ?? null;
}

export async function findTeamBySlug(slug: string): Promise<TeamDetail | null> {
  const all = await loadAllTeams();
  return all.find(t => t.slug === slug) ?? null;
}

/** Where a standings or results row's person lives on the site (P2.4 PR B): a page in that series' roster, or null. */
export interface PeopleIndex {
  /** A driver's page, matched by the site's drift rule (namesMatch): an exact name first, else the one roster name that contains
   *  the feed's or that it contains; none, or two, is null. */
  driver(series: string, name: string): string | null;
  /** A driver's page from any roster (R18 PR E: a series' champions race elsewhere in time): the series' own roster by the
   *  drift rule first, else the one roster entry whose slug is exactly the name's (the bare slug the owner holds; a shared name
   *  on two rosters resolves to it), never a drift match across rosters (Fittipaldi is not Fittipaldi Jr.). */
  driverAnywhere(series: string, name: string): string | null;
  /** A team's page by the same rule, only where its slug opens that series' own team (findTeamBySlug answers the first listed). */
  team(series: string, name: string): string | null;
}

/** The index over the rosters in their listing order (loadAllDrivers, loadAllTeams): every page it answers is the one
 *  findDriverBySlug or findTeamBySlug resolves to that same person. Exported for tests. */
export function buildPeopleIndex(drivers: readonly DriverDetail[], teams: readonly TeamDetail[]): PeopleIndex {
  type Entry = { slug: string; name: string; seriesSlug: string };
  const owners = (all: readonly Entry[]) => {
    const m = new Map<string, string>();
    for (const x of all) if (!m.has(x.slug)) m.set(x.slug, x.seriesSlug);
    return m;
  };
  const bySeries = (all: readonly Entry[]) => {
    const m = new Map<string, Entry[]>();
    for (const x of all) m.set(x.seriesSlug, [...(m.get(x.seriesSlug) ?? []), x]);
    return m;
  };
  const pick = (pool: readonly Entry[] | undefined, owner: Map<string, string>, name: string, base: string): string | null => {
    const want = slugify(name);
    if (!pool || !want) return null;
    const exact = pool.filter(x => slugify(x.name) === want);
    const hits = exact.length > 0 ? exact : pool.filter(x => namesMatch(x.name, name));
    if (hits.length !== 1) return null;
    return owner.get(hits[0].slug) === hits[0].seriesSlug ? `${base}/${hits[0].slug}` : null;
  };
  const driverOwner = owners(drivers);
  const teamOwner = owners(teams);
  const driversIn = bySeries(drivers);
  const teamsIn = bySeries(teams);
  return {
    driver: (series, name) => pick(driversIn.get(series), driverOwner, name, '/drivers'),
    driverAnywhere: (series, name) => {
      const own = pick(driversIn.get(series), driverOwner, name, '/drivers');
      if (own) return own;
      const want = slugify(name);
      if (!want) return null;
      const exact = drivers.filter(x => x.slug === want);
      return exact.length === 1 ? `/drivers/${exact[0].slug}` : null;
    },
    team: (series, name) => pick(teamsIn.get(series), teamOwner, name, '/teams'),
  };
}

let index: Promise<PeopleIndex> | null = null;

/** The index over the site's own rosters, built once per process: the content bundle never changes at run time. A build that
 *  fails is not kept, so the next read tries again. */
export function peopleIndex(): Promise<PeopleIndex> {
  if (!index) {
    const built = Promise.all([loadAllDrivers(), loadAllTeams()]).then(([d, t]) => buildPeopleIndex(d, t));
    index = built;
    built.catch(() => {
      if (index === built) index = null;
    });
  }
  return index;
}
