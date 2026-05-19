import type { Weekend, Session } from '@/lib/types';
import { groupByDay } from '@/lib/group';
import { formatLocal } from '@/lib/date';

export function WeekendSchedule({
  weekend,
  color,
}: {
  weekend: Weekend;
  color: string;
}) {
  const now = new Date();
  const byDay = groupByDay(weekend.sessions);

  return (
    <section className="mb-8">
      <h2 className="text-xs uppercase tracking-wider text-text-faint mb-3 font-semibold">Schedule</h2>
      <div className="rounded-2xl bg-surface/40 border border-border/60 overflow-hidden">
        {byDay.map((day, dayIdx) => (
          <div key={day.label} className={dayIdx > 0 ? 'border-t border-border/60' : undefined}>
            <div className="px-4 pt-3 pb-2 text-[11px] uppercase tracking-[0.14em] text-text-faint font-semibold">
              {day.label}
            </div>
            <ul>
              {day.sessions.map((s: Session) => {
                const isLive = !s.dateOnly && s.start <= now && now <= s.end;
                const isPast = !isLive && s.end < now;
                return (
                  <li
                    key={s.uid}
                    className={`flex items-center gap-3 px-4 py-2.5 border-t border-border/40 ${
                      isPast ? 'opacity-50' : ''
                    }`}
                  >
                    <span
                      className="w-[3px] self-stretch rounded-full shrink-0"
                      style={{ backgroundColor: color, opacity: isPast ? 0.4 : 0.8 }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="text-text text-sm font-medium truncate">
                          {s.title}
                        </span>
                        {isLive && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 live-pulse" />
                            live
                          </span>
                        )}
                        {s.significance && s.significance.tier !== 'note' && (
                          <span className="text-[10px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-semibold">
                            {s.significance.tier}
                          </span>
                        )}
                      </div>
                      {s.significance?.note && (
                        <div className="text-xs text-amber-200/70 mt-0.5">{s.significance.note}</div>
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
                        {formatLocal(s.start)}
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
