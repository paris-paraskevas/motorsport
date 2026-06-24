import Link from 'next/link';
import { SignedOutOnly } from './LandingAuth';

const PERKS = [
  {
    title: 'Follow only what you watch',
    body: 'Hide the series you don’t care about; the whole site reorganises around the ones you do.',
  },
  {
    title: 'Push when it matters',
    body: 'Pre-session pings on any device with the app installed — and one-tap mute per series.',
  },
  {
    title: 'Take it everywhere',
    body: 'Install Paddock as an app on your phone or desktop. It opens straight into your dashboard, full-screen.',
  },
];

// Closing pitch — mockup layout: eyebrow, warm glow, three perk cards.
// Third card is the PWA (the mockup's "Sync your calendar" card returns
// when calendar feeds actually ship — tracked in IDEAS).
export function PerksCta() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 55% 65% at 50% 0%, rgb(255 180 0 / 0.14) 0%, transparent 65%)',
        }}
      />
      <div className="relative mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-16 text-center sm:px-6">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">
          Free, no account needed · better with one
        </p>
        <h2 className="mt-3 font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tight text-text sm:text-5xl">
          Browse free. <span className="text-brand">Sign in for the perks.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-text-muted">
          Paddock is fully free to browse. An account unlocks personalisation —
          followed series, push notifications, and the device-aware dashboard.
        </p>

        <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
          {PERKS.map(p => (
            <div key={p.title} className="rounded-2xl border border-border bg-surface/70 p-6 text-left">
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
          <SignedOutOnly>
            <Link
              href="/sign-up"
              className="rounded-full border border-border-strong px-6 py-3 text-sm font-bold uppercase tracking-[0.08em] text-text transition-colors duration-(--duration-fast) hover:border-brand hover:text-brand"
            >
              Create free account
            </Link>
          </SignedOutOnly>
        </div>
      </div>
    </section>
  );
}
