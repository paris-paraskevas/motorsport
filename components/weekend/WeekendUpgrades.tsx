import { CollapsibleSection } from '@/components/CollapsibleSection';
import type { RoundUpgrades } from '@/lib/series-content';

// Per-weekend car upgrades — what each team brought to this round, from the
// official FIA "Car Presentation Submissions" document (curated; see
// docs/research/2026-07-06-f1-upgrades-data-source.md). F1-only. Server-rendered
// inside a native collapsible; only teams that submitted parts are listed.
export function WeekendUpgrades({ data }: { data: RoundUpgrades }) {
  const totalParts = data.teams.reduce((n, t) => n + t.items.length, 0);
  return (
    <CollapsibleSection title="Upgrades" defaultOpen>
      <div className="border-y border-border py-4">
        <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
          {data.teams.length} {data.teams.length === 1 ? 'team' : 'teams'} · {totalParts}{' '}
          new {totalParts === 1 ? 'part' : 'parts'} declared
        </div>

        <div className="space-y-5">
          {data.teams.map(team => (
            <div key={team.team}>
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <h3 className="text-text text-sm font-semibold tracking-tight">{team.team}</h3>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint tabular-nums">
                  {team.items.length} {team.items.length === 1 ? 'part' : 'parts'}
                </span>
              </div>
              <ul className="divide-y divide-border/60">
                {team.items.map((it, i) => (
                  <li key={i} className="py-2">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-text text-sm font-medium">{it.component}</span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] font-semibold text-text-faint border border-border px-1.5 py-0.5">
                        {it.reason}
                      </span>
                    </div>
                    {it.detail && (
                      <p className="mt-1 text-xs text-text-muted leading-relaxed">{it.detail}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
          Source:{' '}
          <a
            href="https://www.fia.com/documents"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-muted hover:text-text underline underline-offset-2 transition-colors duration-(--duration-fast)"
          >
            FIA Car Presentation Submissions
          </a>{' '}
          (Doc {data.doc})
        </div>
      </div>
    </CollapsibleSection>
  );
}
