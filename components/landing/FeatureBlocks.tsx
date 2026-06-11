const FEATURES = [
  {
    n: '01',
    tag: 'Calendar',
    title: 'Every session, in your time zone.',
    body: 'Practice, qualifying, sprint, race — every session of every weekend, converted to your local time automatically. Date-only entries say "TBC" instead of inventing an hour.',
    vignette: 'calendar' as const,
  },
  {
    n: '02',
    tag: 'Race weekends',
    title: 'A weekend, not a list.',
    body: 'Each round gets its own page: the full timetable, race-day weather for the venue, circuit context and the news that matters for that event.',
    vignette: 'weekend' as const,
  },
  {
    n: '03',
    tag: 'News',
    title: 'No algorithm. By series.',
    body: 'A clean feed filtered by championship, not engagement. Follow the series you watch and the noise from the ones you don’t disappears.',
    vignette: 'news' as const,
  },
  {
    n: '04',
    tag: 'Notifications',
    title: 'Push when the lights go out.',
    body: 'Opt-in pings before sessions start — on your phone or desktop, even with the tab closed. Mute any series straight from the notification.',
    vignette: 'push' as const,
  },
];

// "A whole companion, not just a calendar." — numbered feature rows with
// abstracted product vignettes (plain markup, no screenshots to go stale).
export function FeatureBlocks() {
  return (
    <section id="inside" className="border-b border-border">
      <div className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-16 sm:px-6">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">
          What&apos;s inside
        </p>
        <h2 className="mt-3 font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tight text-text sm:text-5xl">
          A whole companion,
          <br />
          <span className="text-text-faint">not just a calendar.</span>
        </h2>

        <div className="mt-12 space-y-6">
          {FEATURES.map((f, i) => (
            <article
              key={f.n}
              className="grid gap-6 rounded-2xl border border-border bg-surface/60 p-6 sm:p-8 lg:grid-cols-2 lg:items-center"
            >
              <div className={i % 2 === 1 ? 'lg:order-2' : undefined}>
                <p className="flex items-baseline gap-3">
                  <span className="font-display text-2xl font-extrabold text-brand">{f.n}</span>
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-text-faint">
                    {f.tag}
                  </span>
                </p>
                <h3 className="mt-3 font-display text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
                  {f.title}
                </h3>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-text-muted">{f.body}</p>
              </div>
              <Vignette kind={f.vignette} flip={i % 2 === 1} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Vignette({ kind, flip }: { kind: 'calendar' | 'weekend' | 'news' | 'push'; flip?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-xl border border-border bg-bg p-4 ${flip ? 'lg:order-1' : ''}`}
    >
      {kind === 'calendar' && (
        <div className="space-y-2 font-mono text-xs">
          {[
            ['FRI 14:30', 'Free Practice 1', 'var(--s-f1)'],
            ['FRI 18:00', 'Free Practice 2', 'var(--s-f1)'],
            ['SAT 14:30', 'Qualifying', 'var(--s-f1)'],
            ['SUN 15:00', 'Race', 'var(--s-f1)'],
          ].map(([t, label, c]) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />
              <span className="text-text-muted">{t}</span>
              <span className="font-sans font-semibold text-text">{label}</span>
            </div>
          ))}
        </div>
      )}
      {kind === 'weekend' && (
        <div className="space-y-3">
          <div className="font-display text-xl font-extrabold uppercase text-text">
            24 Hours of Le Mans
          </div>
          <div className="flex gap-2 font-mono text-xs text-text-muted">
            <span className="rounded-md border border-border bg-surface px-2 py-1">☁️ 19° / 12°</span>
            <span className="rounded-md border border-border bg-surface px-2 py-1">Circuit de la Sarthe</span>
            <span className="rounded-md border border-brand/40 bg-brand/10 px-2 py-1 text-brand">Marquee</span>
          </div>
          <div className="h-2 rounded-full bg-surface">
            <div className="h-2 w-2/3 rounded-full bg-brand" />
          </div>
        </div>
      )}
      {kind === 'news' && (
        <div className="space-y-2 text-xs">
          {[
            ['F1', 'var(--s-f1)', 'Alpine seeks to restore Monaco podium'],
            ['WEC', 'var(--s-wec)', 'Le Mans pre-test: Toyota tops Hypercar'],
            ['MotoGP', 'var(--s-motogp)', 'One bike, less track time from 2027'],
          ].map(([tag, c, headline]) => (
            <div
              key={headline}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: c }} />
              <span className="shrink-0 font-mono uppercase text-text-faint">{tag}</span>
              <span className="truncate font-medium text-text">{headline}</span>
            </div>
          ))}
        </div>
      )}
      {kind === 'push' && (
        <div className="mx-auto max-w-xs rounded-xl border border-border bg-surface p-3 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand font-display text-sm font-extrabold text-black">
              P
            </span>
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-text">Lights out in 15 minutes</div>
              <div className="truncate text-[11px] text-text-muted">
                Canadian GP — Race · Montréal
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
