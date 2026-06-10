'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import circuitsFile from '@/content/landing/circuits.json';

interface CircuitPhoto {
  img: string;
  label: string;
  caption: string;
  color: string;
  seriesSlug: string;
  artist: string;
  license: string;
  sourceUrl: string;
}

const SLIDES = circuitsFile.circuits as CircuitPhoto[];
const INTERVAL_MS = 5000;

// The mockup's hero photo card, made real: famous circuits crossfading as
// background with the caption in the foreground. Sits in the hero, so the
// photography is the first thing a visitor sees. Auto-advance pauses under
// prefers-reduced-motion (first slide stays); per-slide Commons credit chip
// keeps the CC attribution visible.
export function CircuitSlideshow() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setIndex(i => (i + 1) % SLIDES.length), INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const active = SLIDES[index];

  return (
    <div className="relative h-72 overflow-hidden rounded-2xl border border-border sm:h-80">
      {SLIDES.map((s, i) => (
        <Image
          key={s.img}
          src={s.img}
          alt={i === index ? `${s.label} — ${s.caption}` : ''}
          fill
          priority={i === 0}
          sizes="(max-width: 1024px) 100vw, 480px"
          className={`object-cover transition-opacity duration-700 ease-out ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/10"
      />

      <div className="absolute inset-x-0 bottom-0 p-5">
        <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: active.color }}
            aria-hidden="true"
          />
          {active.label}
        </p>
        <p className="mt-1 font-display text-2xl font-extrabold uppercase leading-none tracking-tight text-white">
          {active.caption}
        </p>
      </div>

      {/* Commons attribution for the visible slide. */}
      <a
        href={active.sourceUrl}
        rel="license noopener"
        className="absolute right-3 top-3 rounded-md bg-black/55 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-white/70 backdrop-blur-sm hover:text-white"
      >
        © {active.artist} · {active.license}
      </a>

      <div className="absolute bottom-3 right-4 flex gap-1.5" role="tablist" aria-label="Circuit photos">
        {SLIDES.map((s, i) => (
          <button
            key={s.img}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={s.label}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all duration-(--duration-base) ${
              i === index ? 'w-5 bg-brand' : 'w-1.5 bg-white/40 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
