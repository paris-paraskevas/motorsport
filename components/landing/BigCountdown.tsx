'use client';

import { useEffect, useState } from 'react';

interface Parts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function partsBetween(target: Date, now: Date): Parts | null {
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return null;
  const total = Math.floor(diff / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const pad = (n: number) => n.toString().padStart(2, '0');

// Marquee-event countdown — display-type digits. Same hydration contract as
// NextRaceCountdown: SSR seconds always trail the client's first render, so
// the digit spans suppress the text mismatch and the interval takes over.
export function BigCountdown({ target, label }: { target: string; label: string }) {
  const targetDate = new Date(target);
  const [parts, setParts] = useState<Parts | null>(() => partsBetween(targetDate, new Date()));

  useEffect(() => {
    const tick = () => setParts(partsBetween(new Date(target), new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!parts) return null;

  const cells: Array<[string, string]> = [
    [String(parts.days), 'd'],
    [pad(parts.hours), 'h'],
    [pad(parts.minutes), 'm'],
    [pad(parts.seconds), 's'],
  ];

  return (
    <div aria-label={`Time until ${label}`} className="flex items-baseline gap-3 sm:gap-5">
      {cells.map(([value, unit]) => (
        <span key={unit} className="flex items-baseline gap-1">
          <span
            suppressHydrationWarning
            className="font-display text-[clamp(2.6rem,11vw,6rem)] font-extrabold tabular-nums tracking-tight text-text"
          >
            {value}
          </span>
          <span className="font-display text-[clamp(1.2rem,4vw,2.2rem)] font-bold uppercase text-text-faint">
            {unit}
          </span>
        </span>
      ))}
    </div>
  );
}
