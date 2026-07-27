import Link from 'next/link';
import { Lock } from 'lucide-react';

// Signed-out teaser rendered SERVER-SIDE in place of a gated F1 analysis surface
// (Qualifying Analysis + Replay, Race Story, Practice Analysis, head-to-head).
// Because the swap happens on the server, an anonymous client never receives the
// analysis payload — a client-only <SignedIn> wrapper would still ship it in the
// HTML. This card IS the public/indexable content for the slot; the analysis is
// the signed-in content. Free account (not a paywall).
export function AnalysisGate({
  title,
  blurb,
  seriesColor,
}: {
  title: string;
  blurb: string;
  seriesColor?: string;
}) {
  return (
    <section
      className="my-6 border border-border bg-surface/40 px-6 py-8 text-center"
      style={seriesColor ? ({ '--tint': seriesColor, '--tint-fill': seriesColor } as React.CSSProperties) : undefined}
      aria-label={`${title} — sign in to unlock`}
    >
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-border text-text-faint">
        <Lock size={16} aria-hidden />
      </div>
      <h2 className="font-display text-base font-extrabold uppercase tracking-wide text-text">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">{blurb}</p>
      <Link
        href="/sign-in"
        className="mt-4 inline-flex items-center gap-2 border border-border-strong bg-surface px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-text hover:border-tint transition-colors duration-(--duration-fast)"
      >
        Sign in to unlock
      </Link>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
        Free — an account keeps it free
      </p>
    </section>
  );
}
