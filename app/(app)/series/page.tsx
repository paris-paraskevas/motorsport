import type { Metadata } from 'next';
import Link from 'next/link';
import { loadAllSeries } from '@/lib/series';
import { groupSeriesByCategory } from '@/lib/categories';
import { groupByWeekend } from '@/lib/group';
import { weekendLabel } from '@/lib/weekend';
import { Accordion } from '@/components/Accordion';
import { PAGE_WIDE } from '@/lib/site';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Series',
  description:
    'Every championship Paddock tracks — F1, MotoGP, WEC, Formula E, WRC, IndyCar, NASCAR, IMSA, DTM and more. Schedules, standings, results and news per series.',
  alternates: { canonical: '/series' },
};

// Day-level labels only: stable across timezones for practical purposes and
// rendered fully on the server, so this page ships zero hydration risk.
function dayLabel(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);
}

interface HubRow {
  slug: string;
  name: string;
  color: string;
  broadcaster: string | null;
  round: number | null;
  event: string;
  italic: boolean; // status rows ("Season complete", "One race a year")
  dates: string;
  isCurrent: boolean; // racing this weekend → accent dates + a band card
}

// The hub answers the two questions an expanding fan actually has — what's
// their next round, and where do I watch it (design handoff §4.5, panel 7a).
// A series with no next round states its real status instead of vanishing.
function rowFor(
  meta: { slug: string; name: string; color: string; singleEvent?: boolean; watch?: { service?: string } },
  weekends: ReturnType<typeof groupByWeekend>,
  now: Date,
): HubRow {
  const base = {
    slug: meta.slug,
    name: meta.name,
    color: meta.color,
    broadcaster: meta.watch?.service ?? null,
  };
  const next = weekends.find(w => !w.isPast && w.sessions.some(x => x.end >= now));
  if (next) {
    const first = next.sessions.reduce((m, x) => (x.start < m ? x.start : m), next.sessions[0].start);
    return {
      ...base,
      // groupByWeekend emits round < 1 for weekends it can't number — show the
      // event without a fake "R0".
      round: next.round >= 1 ? next.round : null,
      event: next.roundName ?? weekendLabel(next, next.round).title,
      italic: false,
      dates: next.dateRangeLabel,
      isCurrent: first.getTime() <= now.getTime() + 6 * 24 * 3600 * 1000,
    };
  }
  if (meta.singleEvent) {
    return { ...base, round: null, event: 'One race a year · single event', italic: true, dates: '—', isCurrent: false };
  }
  const last = weekends[weekends.length - 1];
  const lastEnd = last?.sessions.reduce((m, x) => (x.end > m ? x.end : m), last.sessions[0].end);
  return {
    ...base,
    round: null,
    event: last ? `Season complete · ${last.roundName ?? weekendLabel(last, last.round).title}` : 'Season complete',
    italic: true,
    dates: lastEnd ? `ended ${dayLabel(lastEnd)}` : '—',
    isCurrent: false,
  };
}

function RowInner({ r, compact }: { r: HubRow; compact?: boolean }) {
  return (
    <>
      <span aria-hidden="true" className="h-4 w-[3px] shrink-0 self-center" style={{ backgroundColor: r.color }} />
      {compact ? (
        <span className="min-w-0 flex-1 py-0.5">
          <span className="block truncate font-serif text-[16px] font-semibold leading-tight text-text">{r.name}</span>
          <span className={`block truncate font-mono text-[10px] uppercase tracking-[0.12em] ${r.isCurrent ? 'font-semibold text-brand' : 'text-text-faint'}`}>
            {r.round != null ? `R${r.round} · ` : ''}
            {r.event}
            {r.dates !== '—' ? ` · ${r.dates}` : ''}
          </span>
        </span>
      ) : (
        <>
          <span className="w-[220px] shrink-0 truncate font-serif text-[17px] font-semibold text-text xl:w-[274px]">
            {r.name}
          </span>
          <span className="w-10 shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-text-faint">
            {r.round != null ? `R${r.round}` : '–'}
          </span>
          <span className={`min-w-0 flex-1 truncate font-serif text-[15px] ${r.italic ? 'italic text-text-muted' : 'text-text'}`}>
            {r.event}
          </span>
          <span className={`w-[104px] shrink-0 text-right font-mono text-[11px] tabular-nums ${r.isCurrent ? 'font-semibold text-brand' : 'text-text-muted'}`}>
            {r.dates}
          </span>
          <span className="hidden w-[150px] shrink-0 truncate text-right font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted lg:block">
            {r.broadcaster ?? '—'}
          </span>
          <span aria-hidden="true" className="shrink-0 font-mono text-[11px] text-text-faint">→</span>
        </>
      )}
    </>
  );
}

export default async function SeriesHubPage() {
  const all = await loadAllSeries();
  const now = new Date();
  const season = Math.max(...all.map(s => s.meta.season));

  const rows = new Map<string, HubRow>();
  for (const s of all) {
    try {
      rows.set(s.meta.slug, rowFor(s.meta, groupByWeekend(s.sessions, now, s.rounds), now));
    } catch {
      rows.set(s.meta.slug, {
        slug: s.meta.slug,
        name: s.meta.name,
        color: s.meta.color,
        broadcaster: s.meta.watch?.service ?? null,
        round: null,
        event: '—',
        italic: true,
        dates: '—',
        isCurrent: false,
      });
    }
  }

  const groups = groupSeriesByCategory(all.map(s => s.meta));
  const racing = [...rows.values()].filter(r => r.isCurrent);
  const racingDates = racing.length > 0 ? racing[0].dates : null;

  return (
    <div className={PAGE_WIDE}>
      <div>
        <header className="mb-6">
          <h1 className="font-serif text-[40px] font-medium leading-none tracking-[-0.02em] text-text lg:text-[50px]">
            Series
          </h1>
          <p className="mt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            {all.length === 15 ? 'Fifteen' : all.length} championships · {season} season
          </p>
          {/* Stated once, instead of seventy-five times (§4.5). */}
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-text-faint">
            Every series opens with calendar · standings · results · drivers · champions
          </p>
        </header>

        {racing.length > 0 && (
          <section aria-label="Racing this weekend" className="mb-7">
            <div className="mb-2 flex items-baseline gap-3 border-b border-text pb-1">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">
                Racing this weekend
              </span>
              {racingDates && (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">{racingDates}</span>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {racing.map(r => (
                <Link
                  key={r.slug}
                  href={`/series/${r.slug}`}
                  className="flex min-h-11 items-center gap-2.5 border border-border-strong bg-surface-elevated px-3 py-2.5 transition-colors duration-(--duration-fast) hover:border-text"
                >
                  <span aria-hidden="true" className="h-4 w-[3px] shrink-0" style={{ backgroundColor: r.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-text-faint">
                      {r.name}
                      {r.round != null ? ` · R${r.round}` : ''}
                    </span>
                    <span className="block truncate font-serif text-[16px] font-semibold leading-tight text-text">
                      {r.event}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Desktop: all fifteen rows visible under their category headings —
            no accordions ("a directory that opens empty isn't a directory"). */}
        <div className="hidden md:block">
          {groups.map(group => (
            <section key={group.category.id} aria-label={group.category.label} className="mb-7">
              <div className="flex items-baseline gap-2 border-b border-text pb-1">
                <h2 className="font-serif text-[22px] font-semibold text-text">{group.category.label}</h2>
                <span className="font-mono text-[10px] tabular-nums text-text-faint">{group.series.length}</span>
              </div>
              {group.series.map(s => {
                const r = rows.get(s.slug);
                if (!r) return null;
                return (
                  <Link
                    key={s.slug}
                    href={`/series/${s.slug}`}
                    className="flex min-h-11 items-center gap-4 border-b border-border py-1.5 transition-colors duration-(--duration-fast) hover:bg-surface"
                  >
                    <RowInner r={r} />
                  </Link>
                );
              })}
            </section>
          ))}
        </div>

        {/* Mobile: the six categories are collapsible headers, first expanded (§4.5). */}
        <div className="border-t border-border md:hidden">
          {groups.map((group, gi) => (
            <Accordion
              key={group.category.id}
              title={group.category.label}
              titleClassName="font-serif tracking-tight"
              count={`${group.series.length}`}
              defaultOpen={gi === 0}
            >
              <div className="divide-y divide-border">
                {group.series.map(s => {
                  const r = rows.get(s.slug);
                  if (!r) return null;
                  return (
                    <Link key={s.slug} href={`/series/${s.slug}`} className="flex min-h-11 items-center gap-2.5 py-1.5">
                      <RowInner r={r} compact />
                    </Link>
                  );
                })}
              </div>
            </Accordion>
          ))}
        </div>

        {/* The series-contract matrix (handoff §3 / panel 12a, job ⑨/#10):
            one layout, fifteen sports — the F1 weekend is the exception, not
            the template. Data verbatim from the README's contract table. */}
        <section aria-label="One layout, fifteen sports" className="mt-12">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 border-b border-text pb-1">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              One layout, fifteen sports
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
              The F1 weekend is the exception, not the template
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-1.5 pr-4 text-left font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-text-muted">Series</th>
                  <th className="py-1.5 pr-4 text-left font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-text-muted">A round is</th>
                  <th className="py-1.5 text-left font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-text-muted">Sessions, in order</th>
                </tr>
              </thead>
              <tbody>
                {CONTRACT_MATRIX.map(row => (
                  <tr key={row[0]} className="border-b border-border">
                    <td className="py-2 pr-4 font-serif text-[15px] font-semibold text-text">{row[0]}</td>
                    <td className="py-2 pr-4 font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{row[1]}</td>
                    <td className="py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

// Handoff README §3, first three columns verbatim — the contract every results
// surface is built against. Static by design: it documents the sports' shapes,
// not this season's data.
const CONTRACT_MATRIX: Array<[string, string, string]> = [
  ['Formula 1', 'one weekend', 'FP1 · FP2 · FP3 · Q · Race'],
  ['Formula 2', 'one weekend', 'Practice · Q · Sprint · Feature'],
  ['Formula 3', 'one weekend', 'Practice · Q · Sprint · Feature'],
  ['Formula E', 'one or two E-Prix', 'FP1 · FP2 · Q duels · Race'],
  ['IndyCar', 'one race, sometimes two', 'Practice · Q · Warm-up · Race'],
  ['MotoGP', 'one weekend', 'FP1 · Practice · FP2 · Q1 · Q2 · Sprint · Race'],
  ['WorldSBK', 'one round, three races', 'FP · Superpole · Race 1 · Superpole Race · Race 2'],
  ['FIA WEC', 'one race, 6h–24h', 'FP1 · FP2 · FP3 · Hyperpole · Race'],
  ['IMSA', 'one race, 100min–24h', 'Practice · Q · Race'],
  ['GT World Challenge', 'one or two races', 'Bronze Test · FP · Pre-Q · Q · Race'],
  ['DTM', 'one weekend, two races', 'FP1 · FP2 · Q1 · Race 1 · Q2 · Race 2'],
  ['NLS Nürburgring', 'one long race', 'Qualifying · Race'],
  ['ADAC Ravenol 24h', 'one event a year', 'Qualifying · Top Qualifying · Race'],
  ['WRC', 'one rally, 3–4 days', 'Shakedown · SS1–SS20 · Power Stage'],
  ['NASCAR Cup', 'one race', 'Practice · Q · Race'],
];
