import 'server-only';
import { loadAllSeriesMeta, loadSeries } from './series';
import { loadAllDrivers, loadAllTeams } from './people';
import { groupByWeekend } from './group';
import { tabsFor } from './tabs';
import { loadAllPosts } from './posts';
import { publishedPosts } from './blog';

// The global-search index. A flat, JSON-serialisable list of every searchable
// entity on the site — built at BUILD time (served static via app/api/search)
// and fuzzy-matched CLIENT-side by the ⌘K overlay, so there's no per-keystroke
// network hit and the index never rides the initial JS bundle.
//
// URL parity: weekend + series-tab URLs are derived from the SAME resolution the
// pages and the sitemap use (groupByWeekend + tabsFor), so a hit never links to
// a page that 404s.

export type SearchType = 'driver' | 'team' | 'series' | 'tab' | 'weekend' | 'blog' | 'page';

export interface SearchDoc {
  type: SearchType;
  /** Primary label shown + weighted highest when matching. */
  title: string;
  /** Secondary context line (team · series, "Round 8", etc.). */
  subtitle?: string;
  /** Site-relative destination. */
  url: string;
  /** Extra searchable tokens not shown (driver code/number, series slug…). */
  keywords?: string;
}

// Top-level public pages. Personal / gated surfaces (/social, /settings, /play)
// are deliberately absent — search only indexes public content.
const STATIC_PAGES: Array<{ url: string; title: string; subtitle: string }> = [
  { url: '/app', title: 'Home', subtitle: 'Your dashboard' },
  { url: '/calendar', title: 'Calendar', subtitle: 'Every series, one timeline' },
  { url: '/news', title: 'News', subtitle: 'Latest across the grid' },
  { url: '/blog', title: 'Blog', subtitle: 'Analysis & recaps' },
  { url: '/threads', title: 'Threads', subtitle: 'Fan discussion' },
  { url: '/series', title: 'All series', subtitle: 'Browse every championship' },
  { url: '/about', title: 'About Paddock', subtitle: 'What this is' },
  { url: '/changelog', title: 'Changelog', subtitle: "What's new" },
  { url: '/privacy', title: 'Privacy policy', subtitle: 'Legal' },
  { url: '/terms', title: 'Terms of use', subtitle: 'Legal' },
  { url: '/cookies', title: 'Cookie policy', subtitle: 'Legal' },
  { url: '/accessibility', title: 'Accessibility', subtitle: 'Legal' },
];

export async function buildSearchIndex(): Promise<SearchDoc[]> {
  const docs: SearchDoc[] = [];

  for (const p of STATIC_PAGES) {
    docs.push({ type: 'page', title: p.title, subtitle: p.subtitle, url: p.url });
  }

  const meta = await loadAllSeriesMeta();

  // Series landing + each non-calendar tab as its own path (the bare
  // /series/<slug> IS the calendar tab).
  for (const m of meta) {
    docs.push({
      type: 'series',
      title: m.name,
      subtitle: `${m.season} season`,
      url: `/series/${m.slug}`,
      keywords: m.slug,
    });
    for (const t of tabsFor(m.singleEvent)) {
      if (t.key === 'calendar') continue;
      docs.push({
        type: 'tab',
        title: `${m.name} ${t.label}`,
        subtitle: `${m.name} · tab`,
        url: `/series/${m.slug}/${t.key}`,
        keywords: `${m.slug} ${t.key}`,
      });
    }
  }

  // Drivers + teams (curated across all 15 series; both /drivers/<slug> and
  // /teams/<slug> render for curated entries).
  const [drivers, teams] = await Promise.all([loadAllDrivers(), loadAllTeams()]);
  for (const d of drivers) {
    docs.push({
      type: 'driver',
      title: d.name,
      subtitle: `${d.team} · ${d.seriesName}`,
      url: `/drivers/${d.slug}`,
      keywords: `${d.code ?? ''} ${d.number ?? ''} ${d.seriesSlug} ${d.team}`.trim(),
    });
  }
  for (const t of teams) {
    docs.push({
      type: 'team',
      title: t.name,
      subtitle: t.seriesName,
      url: `/teams/${t.slug}`,
      keywords: t.seriesSlug,
    });
  }

  // Weekends — resolved exactly like the sitemap (groupByWeekend + round
  // assignment) so every URL is a real, rendered page. Round name comes from
  // rounds.json when present, else a plain "Round N".
  const now = new Date();
  await Promise.all(
    meta.map(async (m) => {
      try {
        const series = await loadSeries(m.slug);
        const roundName = new Map<number, string>();
        for (const r of series.rounds?.rounds ?? []) roundName.set(r.round, r.name);
        for (const w of groupByWeekend(series.sessions, now, series.rounds)) {
          if (w.round < 1) continue;
          const name = roundName.get(w.round);
          docs.push({
            type: 'weekend',
            title: name ? `${m.name} — ${name}` : `${m.name} — Round ${w.round}`,
            subtitle: `Round ${w.round} · weekend`,
            url: `/series/${m.slug}/weekend/${w.round}`,
            keywords: `${m.slug} round ${w.round}`,
          });
        }
      } catch {
        /* a series that fails to load just contributes no weekends */
      }
    }),
  );

  // Blog — file-based MDX (always available) + DB-published posts (fail-soft;
  // returns [] when Supabase is absent). Deduped by URL below.
  const [filePosts, dbPosts] = await Promise.all([loadAllPosts(), publishedPosts()]);
  for (const p of filePosts) {
    docs.push({
      type: 'blog',
      title: p.frontmatter.title,
      subtitle: 'Blog',
      url: `/blog/${p.slug}`,
      keywords: (p.frontmatter.tags ?? []).join(' '),
    });
  }
  for (const p of dbPosts) {
    docs.push({
      type: 'blog',
      title: p.title,
      subtitle: 'Blog',
      url: `/blog/${p.slug}`,
      keywords: p.seriesSlug ?? '',
    });
  }

  // Dedupe by URL: driver/team slugs can collide across series (the page
  // resolves the first), and a file MDX + DB post could share a slug.
  const seen = new Set<string>();
  return docs.filter((d) => (seen.has(d.url) ? false : (seen.add(d.url), true)));
}
