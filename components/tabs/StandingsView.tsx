'use client';

import { useState, type ReactNode } from 'react';

// Sub-tabs for a series' Standings tab (Drivers / Constructors / …). Mirrors
// WeekendTabs' tablist markup + ARIA. Every panel stays mounted (hidden when
// inactive, not unmounted) so all tables are server-rendered and crawlable and
// switching tabs never refetches — the visibility is a CSS toggle only. A lone
// section renders bare (no tab bar), so single-championship series look
// unchanged.
export function StandingsView({
  sections,
}: {
  sections: { key: string; label: string; content: ReactNode }[];
}) {
  const [active, setActive] = useState(sections[0]?.key);

  if (sections.length <= 1) {
    return <div className="space-y-4">{sections[0]?.content}</div>;
  }

  return (
    <div>
      <nav
        aria-label="Standings sections"
        role="tablist"
        className="mb-5 flex gap-5 border-b border-border font-mono text-[11px] uppercase tracking-[0.16em]"
      >
        {sections.map(s => (
          <button
            key={s.key}
            type="button"
            role="tab"
            id={`standings-tab-${s.key}`}
            aria-selected={active === s.key}
            aria-controls={`standings-panel-${s.key}`}
            onClick={() => setActive(s.key)}
            className={`-mb-px border-b-2 pb-2 transition-colors duration-(--duration-fast) ${
              active === s.key
                ? 'border-brand text-text'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {sections.map(s => (
        <div
          key={s.key}
          id={`standings-panel-${s.key}`}
          role="tabpanel"
          aria-labelledby={`standings-tab-${s.key}`}
          hidden={active !== s.key}
          className="space-y-4"
        >
          {s.content}
        </div>
      ))}
    </div>
  );
}
