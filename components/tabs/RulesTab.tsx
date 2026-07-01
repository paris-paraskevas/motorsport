import { Series } from '@/lib/types';
import { PlaceholderTab } from './PlaceholderTab';

// Rules tab — F1-first. The generic tab surface was retired in 0.19.0 (no
// series shipped a curated rules.md; content folded into About). This is the
// F1-only revival tracked in IDEAS.md / docs/HANDOFF.md: an authoritative link
// to the official FIA regulations plus a scannable "common topics" quick
// reference. Guarded by slug so it degrades to the placeholder if ever mounted
// for another series before that series has its own curated rules content.
//
// NOTE (wiring): 'rules' is not currently a TabKey in lib/tabs.ts, so this
// component is not yet reachable from the tab rail. Re-adding the tab key +
// the renderTab() case is a separate, coordinated change (out of this file's
// scope). This component is ready to drop in once that lands.

/** Official FIA regulations landing page. Deliberately the stable landing page
 *  rather than a versioned PDF: the F1 Sporting/Technical PDFs are re-issued
 *  through the season (issue numbers change every few weeks), so a deep PDF URL
 *  goes stale fast. Verified 200 + current, 2026-07-01. */
const FIA_REGULATIONS_URL = 'https://www.fia.com/regulations';

interface RuleTopic {
  term: string;
  blurb: string;
}

// Plain-English one-liners for the rule areas fans most often look up. Kept
// evergreen (no season-specific numbers) so the list doesn't silently rot —
// the authoritative detail lives one click away in the FIA regulations.
const COMMON_TOPICS: RuleTopic[] = [
  {
    term: 'Points system',
    blurb:
      'The top ten finishers score (25 down to 1), with a bonus point for the fastest lap if that driver finishes in the points. Sprint races award a shorter 8–1 spread.',
  },
  {
    term: 'Penalties & the stewards',
    blurb:
      'Race stewards police on-track incidents — time penalties (5s/10s), drive-throughs, and grid drops for the next race, plus licence penalty points that accumulate across a rolling twelve months.',
  },
  {
    term: 'Parc fermé',
    blurb:
      'From the start of qualifying the car is locked under parc fermé rules: teams can only make a defined list of changes, and breaking them means starting from the pit lane.',
  },
  {
    term: 'DRS',
    blurb:
      'The Drag Reduction System opens a flap in the rear wing for a straight-line speed boost. It is only allowed in marked DRS zones when a driver is within one second of the car ahead.',
  },
  {
    term: 'Track limits',
    blurb:
      'A lap or overtake is deleted if all four wheels go beyond the white lines. Repeat offenders collect warnings that escalate to a time penalty.',
  },
  {
    term: 'Tyre rules',
    blurb:
      'In a dry race each driver must use at least two different slick compounds. Qualifying and allocation rules govern how many sets are available across the weekend.',
  },
];

export function RulesTab({ series }: { series: Series }) {
  // F1-first: this curated surface only exists for F1. Any other series falls
  // back to the shared placeholder until it has its own rules content.
  if (series.meta.slug !== 'f1') {
    return <PlaceholderTab tabLabel="Rules" />;
  }

  return (
    <div className="space-y-4">
      <section className="border-y border-border py-5 md:py-6">
        <h2 className="text-text text-xl font-bold tracking-tight mb-2">Rules</h2>
        <p className="text-text-muted text-sm leading-relaxed max-w-prose">
          Formula 1 runs to the FIA&rsquo;s Sporting, Technical, and Financial
          Regulations, revised each season. The definitive text is published by
          the FIA — the quick reference below covers the rules fans reach for
          most.
        </p>
        <div className="mt-4">
          <a
            href={FIA_REGULATIONS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-text-muted hover:text-text border border-border hover:border-border-strong px-3 py-1.5 transition-colors duration-(--duration-fast)"
          >
            Official FIA regulations ↗
          </a>
        </div>
      </section>

      <section className="border-y border-border py-5 md:py-6">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-4">
          Common topics
        </h2>
        <dl className="space-y-4">
          {COMMON_TOPICS.map(topic => (
            <div key={topic.term} className="flex flex-col gap-1">
              <dt className="flex items-baseline gap-2">
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-tint" />
                <span className="text-text text-sm font-semibold tracking-tight">
                  {topic.term}
                </span>
              </dt>
              <dd className="pl-3.5 text-text-muted text-sm leading-relaxed max-w-prose">
                {topic.blurb}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
