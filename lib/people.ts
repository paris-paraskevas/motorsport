import { listSeriesSlugs, loadSeriesMeta } from './series';
import { loadCuratedDrivers } from './series-content';
import { slugify } from './slug';

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

export function loadAllDrivers(): Promise<DriverDetail[]> {
  return collectFromCuratedSeries<DriverDetail>((series, teams) => {
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
