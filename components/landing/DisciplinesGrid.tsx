import Link from 'next/link';
import type { SeriesMeta } from '@/lib/types';

// Landing-specific 5-discipline grouping (the app sidebar keeps its own
// 6-category taxonomy — this is marketing copy, not navigation truth).
const DISCIPLINES: Array<{
  name: string;
  accent: string;
  description: string;
  slugs: string[];
}> = [
  {
    name: 'Formula',
    accent: 'var(--brand)',
    description: 'Single-seater open-wheel — top-tier global championships.',
    slugs: ['f1', 'f2', 'f3', 'formula-e', 'indycar'],
  },
  {
    name: 'Motorcycle',
    accent: 'var(--live)',
    description: 'Two wheels at the limit — premier-class road racing.',
    slugs: ['motogp', 'wsbk'],
  },
  {
    name: 'Endurance',
    accent: 'var(--cyan)',
    description: 'Through the night — long-distance sports-car & GT.',
    slugs: ['wec', 'imsa', 'gt-world', 'nls', 'adac-ravenol-24h'],
  },
  {
    name: 'Stock & Touring',
    accent: 'var(--acid)',
    description: 'Door-to-door tin-top racing — ovals and circuits.',
    slugs: ['nascar-cup', 'dtm'],
  },
  {
    name: 'Rally',
    accent: 'var(--plasma)',
    description: 'Stage racing across gravel, snow, asphalt — the wildest discipline.',
    slugs: ['wrc'],
  },
];

const SHORT_NAMES: Record<string, string> = {
  f1: 'F1',
  f2: 'F2',
  f3: 'F3',
  'formula-e': 'FE',
  indycar: 'INDY',
  motogp: 'MotoGP',
  wsbk: 'WSBK',
  wec: 'WEC',
  imsa: 'IMSA',
  'gt-world': 'GTWC',
  nls: 'NLS',
  'adac-ravenol-24h': '24h',
  'nascar-cup': 'NASCAR',
  dtm: 'DTM',
  wrc: 'WRC',
};

export function DisciplinesGrid({ seriesList }: { seriesList: SeriesMeta[] }) {
  const bySlug = new Map(seriesList.map(s => [s.slug, s]));

  return (
    <section id="disciplines" className="border-b border-border">
      <div className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tight text-text sm:text-5xl">
            <span className="text-text-faint">Five</span> disciplines.
            <br />
            One roof.
          </h2>
          <Link
            href="/app"
            className="rounded-full border border-border-strong px-5 py-2.5 text-xs font-bold uppercase tracking-[0.08em] text-text transition-colors duration-(--duration-fast) hover:border-brand hover:text-brand"
          >
            All {seriesList.length} series&ensp;→
          </Link>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {DISCIPLINES.map(d => (
            <div
              key={d.name}
              className="relative overflow-hidden rounded-2xl border border-border bg-surface/60 p-6"
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-[3px]"
                style={{ background: `linear-gradient(90deg, ${d.accent} 0%, transparent 70%)` }}
              />
              <p
                className="font-display text-xl font-extrabold"
                style={{ color: d.accent }}
              >
                {String(d.slugs.length).padStart(2, '0')}
              </p>
              <h3 className="mt-2 font-display text-3xl font-extrabold uppercase tracking-tight text-text">
                {d.name}
              </h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-muted">{d.description}</p>
              <ul className="mt-6 flex flex-wrap gap-2">
                {d.slugs.map(slug => {
                  const s = bySlug.get(slug);
                  if (!s) return null;
                  return (
                    <li key={slug}>
                      <Link
                        href={`/series/${slug}`}
                        className="flex items-center gap-2 rounded-full border border-border bg-bg px-3.5 py-1.5 text-xs font-bold text-text transition-colors duration-(--duration-fast) hover:border-(--chip)"
                        style={{ '--chip': s.color } as React.CSSProperties}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: s.color }}
                          aria-hidden="true"
                        />
                        {SHORT_NAMES[slug] ?? s.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
