'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Session } from '@/lib/types';
import { getFollowedSeries } from '@/lib/follow';
import { groupByDay } from '@/lib/group';
import { NextSessionCard } from './NextSessionCard';
import { SessionCard } from './SessionCard';
import { DayHeader } from './DayHeader';

interface HomeItem {
  session: Session;
  color: string;
  seriesName: string;
  seriesSlug: string;
}

const UPCOMING_LIMIT = 24;

export function HomeContent({ items }: { items: HomeItem[] }) {
  const [followed, setFollowed] = useState<string[] | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFollowed(getFollowedSeries());
    setHydrated(true);
  }, []);

  const filtered =
    hydrated && followed !== null
      ? items.filter(i => followed.includes(i.seriesSlug))
      : items;

  const hero = filtered[0];
  const remaining = filtered.slice(1, 1 + UPCOMING_LIMIT);

  const colorByUid: Record<string, string> = {};
  remaining.forEach(i => {
    colorByUid[i.session.uid] = i.color;
  });
  const byDay = groupByDay(remaining.map(i => i.session));

  const isEmptyFromFilter =
    hydrated && followed !== null && followed.length < items.length;

  return (
    <>
      {hero ? (
        <NextSessionCard
          session={hero.session}
          color={hero.color}
          seriesName={hero.seriesName}
          seriesSlug={hero.seriesSlug}
        />
      ) : (
        <div className="mb-8 p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-500 text-sm">
          {isEmptyFromFilter ? (
            <>
              No upcoming sessions in your followed series.{' '}
              <Link
                href="/settings"
                className="text-zinc-300 underline underline-offset-2 hover:text-zinc-100"
              >
                Manage
              </Link>
              .
            </>
          ) : (
            'Nothing scheduled yet.'
          )}
        </div>
      )}

      <section>
        <h2 className="text-xs uppercase tracking-[0.14em] text-zinc-500 font-semibold mb-3">
          Upcoming
        </h2>
        {byDay.length === 0 ? (
          <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-8 text-center">
            <div className="text-zinc-300 text-base font-medium mb-1">
              Nothing scheduled
            </div>
            <div className="text-zinc-500 text-sm">
              {isEmptyFromFilter ? (
                <>
                  No upcoming sessions in your followed series.{' '}
                  <Link
                    href="/settings"
                    className="text-zinc-300 underline underline-offset-2 hover:text-zinc-100"
                  >
                    Manage
                  </Link>
                  .
                </>
              ) : (
                'Nothing in the next window across the configured series.'
              )}
            </div>
          </div>
        ) : (
          byDay.map(day => (
            <div key={day.label} className="mb-3">
              <DayHeader label={day.label} count={day.sessions.length} />
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {day.sessions.map(s => (
                  <SessionCard
                    key={`${s.seriesSlug}-${s.uid}`}
                    session={s}
                    color={colorByUid[s.uid]}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </>
  );
}
