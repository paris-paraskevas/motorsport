import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { Weekend, Session } from '@/lib/types';
import { groupByDay } from '@/lib/group';
import { LocalTime } from '@/components/LocalTime';
import { sessionSlug } from '@/lib/weekend';

export function WeekendSchedule({
  weekend,
  color,
  sessionLinkBase,
}: {
  weekend: Weekend;
  color: string;
  // When set, each session row links to its page under
  // `${sessionLinkBase}/<session-slug>` (W1c — F1 first).
  sessionLinkBase?: string;
}) {
  const now = new Date();
  const byDay = groupByDay(weekend.sessions);

  return (
    <section className="mb-8 border-y border-border py-4">
      <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
        Schedule
      </h2>
      <div>
        {byDay.map((day, dayIdx) => (
          <div key={day.label} className={dayIdx > 0 ? 'border-t border-border/60' : undefined}>
            <div className="pt-3 pb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-text-faint font-semibold">
              {day.label}
            </div>
            <ul>
              {day.sessions.map((s: Session) => {
                const isLive = !s.dateOnly && s.start <= now && now <= s.end;
                const isPast = !isLive && s.end < now;
                return (
                  <li
                    key={s.uid}
                    className={`flex items-center gap-3 py-2.5 border-t border-border/40 ${
                      isPast ? 'opacity-50' : ''
                    }`}
                  >
                    <span
                      className="w-[3px] self-stretch shrink-0"
                      style={{ backgroundColor: color, opacity: isPast ? 0.4 : 0.8 }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        {sessionLinkBase ? (
                          <Link
                            href={`${sessionLinkBase}/${sessionSlug(s.title)}`}
                            className="group/sess inline-flex items-center gap-1 min-w-0"
                          >
                            <span className="text-text text-sm font-medium truncate group-hover/sess:text-tint underline-offset-4 group-hover/sess:underline transition-colors duration-(--duration-fast)">
                              {s.title}
                            </span>
                            <ArrowUpRight size={12} aria-hidden className="shrink-0 text-text-faint group-hover/sess:text-tint transition-colors duration-(--duration-fast)" />
                          </Link>
                        ) : (
                          <span className="text-text text-sm font-medium truncate">
                            {s.title}
                          </span>
                        )}
                        {isLive && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 live-pulse" />
                            live
                          </span>
                        )}
                        {s.significance && s.significance.tier !== 'note' && (
                          <span className="text-[10px] uppercase tracking-[0.12em] px-1.5 py-0.5 border border-brand/40 text-brand font-semibold font-mono">
                            {s.significance.tier}
                          </span>
                        )}
                      </div>
                      {s.significance?.note && (
                        <div className="text-xs text-brand/70 mt-0.5">{s.significance.note}</div>
                      )}
                    </div>
                    {s.dateOnly ? (
                      <span className="text-text-muted text-sm font-medium tabular-nums font-mono whitespace-nowrap">
                        TBC
                      </span>
                    ) : (
                      <time
                        dateTime={s.start.toISOString()}
                        className="text-text-muted text-sm font-medium tabular-nums font-mono whitespace-nowrap"
                      >
                        <LocalTime instant={s.start.getTime()} />
                      </time>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
