import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { loadAllSeries } from '@/lib/series';
import { groupByWeekend } from '@/lib/group';
import { weekendLabel, weekendStartEnd } from '@/lib/weekend';
import { isThisWeekend } from '@/lib/date';
import { fetchFirstPodiumWithin, homeResultsSupported } from '@/lib/home-results';
import { isBettingConfigured } from '@/lib/betting/client';
import { JsonLd } from '@/components/JsonLd';
import { organizationLd, websiteLd } from '@/lib/json-ld';
import { withSocialMeta } from '@/lib/seo';
import { SITE_TITLE, SITE_DESCRIPTION } from '@/lib/site';
import { StandaloneRedirect } from '@/components/landing/StandaloneRedirect';
import { LandingNav } from '@/components/landing/LandingNav';
import { InstallApp } from '@/components/landing/InstallApp';
import { LandingFooter } from '@/components/landing/LandingFooter';
import type { NavSeriesMeta, Weekend } from '@/lib/types';

export const revalidate = 300;

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  // The layout default gives the descriptive <title>, but its OG/Twitter title
  // is the bare site name; set the descriptive social title + description here
  // for the home page (Next replaces og/twitter blocks per route, not merges).
  ...withSocialMeta({
    title: `${SITE_TITLE} — Live F1, MotoGP, WEC, IndyCar & NASCAR schedule`,
    description: SITE_DESCRIPTION,
    path: '/',
  }),
};

// Panel 10a (design handoff §4.10): the landing shows the product, not a
// pitch — what is on this weekend and what happened last time out, live in
// the hero. Three promises follow in the order a new user meets them, and
// the account ask sits last as a footnote, because the site is free to
// browse and saying so plainly is more persuasive than a sign-up wall.

type WeekendRow = {
  slug: string;
  seriesName: string;
  color: string;
  eventName: string;
  href: string;
  start: Date;
  end: Date;
};

function rangeLabel(rows: WeekendRow[]): string {
  if (rows.length === 0) return '';
  const min = rows.reduce((a, r) => (r.start < a ? r.start : a), rows[0].start);
  const max = rows.reduce((a, r) => (r.end > a ? r.end : a), rows[0].end);
  const day = (d: Date) => d.getUTCDate();
  const mon = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });
  return mon.format(min) === mon.format(max)
    ? `${day(min)} – ${day(max)} ${mon.format(max)}`
    : `${day(min)} ${mon.format(min)} – ${day(max)} ${mon.format(max)}`;
}

// "Last time out" — the most recent finished round with a real podium, tried
// newest-first across the covered series. Network-backed (KV podium cache), so
// it streams behind Suspense inside the hero panel, hard-capped by a 2 s
// budget: React holds the ISR document stream open until this resolves, and an
// uncapped cold lookup meant ~7 s of doomed upstream fetches on every render
// (the 2026-08-20 PSI stall — the Worker's upstream egress is blocked, so a
// cold candidate can only burn its timeouts and fail).
const LAST_TIME_OUT_BUDGET_MS = 2000;

async function LastTimeOut({ candidates }: { candidates: string[] }) {
  const race = await fetchFirstPodiumWithin(candidates, LAST_TIME_OUT_BUDGET_MS);
  const winner = race?.podium[0];
  if (!race || !winner) return null;
  const surname = winner.name.split(' ').slice(-1)[0];
  const margin = race.podium[1]?.time?.startsWith('+') ? race.podium[1].time : null;
  const date = new Date(race.date);
  const dateLabel = Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  return (
    <div className="mt-4 border-t border-border pt-3">
      <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        Last time out
      </span>
      <p className="mt-1 font-serif text-[17px] font-semibold leading-tight text-text">
        {surname} wins — {race.raceName}
      </p>
      <p className="mt-0.5 font-mono text-[10px] tabular-nums uppercase tracking-[0.12em] text-text-faint">
        {margin ? `by ${margin.replace(/^\+/, '')}` : ''}
        {margin && dateLabel ? ' · ' : ''}
        {dateLabel ?? ''}
      </p>
    </div>
  );
}

export default async function Landing() {
  const all = await loadAllSeries();
  const now = new Date();

  const navSeries: NavSeriesMeta[] = all.map(s => ({
    slug: s.meta.slug,
    name: s.meta.name,
    color: s.meta.color,
    category: s.meta.category,
  }));

  // Group every series' season once and derive both hero facts from it: what
  // runs this weekend, and where the most recent finished round is (the
  // Last-time-out candidate order). NB loadAllSeries above is NOT local-only:
  // configured feeds fetch over the network through a 6 h data cache
  // (lib/ics.ts fetchIcsText), with the bundled fallback ICS on failure.
  const perSeries = all.map(s => {
    let weekends: Weekend[];
    try {
      weekends = groupByWeekend(s.sessions, now, s.rounds);
    } catch {
      weekends = [];
    }
    return { s, weekends };
  });

  const thisWeekend: WeekendRow[] = [];
  const upcomingRows: WeekendRow[] = [];
  for (const { s, weekends } of perSeries) {
    for (const w of weekends) {
      if (w.isPast) continue;
      const { start, end } = weekendStartEnd(w);
      if (end.getTime() < now.getTime()) continue;
      const row: WeekendRow = {
        slug: s.meta.slug,
        seriesName: s.meta.name,
        color: s.meta.color,
        eventName: w.roundName ?? weekendLabel(w, w.round).title,
        href: `/series/${s.meta.slug}/weekend/${w.round}`,
        start,
        end,
      };
      if (w.sessions.some(x => isThisWeekend(x.start, now))) thisWeekend.push(row);
      else upcomingRows.push(row);
    }
  }
  thisWeekend.sort((a, b) => a.start.getTime() - b.start.getTime());
  upcomingRows.sort((a, b) => a.start.getTime() - b.start.getTime());
  const rows = thisWeekend.length > 0 ? thisWeekend.slice(0, 4) : upcomingRows.slice(0, 3);
  const panelLabel = thisWeekend.length > 0 ? 'This weekend' : 'Next on track';

  const lastCandidates = perSeries
    .map(({ s, weekends }) => {
      const lw = [...weekends].reverse().find(w => w.isPast);
      return lw ? { slug: s.meta.slug, end: weekendStartEnd(lw).end } : null;
    })
    .filter((c): c is { slug: string; end: Date } => c !== null)
    .filter(c => homeResultsSupported(c.slug))
    .sort((a, b) => b.end.getTime() - a.end.getTime())
    .map(c => c.slug);

  return (
    <>
      <StandaloneRedirect />
      <JsonLd data={organizationLd()} />
      <JsonLd data={websiteLd()} />

      <LandingNav seriesList={navSeries} bettingEnabled={isBettingConfigured()} />

      <main className="mx-auto w-full max-w-[1200px] px-4 pb-16 md:px-6">
        {/* ── The hero: the claim on the left, the product on the right. ── */}
        {/* Base track is minmax(0,1fr), not auto: an auto track takes the
            aside's min-content (its nowrap rows) and overflows small phones. */}
        <section className="grid grid-cols-[minmax(0,1fr)] gap-10 pt-10 md:pt-14 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">
              Fifteen championships · one place
            </p>
            <h1 className="mt-4 max-w-[16ch] font-serif text-[44px] font-medium leading-[1.04] tracking-[-0.02em] text-text md:text-[58px]">
              Every session, every result, in your own time zone
            </h1>
            <p className="mt-6 max-w-[52ch] font-serif text-[19px] leading-relaxed text-text-muted">
              Formula 1, MotoGP, WEC, IndyCar, NASCAR, WRC and nine more —
              schedules, standings, results and sourced explainers. Free to
              browse, no account needed.
            </p>
            <div className="mt-8 flex flex-wrap items-start gap-3">
              <Link
                href="/app"
                data-heatmap-id="landing:open-app"
                className="inline-flex min-h-11 items-center bg-text px-5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted"
              >
                See what is on now
              </Link>
              <InstallApp />
            </div>
          </div>

          {/* The product, live: what runs this weekend + last time out. */}
          <aside className="h-fit min-w-0 border-[1.5px] border-text bg-surface-elevated p-4">
            <div className="flex items-baseline justify-between gap-3 border-b border-text pb-1">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                {panelLabel}
              </span>
              <span className="font-mono text-[10px] tabular-nums uppercase tracking-[0.12em] text-text-faint">
                {rangeLabel(rows)}
              </span>
            </div>
            {rows.length > 0 ? (
              <ul>
                {rows.map(r => (
                  <li key={`${r.slug}-${r.href}`}>
                    <Link
                      href={r.href}
                      className="flex min-h-11 items-baseline gap-3 border-b border-border py-2 transition-colors duration-(--duration-fast) hover:bg-surface"
                    >
                      <span aria-hidden="true" className="h-3 w-[3px] shrink-0 self-center" style={{ backgroundColor: r.color }} />
                      <span className="w-[86px] shrink-0 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                        {r.seriesName}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-serif text-[16px] font-semibold text-text">
                        {r.eventName}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
                Nothing scheduled — the season list lives on the calendar.
              </p>
            )}
            <Suspense fallback={null}>
              <LastTimeOut candidates={lastCandidates} />
            </Suspense>
          </aside>
        </section>

        {/* ── Three promises, in the order a new user meets them. ── */}
        <section className="mt-14 grid gap-8 border-t border-border pt-8 md:grid-cols-3 md:gap-10">
          {[
            {
              n: '01',
              title: 'Follow only what you care about',
              body: 'Pick your championships once. Hide the rest and the whole site reorganises around yours.',
            },
            {
              n: '02',
              title: 'Know when it is on, locally',
              body: 'Every session in your own time zone, with a countdown, weather and where to watch. Subscribe to any calendar.',
            },
            {
              n: '03',
              title: 'Understand what happened',
              body: 'Race reports, lap-by-lap ledgers and 75 sourced answers — from what DRS was to how WEC points work.',
            },
          ].map(p => (
            <div key={p.n} className="border-t-2 border-text pt-3">
              <span className="font-mono text-[10px] font-semibold tabular-nums text-brand">{p.n}</span>
              <h2 className="mt-1 font-serif text-[22px] font-semibold leading-snug text-text">{p.title}</h2>
              <p className="mt-2 max-w-[40ch] text-sm leading-relaxed text-text-muted">{p.body}</p>
            </div>
          ))}
        </section>

        {/* ── The account ask, last, as a footnote. ── */}
        <div className="mt-14 flex flex-wrap items-baseline gap-x-5 gap-y-2 border-t border-text pt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]">
          <span className="text-text-faint">An account adds</span>
          <span className="text-text-muted">Followed series</span>
          <span className="text-text-muted">Pre-session alerts</span>
          <span className="text-text-muted">Prediction leagues</span>
          <Link
            href="/sign-up"
            data-heatmap-id="landing:create-account"
            className="ml-auto text-brand transition-colors duration-(--duration-fast) hover:text-text"
          >
            Create one, free →
          </Link>
        </div>
      </main>

      <LandingFooter seriesList={all.map(s => s.meta)} />
    </>
  );
}
