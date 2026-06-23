'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { WeekendBetting } from './WeekendBetting';
import { WeekendNewsClient } from './WeekendNewsClient';
import { WeekendStandingsClient } from './WeekendStandingsClient';

// Tabbed weekend content. Schedule (+ weather) is server-rendered and passed in
// as `scheduleSlot`, so it paints with the page — cheap (no upstream fetch).
// Bets / News / Sessions mount only when their tab is FIRST opened (then stay
// mounted, hidden, so re-selecting doesn't refetch). Each fetches its own data
// client-side, so the weekend page render no longer loads any of it. That's the
// speed-up: a cold weekend page does only the schedule + weather, not the
// season-results fan-out, the news feed, or the betting markets.
interface SessionLink {
  title: string;
  href: string | null;
}
type TabKey = 'schedule' | 'bets' | 'news' | 'sessions';

export function WeekendTabs({
  scheduleSlot,
  slug,
  round,
  isPast,
  showBets,
  showNews,
  sessionLinks,
}: {
  scheduleSlot: ReactNode;
  slug: string;
  round: number;
  isPast: boolean;
  showBets: boolean;
  showNews: boolean;
  sessionLinks: SessionLink[];
}) {
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'schedule', label: 'Schedule' },
    ...(showBets ? [{ key: 'bets' as const, label: 'Bets' }] : []),
    ...(showNews ? [{ key: 'news' as const, label: 'News' }] : []),
    { key: 'sessions', label: 'Sessions' },
  ];

  const [active, setActive] = useState<TabKey>('schedule');
  const [seen, setSeen] = useState<Set<TabKey>>(() => new Set<TabKey>(['schedule']));
  const open = (k: TabKey) => {
    setActive(k);
    setSeen(s => (s.has(k) ? s : new Set(s).add(k)));
  };

  return (
    <section>
      <nav
        aria-label="Weekend sections"
        className="mb-5 flex gap-5 border-b border-border font-mono text-[11px] uppercase tracking-[0.16em]"
      >
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => open(t.key)}
            aria-current={active === t.key ? 'page' : undefined}
            className={`-mb-px border-b-2 pb-2 transition-colors duration-(--duration-fast) ${
              active === t.key ? 'border-brand text-text' : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Schedule: server-rendered, always present (cheap), just toggled. */}
      <div hidden={active !== 'schedule'}>{scheduleSlot}</div>

      {showBets && seen.has('bets') && (
        <div hidden={active !== 'bets'}>
          <WeekendBetting seriesSlug={slug} round={round} isPast={isPast} />
        </div>
      )}

      {showNews && seen.has('news') && (
        <div hidden={active !== 'news'}>
          <WeekendNewsClient slug={slug} round={round} />
        </div>
      )}

      {seen.has('sessions') && (
        <div hidden={active !== 'sessions'} className="space-y-8">
          {sessionLinks.length > 0 && (
            <div>
              <h3 className="mb-3 font-display text-sm font-extrabold uppercase tracking-wide text-text">Sessions</h3>
              <ul className="divide-y divide-border/60">
                {sessionLinks.map((s, i) => (
                  <li key={`${i}-${s.title}`} className="py-2.5">
                    {s.href ? (
                      <Link
                        href={s.href}
                        className="group/sess inline-flex items-center gap-1 text-sm font-medium text-text transition-colors duration-(--duration-fast) hover:text-tint"
                      >
                        {s.title}
                        <ArrowUpRight size={12} aria-hidden className="text-text-faint group-hover/sess:text-tint" />
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-text">{s.title}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <WeekendStandingsClient slug={slug} round={round} isPast={isPast} />
        </div>
      )}
    </section>
  );
}
