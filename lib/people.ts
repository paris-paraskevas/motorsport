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
