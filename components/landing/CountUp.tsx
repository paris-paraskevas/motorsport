'use client';

import { useEffect, useRef, useState } from 'react';

// Counts from 0 to `value` when scrolled into view. Renders the final value
// for SSR/no-JS/reduced-motion so the number is always real content.
export function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const observer = new IntersectionObserver(
      entries => {
        if (!entries.some(e => e.isIntersecting) || started.current) return;
        started.current = true;
        const duration = 900;
        const t0 = performance.now();
        const frame = (t: number) => {
          const p = Math.min(1, (t - t0) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setDisplay(Math.round(value * eased));
          if (p < 1) requestAnimationFrame(frame);
        };
        setDisplay(0);
        requestAnimationFrame(frame);
        observer.disconnect();
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <span ref={ref} suppressHydrationWarning>
      {display.toLocaleString('en-GB')}
      {suffix}
    </span>
  );
}
