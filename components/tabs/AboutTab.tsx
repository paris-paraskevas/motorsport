import path from 'node:path';
import { Series } from '@/lib/types';
import { fetchWikipediaSummary } from '@/lib/wikipedia';
import { loadMarkdownWithFrontmatter } from '@/lib/content';
import { PlaceholderTab } from './PlaceholderTab';

function firstSentences(text: string, count: number): string {
  const matches = text.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (!matches || matches.length === 0) return text.trim();
  return matches.slice(0, count).join('').trim();
}

export async function AboutTab({ series }: { series: Series }) {
  const page = series.meta.wikipediaPage;
  const overview = series.overview?.trim() ?? '';
  // F1's curated overview (content/series/f1/overview.md — race-weekend shape,
  // points, the 2026 reset) is the flagship series' introduction, so give it a
  // labelled section header like its About-tab siblings (Rules essentials /
  // About {name}) instead of rendering as an orphaned intro block. Other series
  // keep the bare render — this is an F1-only surface polish, guarded by slug
  // the same way SeriesPageView gates the F1 Telemetry hub.
  const isF1 = series.meta.slug === 'f1';
  // Rules essentials live INSIDE About (operator decision 2026-06-11 — the
  // Rules tab stays retired per 0.19.0). Curated per series under
  // content/series/<slug>/rules.md; every current series ships one, but the
  // catch below tolerates an absent file (no section) if one is ever added
  // without rules.
  const rulesPath = path.join(
    process.cwd(),
    'content',
    'series',
    series.meta.slug,
    'rules.md',
  );
  const rules = await loadMarkdownWithFrontmatter(rulesPath).catch(() => null);
  const summary = page ? await fetchWikipediaSummary(page) : null;

  if (!overview && !summary) {
    return (
      <div className="space-y-4">
        <PlaceholderTab tabLabel="About" />
        <ExternalSourcesCard series={series} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {overview &&
        (isF1 ? (
          <section className="border-y border-border py-5 md:py-6">
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
              Series overview
            </h2>
            <article
              className="prose dark:prose-invert prose-sm max-w-none
                         prose-headings:tracking-tight prose-headings:text-text
                         prose-h2:text-base prose-h2:mt-6 prose-h2:mb-3 prose-h2:font-semibold
                         prose-p:leading-relaxed
                         prose-strong:text-text"
              dangerouslySetInnerHTML={{ __html: overview }}
            />
          </section>
        ) : (
          <article
            className="border-y border-border py-5 md:py-6
                       prose dark:prose-invert prose-sm max-w-none
                       prose-headings:tracking-tight prose-headings:text-text
                       prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3 prose-h2:font-semibold
                       prose-p:leading-relaxed
                       prose-strong:text-text"
            dangerouslySetInnerHTML={{ __html: overview }}
          />
        ))}
      {rules?.html && (
        <section className="border-y border-border py-5 md:py-6">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
            Rules essentials
          </h2>
          <article
            className="prose dark:prose-invert prose-sm max-w-none
                       prose-headings:tracking-tight prose-headings:text-text
                       prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2 prose-h2:font-semibold
                       prose-p:leading-relaxed prose-li:leading-relaxed
                       prose-strong:text-text"
            dangerouslySetInnerHTML={{ __html: rules.html }}
          />
        </section>
      )}
      {summary && (
        <div className="border-y border-border py-5">
          <h2 className="text-text text-lg font-semibold mb-3">
            About {series.meta.name}
          </h2>
          {summary.description && (
            <p className="text-text-muted text-sm mb-3">{summary.description}</p>
          )}
          <blockquote className="border-l-2 border-border-strong pl-4 text-text-muted text-sm leading-relaxed">
            {firstSentences(summary.extract, 3)}
          </blockquote>
          <div className="mt-4 text-xs text-text-faint">
            Source:{' '}
            <a
              href={summary.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-text underline underline-offset-2 transition-colors duration-(--duration-fast)"
            >
              Wikipedia &rarr;
            </a>
          </div>
        </div>
      )}
      {isF1 && <F1CommonTopics />}
      <ExternalSourcesCard series={series} />
    </div>
  );
}

// F1-only quick-reference of the rule areas fans most often look up, sitting
// alongside the curated "Rules essentials" prose and the FIA-regulations link.
// A static reference (not links) — the FIA regulations chip in Further reading
// is the authoritative deep-dive. F1-gated by slug like the rest of this tab.
const F1_COMMON_TOPICS: Array<{ term: string; blurb: string }> = [
  {
    term: 'Points system',
    blurb: 'The top ten score 25-18-15-12-10-8-6-4-2-1; there is no fastest-lap bonus point (scrapped from 2025). Sprints pay the top eight 8-7-6-5-4-3-2-1.',
  },
  {
    term: 'Penalties & stewards',
    blurb: 'The FIA stewards judge incidents and can apply time penalties, grid drops, or licence points; a driver reaching 12 points in 12 months serves a one-race ban.',
  },
  {
    term: 'Parc fermé',
    blurb: 'From the start of qualifying the car is locked to its set-up; only a defined list of changes is allowed, and breaking the rules means a pit-lane start.',
  },
  {
    term: 'Overtaking aid',
    blurb: 'DRS is gone for 2026: every car sheds drag on the straights with active aero, and the passing aid is Overtake Mode — a burst of extra electric power when within one second of the car ahead at the detection point.',
  },
  {
    term: 'Track limits',
    blurb: 'A lap is deleted or a warning issued when all four wheels go beyond the white lines; repeated breaches escalate to a black-and-white flag then a penalty.',
  },
  {
    term: 'Tyres',
    blurb: 'Pirelli brings three dry compounds per weekend; a dry race requires at least two different slick compounds to be used, with wets and intermediates for rain.',
  },
];

function F1CommonTopics() {
  return (
    <section className="border-y border-border py-5 md:py-6">
      <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
        Common topics
      </h2>
      <dl className="space-y-2.5">
        {F1_COMMON_TOPICS.map(topic => (
          <div key={topic.term} className="text-sm leading-relaxed">
            <dt className="inline font-semibold text-text">{topic.term}.</dt>{' '}
            <dd className="inline text-text-muted">{topic.blurb}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// Official links (formerly the Rules tab's "Further reading" card — that tab
// was retired in 0.19.0; its rules content now lives in the per-series
// rules.md rendered as the "Rules essentials" section above).
function ExternalSourcesCard({ series }: { series: Series }) {
  const items: Array<{ label: string; url: string }> = [];
  if (series.meta.officialSite) {
    items.push({ label: 'Official site', url: series.meta.officialSite });
  }
  if (series.meta.officialStandingsUrl) {
    items.push({ label: 'Standings', url: series.meta.officialStandingsUrl });
  }
  if (series.meta.regulationsUrl) {
    items.push({ label: 'FIA regulations', url: series.meta.regulationsUrl });
  }
  if (items.length === 0) return null;

  return (
    <div className="border-y border-border py-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint font-semibold mb-3">
        Further reading
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map(item => (
          <a
            key={item.url}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-text-muted hover:text-text border border-border hover:border-border-strong px-3 py-1.5 transition-colors duration-(--duration-fast)"
          >
            {item.label} ↗
          </a>
        ))}
      </div>
    </div>
  );
}
