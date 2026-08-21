'use client';

import { useEffect, useState } from 'react';

interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function partsBetween(target: Date, now: Date): CountdownParts | null {
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return null;
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function getTargetDate(target: string): Date {
  return new Date(target);
}

export function NextRaceCountdown({
  target,
  label,
  color,
  liveUntil,
}: {
  target: string;
  label: string;
  color?: string;
  /** Session end, ISO. Given it, the countdown becomes a LIVE pill between
   *  `target` and this instead of vanishing at zero. Liveness is decided HERE,
   *  on the client tick, never on the server: /app is `revalidate = 300`, so a
   *  server-baked isLive is up to five minutes stale in both directions — the
   *  documented /calendar "LIVE and past at once" bug
   *  (docs/research/code-audit-2026-06.md:528, components/SessionCard.tsx:22). */
  liveUntil?: string;
}) {
  const [parts, setParts] = useState<CountdownParts | null>(() =>
    partsBetween(getTargetDate(target), new Date()),
  );
  const [live, setLive] = useState(false);

  useEffect(() => {
    const targetDate = getTargetDate(target);
    const endDate = liveUntil ? new Date(liveUntil) : null;
    const valid = endDate && !Number.isNaN(endDate.getTime());
    const tick = () => {
      const now = new Date();
      setParts(partsBetween(targetDate, now));
      setLive(Boolean(valid && now >= targetDate && now <= endDate));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target, liveUntil]);

  // Running: the flashing pill, same tokens and animation as the session rail's
  // badge (components/SessionCard.tsx) so "live" looks identical site-wide.
  if (live) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-live/15 px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-live-pill"
        aria-label={`${label} is live now`}
      >
        <span aria-hidden="true" className="live-pulse h-2 w-2 rounded-full bg-live" />
        Live now
      </span>
    );
  }

  if (!parts) return null;

  return (
    <div
      className="inline-flex flex-col items-start gap-0.5 border-l-2 pl-3"
      style={color ? { borderColor: color } : undefined}
      aria-label={`Time until ${label}`}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] font-semibold text-text-faint">
        {label}
      </span>
      {/* suppressHydrationWarning: the server renders wall-clock seconds that
          are always a beat behind the client's first render. Without it React
          throws #418 and runs a full hydration-recovery re-render — which
          also wiped the pre-hydration data-theme attribute off <html>. The
          text patches silently; the interval takes over immediately after. */}
      <span
        className="font-mono tabular-nums text-lg md:text-xl font-bold text-text tracking-tight leading-none"
        suppressHydrationWarning
      >
        {parts.days > 0
          ? `${parts.days}d ${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`
          : `${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`}
      </span>
    </div>
  );
}
