import Link from 'next/link';

const PERKS = [
  {
    title: 'Follow only what you watch',
    body: 'Hide the series you don’t care about; the whole site reorganises around the ones you do.',
  },
  {
    title: 'Push when it matters',
    body: 'Pre-session pings on any device with the app installed — and one-tap mute per series.',
  },
];

// Closing pitch. Browsing needs no account; the perks are the upsell.
// (Mockup's "Sync your calendar" card cut — feature doesn't exist yet.)
export function PerksCta() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
        <h2 className="font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tight text-text sm:text-5xl">
          Browse free. <span className="text-brand">Sign in for the perks.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-text-muted">
          Everything is readable without an account. A free account adds
          followed series, push notifications and the device-aware PWA
          dashboard.
        </p>

        <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
          {PERKS.map(p => (
            <div key={p.title} className="rounded-2xl border border-border bg-surface/60 p-6 text-left">
              <h3 className="text-sm font-bold text-text">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/app"
            className="rounded-full bg-brand px-6 py-3 text-sm font-bold uppercase tracking-[0.08em] text-black transition-colors duration-(--duration-fast) hover:bg-brand-deep"
          >
            Open the paddock&ensp;→
          </Link>
          <Link
            href="/sign-up"
            className="rounded-full border border-border-strong px-6 py-3 text-sm font-bold uppercase tracking-[0.08em] text-text transition-colors duration-(--duration-fast) hover:border-brand hover:text-brand"
          >
            Create free account
          </Link>
        </div>
      </div>
    </section>
  );
}
