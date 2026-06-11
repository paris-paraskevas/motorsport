import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { loadSeries } from '@/lib/series';
import type { Weekend } from '@/lib/types';
import { formatLocal } from '@/lib/date';
import {
  sessionBySlug,
  sessionSlug,
  weekendFor,
  weekendLabel,
  weekendStartEnd,
} from '@/lib/weekend';
import {
  fetchOpenF1WeekendSessions,
  fetchSessionClassification,
  type OpenF1Session,
  type SessionClassification,
} from '@/lib/results/openf1';
import { withSocialMeta } from '@/lib/seo';

export const dynamic = 'force-dynamic';

function parseRound(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

// Match our curated session to its OpenF1 twin: slugified name first, then
// nearest start time within 3h — names drift ("Sprint Qualifying" vs
// "Sprint Shootout" eras), start times don't.
function matchOpenF1Session(
  candidates: OpenF1Session[],
  slug: string,
  start: Date,
): OpenF1Session | null {
  const byName = candidates.find(s => sessionSlug(s.session_name) === slug);
  if (byName) return byName;
  let best: OpenF1Session | null = null;
  let bestDelta = 3 * 3600 * 1000;
  for (const s of candidates) {
    const delta = Math.abs(new Date(s.date_start).getTime() - start.getTime());
    if (delta < bestDelta) {
      bestDelta = delta;
      best = s;
    }
  }
  return best;
}

async function resolve(params: Promise<{ slug: string; round: string; session: string }>) {
  const { slug, round: roundRaw, session: sessionParam } = await params;
  const round = parseRound(roundRaw);
  if (!round) return null;
  let series;
  try {
    series = await loadSeries(slug);
  } catch {
    return null;
  }
  const weekend = weekendFor(series, round);
  if (!weekend) return null;
  const session = sessionBySlug(weekend, sessionParam);
  if (!session) return null;
  return { series, weekend, session, round, slug, sessionParam };
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string; round: string; session: string }> },
): Promise<Metadata> {
  const ctx = await resolve(params);
  if (!ctx) return { title: 'Session not found' };
  const { title: weekendTitle } = weekendLabel(ctx.weekend, ctx.round);
  const base = `${ctx.series.meta.name} · ${weekendTitle} · ${ctx.session.title.replace(/^.*?-\s*/, '')}`;
  const title = base.length > 60 ? `${base.slice(0, 59)}…` : base;
  const description = `${ctx.session.title} at the ${ctx.series.meta.name} ${weekendTitle} — session time in your time zone${ctx.slug === 'f1' ? ', full classification and results' : ''}.`;
  const path = `/series/${ctx.slug}/weekend/${ctx.round}/${ctx.sessionParam}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    ...withSocialMeta({ title, description, path }),
  };
}

// Compact label for the session rail — fans think in FP1 / QUALI / RACE.
function shortSessionLabel(title: string): string {
  const cleaned = title.replace(/^.*?[-–—:]\s*/, '').trim() || title;
  const m = cleaned.match(/^(?:free\s+)?practice\s*(\d)/i);
  if (m) return `FP${m[1]}`;
  if (/^fp\s*(\d)/i.test(cleaned)) return cleaned.toUpperCase().replace(/\s+/g, '');
  if (/sprint\s+(qualifying|shootout)/i.test(cleaned)) return 'SQ';
  if (/^sprint/i.test(cleaned)) return 'SPRINT';
  if (/qualifying|superpole/i.test(cleaned)) return 'QUALI';
  if (/warm[\s-]?up/i.test(cleaned)) return 'WARM-UP';
  if (/^race\s*(\d)/i.test(cleaned)) return cleaned.toUpperCase().replace(/\s+/g, ' ');
  if (/^race/i.test(cleaned)) return 'RACE';
  return cleaned.toUpperCase().slice(0, 14);
}

// The weekend's sessions in running order, each with its page href. Slug
// collisions within a weekend (two identically-titled sessions) resolve to
// the first occurrence — acceptable; titles are unique in practice.
function weekendSessionNav(
  weekend: Weekend,
  slug: string,
  round: number,
  currentUid: string,
) {
  const ordered = [...weekend.sessions].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  const items = ordered.map(s => ({
    uid: s.uid,
    label: shortSessionLabel(s.title),
    title: s.title,
    href: `/series/${slug}/weekend/${round}/${sessionSlug(s.title)}`,
    isCurrent: s.uid === currentUid,
  }));
  const idx = items.findIndex(i => i.isCurrent);
  return {
    items,
    prev: idx > 0 ? items[idx - 1] : null,
    next: idx >= 0 && idx < items.length - 1 ? items[idx + 1] : null,
  };
}

function SessionRail({ items }: { items: ReturnType<typeof weekendSessionNav>['items'] }) {
  return (
    <nav aria-label="Weekend sessions" className="mb-6 border-y border-border">
      <div className="flex overflow-x-auto scrollbar-none gap-5">
        {items.map(item => (
          <Link
            key={item.uid}
            href={item.href}
            aria-current={item.isCurrent ? 'page' : undefined}
            title={item.title}
            className={`shrink-0 inline-flex items-center h-10 border-b-2 px-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] whitespace-nowrap transition-colors duration-(--duration-fast) ${
              item.isCurrent
                ? 'border-tint text-text'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function SessionPager({
  prev,
  next,
}: {
  prev: { href: string; label: string } | null;
  next: { href: string; label: string } | null;
}) {
  if (!prev && !next) return null;
  return (
    <div className="mt-8 flex items-center justify-between font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">
      {prev ? (
        <Link
          href={prev.href}
          className="inline-flex items-center gap-1.5 text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
        >
          <span aria-hidden>&larr;</span> {prev.label}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={next.href}
          className="inline-flex items-center gap-1.5 text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
        >
          {next.label} <span aria-hidden>&rarr;</span>
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}

function ClassificationTable({ data }: { data: SessionClassification }) {
  return (
    <section className="border-y border-border py-4">
      <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
        Classification
      </h2>
      <ul className="divide-y divide-border/60">
        {data.entries.map(e => (
          <li key={`${e.position}-${e.driverName}`} className="flex items-baseline gap-3 py-2">
            <span className="w-6 text-text-faint text-sm font-mono tabular-nums text-right">
              {e.position ?? '–'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-text text-sm font-medium truncate">{e.driverName}</span>
                {e.driverCode ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] font-semibold text-text-faint border border-border px-1.5 py-0.5">
                    {e.driverCode}
                  </span>
                ) : null}
              </div>
              <div className="text-text-muted text-xs truncate">{e.team}</div>
            </div>
            {data.isQualifying ? (
              <span className="hidden sm:flex items-baseline gap-3 font-mono text-[11px] tabular-nums text-text-muted">
                <span className="w-20 text-right">{e.q1 ?? ''}</span>
                <span className="w-20 text-right">{e.q2 ?? ''}</span>
                <span className="w-20 text-right text-text">{e.q3 ?? ''}</span>
              </span>
            ) : null}
            <span className={`font-mono text-[11px] tabular-nums text-right w-24 truncate ${data.isQualifying ? 'sm:hidden text-text' : 'text-text-muted'}`}>
              {e.status ?? (e.position === 1 ? e.time : e.gap || e.time) ?? ''}
            </span>
            {data.isRace ? (
              <span className="text-text text-sm font-mono tabular-nums text-right w-10">
                {e.points ?? 0}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {data.isQualifying ? (
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint sm:text-right">
          <span className="hidden sm:inline">Columns: Q1 · Q2 · Q3</span>
          <span className="sm:hidden">Best qualifying lap shown</span>
        </div>
      ) : null}
    </section>
  );
}

export default async function SessionPage({
  params,
}: {
  params: Promise<{ slug: string; round: string; session: string }>;
}) {
  const ctx = await resolve(params);
  if (!ctx) notFound();
  const { series, weekend, session, round, slug } = ctx;

  const now = new Date();
  const isLive = !session.dateOnly && session.start <= now && now <= session.end;
  const isPast = !isLive && session.end < now;
  const color = series.meta.color;
  const { title: weekendTitle } = weekendLabel(weekend, round);
  const sessionName = session.title.replace(/^.*?[-–—:]\s*/, '').trim() || session.title;

  // Classification: F1 only in v1 — OpenF1 covers every session type.
  // Other series gain race-session adapters next (results-by-round).
  let classification: SessionClassification | null = null;
  if (slug === 'f1' && isPast) {
    const { start, end } = weekendStartEnd(weekend);
    const candidates = await fetchOpenF1WeekendSessions(start, end);
    const match = session.dateOnly
      ? null
      : matchOpenF1Session(candidates, sessionSlug(session.title), session.start);
    if (match) classification = await fetchSessionClassification(match);
  }

  const nav = weekendSessionNav(weekend, slug, round, session.uid);

  return (
    <div
      className="relative max-w-2xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl mx-auto p-4 md:p-6 lg:p-8 pb-16"
      style={{ '--tint': color, ['--series-color' as string]: color } as React.CSSProperties}
    >
      <div
        className="absolute top-0 left-0 right-0 h-px -z-10"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />

      <section className="mb-8 border-y border-border py-5 md:py-6">
        <div className="flex items-center gap-2.5 mb-3 flex-wrap font-mono text-[11px] uppercase tracking-[0.18em] font-semibold">
          <Link
            href={`/series/${slug}`}
            className="text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
          >
            {series.meta.name}
          </Link>
          <span className="text-border-strong">·</span>
          <Link
            href={`/series/${slug}/weekend/${round}`}
            className="text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
          >
            {weekendTitle}
          </Link>
          <span className="text-border-strong">·</span>
          <span className="tabular-nums text-tint">Round {round}</span>
          {isLive && (
            <>
              <span className="text-border-strong">·</span>
              <span className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.14em] px-2 py-0.5 bg-red-500/15 text-red-300">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 live-pulse" />
                live
              </span>
            </>
          )}
        </div>

        <h1 className="font-display text-4xl md:text-5xl font-extrabold uppercase tracking-wide leading-[0.95] text-text">
          {sessionName}
          <span style={{ color }}>.</span>
        </h1>

        <div className="mt-4 flex items-baseline gap-4 flex-wrap">
          {session.dateOnly ? (
            <span className="text-lg md:text-xl font-semibold text-text tnum font-mono">TBC</span>
          ) : (
            <time
              dateTime={session.start.toISOString()}
              className="text-lg md:text-xl font-semibold text-text tnum font-mono"
            >
              {formatLocal(session.start)}
            </time>
          )}
          {session.location && (
            <span className="text-sm text-text-faint">{session.location}</span>
          )}
        </div>
      </section>

      <SessionRail items={nav.items} />

      {classification ? (
        <ClassificationTable data={classification} />
      ) : isPast ? (
        <section className="border-y border-border py-5 text-center">
          <p className="text-text-muted text-sm">
            {slug === 'f1'
              ? 'Classification not available for this session yet.'
              : 'Per-session classification is coming to this series — race results live on the series page.'}
          </p>
          <Link
            href={`/series/${slug}?tab=results`}
            className="mt-3 inline-block font-mono text-[11px] uppercase tracking-[0.16em] font-semibold text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
          >
            Season results →
          </Link>
        </section>
      ) : (
        <section className="border-y border-border py-5 text-center">
          <p className="text-text-muted text-sm">
            Classification appears here once the session has run.
          </p>
        </section>
      )}

      <SessionPager prev={nav.prev} next={nav.next} />
    </div>
  );
}
