import Image from 'next/image';
import Link from 'next/link';
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

const CIRCUITS = circuitsFile.circuits as CircuitPhoto[];

// "From every paddock" — famous venues as a slow photo marquee. The track is
// duplicated for a seamless loop (copy is aria-hidden); reduced-motion gets a
// static scrollable row. Photos are Wikimedia Commons; credits render below.
export function CircuitFeed() {
  const track = (hidden: boolean) => (
    <div aria-hidden={hidden || undefined} className="flex shrink-0 gap-4 pr-4">
      {CIRCUITS.map(c => (
        <Link
          key={`${hidden ? 'b' : 'a'}-${c.img}`}
          href={`/series/${c.seriesSlug}`}
          tabIndex={hidden ? -1 : undefined}
          className="group relative block h-56 w-[320px] shrink-0 overflow-hidden rounded-2xl border border-border sm:h-64 sm:w-[420px]"
        >
          <Image
            src={c.img}
            alt={`${c.label} — ${c.caption}`}
            fill
            sizes="(max-width: 640px) 320px, 420px"
            className="object-cover transition-transform duration-(--duration-slow) group-hover:scale-[1.03]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent"
          />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: c.color }}
                aria-hidden="true"
              />
              {c.label}
            </p>
            <p className="mt-1 font-display text-lg font-extrabold uppercase leading-tight tracking-tight text-white">
              {c.caption}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );

  return (
    <section aria-label="From every paddock" className="overflow-hidden border-b border-border py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">
          From every paddock
        </p>
        <h2 className="mt-3 font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tight text-text sm:text-5xl">
          The whole season, <span className="text-text-faint">in one feed.</span>
        </h2>
      </div>

      <div className="mt-10 motion-safe:overflow-hidden motion-reduce:overflow-x-auto">
        <div
          className="flex w-max motion-safe:p2-marquee"
          style={{ '--p2-marquee-duration': '55s' } as React.CSSProperties}
        >
          {track(false)}
          {track(true)}
        </div>
      </div>

      <p className="mx-auto mt-6 max-w-6xl px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint sm:px-6">
        Photography via Wikimedia Commons —{' '}
        {CIRCUITS.map((c, i) => (
          <span key={c.img}>
            {i > 0 && ' · '}
            <a
              href={c.sourceUrl}
              rel="license noopener"
              className="underline decoration-border underline-offset-2 hover:text-text-muted"
            >
              {c.artist} ({c.license})
            </a>
          </span>
        ))}
      </p>
    </section>
  );
}
