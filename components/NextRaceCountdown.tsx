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

export function NextRaceCountdown({
  target,
  label,
  color,
}: {
  target: string;
  label: string;
  color?: string;
}) {
  const targetDate = new Date(target);
  const [parts, setParts] = useState<CountdownParts | null>(() =>
    partsBetween(targetDate, new Date()),
  );

  useEffect(() => {
    const tick = () => setParts(partsBetween(targetDate, new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!parts) return null;

  return (
    <div
      className="inline-flex items-center gap-3 rounded-full border border-border/60 bg-surface/40 px-3 py-1.5"
      aria-label={`Time until ${label}`}
    >
      <span
        className="text-[10px] uppercase tracking-[0.16em] font-semibold text-text-faint"
      >
        {label}
      </span>
      {/* suppressHydrationWarning: the server renders wall-clock seconds that
          are always a beat behind the client's first render. Without it React
          throws #418 and runs a full hydration-recovery re-render — which
          also wiped the pre-hydration data-theme attribute off <html>. The
          text patches silently; the interval takes over immediately after. */}
      <span
        className="font-mono tabular-nums text-sm text-text tracking-tight"
        style={color ? { color } : undefined}
        suppressHydrationWarning
      >
        {parts.days}d {pad(parts.hours)}h {pad(parts.minutes)}m {pad(parts.seconds)}s
      </span>
    </div>
  );
}
