import * as cheerio from 'cheerio';
import type { DriverStanding } from '@/lib/types';

export type { DriverStanding };

const STANDINGS_URL = 'https://www.indycar.com/Standings';

// Sanity floor. Real IndyCar grids are 25+ entries; <10 means we landed on a
// structurally-broken response (CMS change, bot-mitigation page, etc.). Fail
// closed and let the StandingsTab render its "temporarily unavailable"
// placeholder rather than ship a partial-and-misleading table.
const MIN_DRIVERS = 10;

interface DriverData {
  driverUrl?: string;
  rank?: number;
  wins?: number;
  poles?: number;
  points?: number;
  firstName?: string;
  lastName?: string;
  countryAbbreviation?: string;
  // teamLogoImg, manufacturerLogoImg, etc. — present in the JSON but unused;
  // team name is read from the sibling cell's <img alt="..."> below.
}

function teamFromAlt(alt: string | undefined): string {
  if (!alt) return '';
  // indycar.com renders the team-logo alt as e.g. "Chip Ganassi Racing Logo "
  // (trailing space included). Strip the " Logo" suffix and trim.
  return alt.replace(/\s+Logo\s*$/i, '').trim();
}

export async function fetchIndyCarStandings(): Promise<{
  drivers: DriverStanding[];
} | null> {
  let html: string;
  try {
    const res = await fetch(STANDINGS_URL, {
      headers: {
        // Non-browser User-Agents have been observed to receive a SPA shell
        // instead of the SSR'd HTML; a standard Chromium UA returns the page
        // with `data-driver-data` attributes baked in.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      // Hourly revalidate — IndyCar updates the page within minutes of a
      // session ending; an hour is fine for the standings tab.
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  try {
    const $ = cheerio.load(html);
    const drivers: DriverStanding[] = [];

    $('button[data-driver-data]').each((_, el) => {
      const raw = $(el).attr('data-driver-data');
      if (!raw) return;

      let data: DriverData;
      try {
        data = JSON.parse(raw);
      } catch {
        return;
      }

      const team = teamFromAlt(
        $(el)
          .closest('tr')
          .find('.data-table-team-img-container img')
          .first()
          .attr('alt'),
      );

      const position = Number(data.rank);
      const points = Number(data.points);
      if (
        !Number.isFinite(position) ||
        !Number.isFinite(points) ||
        !data.firstName ||
        !data.lastName ||
        !team
      ) {
        return;
      }

      const wins = Number(data.wins);
      drivers.push({
        position,
        driverName: `${data.firstName} ${data.lastName}`,
        team,
        points,
        wins: Number.isFinite(wins) ? wins : undefined,
      });
    });

    if (drivers.length < MIN_DRIVERS) return null;
    return { drivers: drivers.sort((a, b) => a.position - b.position) };
  } catch {
    return null;
  }
}
