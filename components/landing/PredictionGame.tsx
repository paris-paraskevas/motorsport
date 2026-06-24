import Link from 'next/link';

const MARKETS = [
  {
    tag: 'Solo or leagues',
    title: 'Back the grid, free.',
    body: 'Claim fresh virtual credits every month and predict who wins, who makes the podium, who lands in the top ten. Play solo against the house, or start a private league with your mates.',
    vignette: 'odds' as const,
  },
  {
    tag: 'Friend leagues',
    title: 'Bragging rights, settled.',
    body: 'Spin up a private league, share a join link, and let the win-rate leaderboard do the talking. Every month the sharpest callers take 🥇🥈🥉 honours — then the table resets and it starts again.',
    vignette: 'leaderboard' as const,
  },
];

// "Predict the grid" — markets the free virtual-credit prediction game.
// Honest framing is load-bearing: it is a free, social game. Credits are
// virtual, have no monetary value, and there is NO cashout — never imply
// real-money gambling. Mirrors FeatureBlocks' section shell + Vignette
// pattern and PerksCta's CTA buttons. Server component.
export function PredictionGame() {
  return (
    <section id="predict" className="scroll-mt-28 border-b border-border">
      <div className="mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-16 sm:px-6">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">
          Free prediction game
        </p>
        <h2 className="mt-3 font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tight text-text sm:text-5xl">
          Think you can call it?
          <br />
          <span className="text-text-faint">Predict the grid.</span>
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-text-muted">
          A free, social prediction game built into Paddock. Fresh virtual credits
          land every month — no card, no cost, and nothing to cash out. It&apos;s for
          the bragging rights, not the bank.
        </p>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {MARKETS.map((m, i) => (
            <article
              key={m.tag}
              className="grid gap-6 rounded-2xl border border-border bg-surface/60 p-6 sm:p-8"
            >
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-text-faint">
                  {m.tag}
                </p>
                <h3 className="mt-3 font-display text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
                  {m.title}
                </h3>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-text-muted">{m.body}</p>
              </div>
              <Vignette kind={m.vignette} index={i} />
            </article>
          ))}
        </div>

        {/* How it works — three honest beats, no money language. */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            {
              h: 'Free credits, monthly',
              b: 'A fresh stack of virtual credits arrives every month, topped up for each race weekend. They have no monetary value and can never be withdrawn or cashed out.',
            },
            {
              h: 'Three markets a round',
              b: 'Back the race winner, the podium and the top ten. Predictions lock about an hour before qualifying — so you call it before the grid does.',
            },
            {
              h: 'Leaderboards & honours',
              b: 'Climb the win-rate table solo or in friend leagues. Monthly 🥇🥈🥉 medals reward the sharpest calls. Pure pride — there is no cashout, ever.',
            },
          ].map(step => (
            <div key={step.h} className="rounded-2xl border border-border bg-bg p-5">
              <h3 className="text-sm font-bold text-text">{step.h}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{step.b}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/play"
            className="rounded-full bg-brand px-6 py-3 text-sm font-bold uppercase tracking-[0.08em] text-black transition-colors duration-(--duration-fast) hover:bg-brand-deep"
          >
            Play free&ensp;→
          </Link>
          <Link
            href="/sign-up"
            className="rounded-full border border-border-strong px-6 py-3 text-sm font-bold uppercase tracking-[0.08em] text-text transition-colors duration-(--duration-fast) hover:border-brand hover:text-brand"
          >
            Create free account
          </Link>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-text-faint">
          Free to play with virtual credits. Credits hold no monetary value and cannot be
          withdrawn or cashed out. For entertainment only — not gambling.
        </p>
      </div>
    </section>
  );
}

function Vignette({ kind, index }: { kind: 'odds' | 'leaderboard'; index: number }) {
  return (
    <div aria-hidden="true" className="rounded-xl border border-border bg-bg p-4">
      {kind === 'odds' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.15em] text-text-faint">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--s-f1)' }} />
              Race winner
            </span>
            <span>1,000 cr free</span>
          </div>
          <div className="space-y-2 font-mono text-xs">
            {[
              ['Verstappen', '2.40', true],
              ['Norris', '3.10', false],
              ['Leclerc', '4.50', false],
            ].map(([name, odds, picked]) => (
              <div
                key={name as string}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                  picked ? 'border-brand/50 bg-brand/10' : 'border-border bg-surface'
                }`}
              >
                <span className={`font-sans font-semibold ${picked ? 'text-brand' : 'text-text'}`}>
                  {name}
                </span>
                <span className={picked ? 'text-brand' : 'text-text-muted'}>{odds}×</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[11px] text-text-muted">
            <span>Back 100 cr</span>
            <span className="text-text-faint">Locks 1h before quali</span>
          </div>
        </div>
      )}
      {kind === 'leaderboard' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.15em] text-text-faint">
            <span>The Apex League</span>
            <span>June</span>
          </div>
          {[
            ['🥇', 'You', '71%'],
            ['🥈', 'Sam', '64%'],
            ['🥉', 'Priya', '58%'],
            ['4', 'Marco', '52%'],
          ].map(([medal, name, rate]) => {
            const lead = (medal as string) === '🥇';
            return (
              <div
                key={name as string}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-xs ${
                  lead ? 'border-brand/50 bg-brand/10' : 'border-border bg-surface'
                }`}
              >
                <span className="w-5 text-center font-mono">{medal}</span>
                <span className={`flex-1 font-sans font-semibold ${lead ? 'text-brand' : 'text-text'}`}>
                  {name}
                </span>
                <span className="font-mono text-text-muted">{rate} win rate</span>
              </div>
            );
          })}
        </div>
      )}
      <span className="sr-only">{index === 0 ? 'Example odds card' : 'Example league leaderboard'}</span>
    </div>
  );
}
