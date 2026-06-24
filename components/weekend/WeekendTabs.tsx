'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { WeekendBetting } from './WeekendBetting';
import { WeekendNewsClient } from './WeekendNewsClient';
import { WeekendStandingsClient } from './WeekendStandingsClient';

// Tabbed weekend content. Schedule (+ weather) is server-rendered and passed in
// as `scheduleSlot`, so it paints with the page. Schedule also carries the
// per-session result links (cheap, server data) and a LAZY "standings at this
// round" disclosure — the one heavy fetch, kept behind a click so the default
// view stays fast (the 0.61.0 speed-up). Bets / News mount only when their tab
// is first opened, then stay mounted (hidden) so re-selecting doesn't refetch.
type TabKey = 'schedule' | 'bets' | 'news';

export function WeekendTabs({
  scheduleSlot,
  slug,
  round,
  isPast,
  showBets,
  showNews,
}: {
  scheduleSlot: ReactNode;
  slug: string;
  round: number;
  isPast: boolean;
  showBets: boolean;
  showNews: boolean;
}) {
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'schedule', label: 'Schedule' },
    ...(showBets ? [{ key: 'bets' as const, label: 'Bets' }] : []),
    ...(showNews ? [{ key: 'news' as const, label: 'News' }] : []),
  ];

  const [active, setActive] = useState<TabKey>('schedule');
  const [seen, setSeen] = useState<Set<TabKey>>(() => new Set<TabKey>(['schedule']));
  const [showStandings, setShowStandings] = useState(false);
  const open = (k: TabKey) => {
    setActive(k);
    setSeen(s => (s.has(k) ? s : new Set(s).add(k)));
  };

  // Deep-link to a tab via ?tab= (e.g. /play "Bet on the weekend page" links to
  // ?tab=bets). Read client-side from window — NOT useSearchParams — so the
  // weekend page stays statically rendered / ISR.
  useEffect(() => {
    // One-time deep-link from the URL on mount (e.g. /play → ?tab=bets). Can't use
    // useSearchParams (would deopt this ISR page to dynamic) or a useState lazy
    // initializer (SSR has no window → hydration mismatch), so it's a single
    // post-mount setState — intentional, runs once.
    const t = new URLSearchParams(window.location.search).get('tab');
    if ((t === 'bets' && showBets) || (t === 'news' && showNews)) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setActive(t);
      setSeen(s => new Set(s).add(t as TabKey));
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      <div hidden={active !== 'schedule'} className="space-y-8">
        {scheduleSlot}
        <div>
          <button
            type="button"
            onClick={() => setShowStandings(v => !v)}
            aria-expanded={showStandings}
            className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
          >
            {showStandings ? 'Hide standings' : 'Standings at this round →'}
          </button>
          {showStandings && (
            <div className="mt-4">
              <WeekendStandingsClient slug={slug} round={round} isPast={isPast} />
            </div>
          )}
        </div>
      </div>

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
    </section>
  );
}
