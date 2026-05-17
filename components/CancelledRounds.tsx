import { CancelledRoundEntry } from '@/lib/types';

function formatRange(startISO: string, endISO: string): string {
  const start = new Date(startISO + 'T00:00:00Z');
  const end = new Date(endISO + 'T00:00:00Z');
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const monthShort = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const year = start.getUTCFullYear();
  if (sameMonth) {
    return `${startDay}–${endDay} ${monthShort(start)} ${year}`;
  }
  return `${startDay} ${monthShort(start)} – ${endDay} ${monthShort(end)} ${year}`;
}

export function CancelledRoundsBanner({
  cancelledRounds,
}: {
  cancelledRounds?: CancelledRoundEntry[];
}) {
  if (!cancelledRounds || cancelledRounds.length === 0) return null;
  const count = cancelledRounds.length;
  const names = cancelledRounds.map(r => r.name.replace(/ Grand Prix$/, '')).join(', ');
  return (
    <div
      role="status"
      className="mb-6 rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-200/90"
    >
      <span className="font-medium text-amber-200">
        {count} round{count > 1 ? 's' : ''} cancelled this season
      </span>
      <span className="text-amber-200/70"> — {names}.</span>
    </div>
  );
}

export function CancelledRoundsSection({
  cancelledRounds,
}: {
  cancelledRounds?: CancelledRoundEntry[];
}) {
  if (!cancelledRounds || cancelledRounds.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="text-text text-base font-semibold mb-3">
        Cancelled this season
      </h2>
      <ul className="space-y-3">
        {cancelledRounds.map(round => (
          <li
            key={`${round.originalRound}-${round.name}`}
            className="rounded-md border border-border bg-surface/40 p-4"
          >
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <div className="text-text text-sm font-medium">
                <span className="text-text-faint tnum font-mono mr-2">
                  R{round.originalRound}
                </span>
                {round.name}
              </div>
              <span className="text-[10px] uppercase tracking-wider text-amber-300/80 font-semibold">
                Cancelled
              </span>
            </div>
            <div className="text-text-faint text-xs tnum font-mono mb-2">
              Originally {formatRange(round.originalStartDate, round.originalEndDate)}
            </div>
            {round.reason && (
              <div className="text-text-muted text-xs mb-1">
                <span className="text-text-faint">Reason:</span> {round.reason}
              </div>
            )}
            {round.rescheduleStatus && (
              <div className="text-text-muted text-xs">
                <span className="text-text-faint">Reschedule:</span>{' '}
                {round.rescheduleStatus}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
