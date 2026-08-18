import Link from 'next/link';
import { seriesInk } from '@/lib/site';
import type { PodiumEntry } from '@/lib/home-results';
import { NextRaceCountdown } from '@/components/NextRaceCountdown';

// The home's editorial lead (design handoff §4.1, panels 1b/2a): four fixed
// blocks that answer "what just happened, and what did it change" — the
// result band, what it changed, what's next, the wire. Server-rendered from
// KV-warmed feeds; nothing here blocks on a client fetch. This REPLACED the
// eighteen-widget gallery (operator decision 2026-08-18: full cutover, no
// survivors — bets/leagues live on /social, watch/weather/upgrades on the
// weekend pages).

export interface HomeLeadResult {
  seriesSlug: string;
  seriesName: string;
  color: string;
  raceName: string;
  round: number;
  dateIso: string;
  podium: PodiumEntry[];
  /** P2's gap string when it reads as one ("+15.080"). */
  margin?: string;
  weekendHref: string;
}

export interface HomeLeadChanged {
  seriesName: string;
  leader: { name: string; points: number };
  gapToSecond: number | null;
  top: { position: number; name: string; points: number }[];
  /** The just-run race's winner — their standings row gets the accent bar. */
  winnerName?: string;
}

export interface HomeLeadNextItem {
  seriesSlug: string;
  seriesName: string;
  color: string;
  title: string;
  dateRangeLabel: string;
  firstStartIso: string | null;
  href: string;
  note?: string;
}

export interface HomeLeadWireItem {
  title: string;
  link: string;
  sourceHost: string;
  ageLabel: string;
  seriesName: string;
  seriesColor: string;
}

function SectionRule({ label, right }: { label: string; right?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between border-b border-text pb-1">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</span>
      {right !== undefined && (
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">{right}</span>
      )}
    </div>
  );
}

function headlineFor(winner: string, raceName: string): string {
  const article = /^(round|rally|rallye)\b/i.test(raceName) ? '' : 'the ';
  return `${winner} wins ${article}${raceName}`;
}

export function HomeLead({
  result,
  changed,
  next,
  wire,
}: {
  result: HomeLeadResult | null;
  changed: HomeLeadChanged | null;
  next: HomeLeadNextItem[];
  wire: HomeLeadWireItem[];
}) {
  const winner = result?.podium.find(p => p.position === 1);
  const raceDate = result
    ? new Date(result.dateIso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    : null;
  const leaderPoints = changed?.top[0]?.points ?? 0;

  return (
    <div className="mx-auto max-w-[1180px]">
      {/* ── 1. The result that just happened ─────────────────────────────── */}
      {result && winner && (
        <section
          aria-label="Latest result"
          className="border-[1.5px] border-text bg-surface-elevated p-[18px] lg:p-5"
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0" style={{ backgroundColor: result.color }} />
                <span
                  className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: seriesInk(result.color) }}
                >
                  {result.seriesName}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">
                  Round {result.round} · {raceDate}
                </span>
              </div>
              <h1 className="mt-3 font-serif text-[30px] font-semibold leading-[1.1] text-text lg:text-[40px]">
                {headlineFor(winner.name, result.raceName)}
              </h1>
              <p className="mt-2 font-mono text-[11px] tabular-nums text-text-muted">
                {result.margin ? <>Winning margin <span className="text-text">{result.margin}</span></> : winner.detail}
              </p>
              <Link
                href={result.weekendHref}
                className="mt-4 inline-block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-brand hover:underline"
              >
                Full weekend report →
              </Link>
            </div>
            <div>
              <div className="flex items-baseline justify-between border-b border-text pb-1">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  Classification
                </span>
              </div>
              <ul>
                {result.podium.map(p => (
                  <li key={p.position} className="flex items-baseline gap-3 border-b border-border py-2">
                    <span className="w-4 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-faint">
                      {p.position}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-serif text-[16px] font-semibold leading-tight text-text">
                        {p.name}
                      </span>
                      {p.detail && (
                        <span className="block truncate font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint">
                          {p.detail}
                        </span>
                      )}
                    </span>
                    {p.time && (
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-muted">{p.time}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* ── 2. What it changed ───────────────────────────────────────────── */}
      {changed && changed.top.length > 0 && (
        <section aria-label="What it changed" className="mt-8">
          <SectionRule label="What it changed" right={`${changed.seriesName} · Drivers' championship`} />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
            <div>
              <h2 className="font-serif text-[22px] font-semibold leading-snug text-text lg:text-[26px]">
                {changed.gapToSecond != null
                  ? `${changed.leader.name} leads by ${changed.gapToSecond} ${changed.gapToSecond === 1 ? 'point' : 'points'}`
                  : `${changed.leader.name} leads the championship`}
              </h2>
            </div>
            <ul>
              {changed.top.map(row => {
                const isWinner = changed.winnerName != null && row.name === changed.winnerName;
                const width = leaderPoints > 0 ? Math.max(2, Math.round((row.points / leaderPoints) * 100)) : 0;
                return (
                  <li key={row.position} className="flex items-center gap-3 border-b border-border py-1.5">
                    <span className="w-4 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-faint">
                      {row.position}
                    </span>
                    <span className={`w-28 shrink-0 truncate text-sm sm:w-36 ${isWinner ? 'font-semibold text-text' : 'text-text-muted'}`}>
                      {row.name}
                    </span>
                    <span aria-hidden="true" className="h-[6px] min-w-0 flex-1 bg-border">
                      <span
                        className={`block h-full ${isWinner ? 'bg-brand' : row.position === 1 ? 'bg-text' : 'bg-border-strong'}`}
                        style={{ width: `${width}%` }}
                      />
                    </span>
                    <span className="w-10 shrink-0 text-right font-mono text-[12px] font-semibold tabular-nums text-text">
                      {row.points}
                    </span>
                    <span className="hidden w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-faint sm:block">
                      {row.position === 1 ? '—' : `−${leaderPoints - row.points}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* ── 3. What's next ───────────────────────────────────────────────── */}
      {next.length > 0 && (
        <section aria-label="What's next" className="mt-8">
          <SectionRule label="What's next" right="All series" />
          <ul>
            {next.map((w, i) => (
              <li key={`${w.seriesSlug}-${w.href}`}>
                <Link
                  href={w.href}
                  className="flex min-h-11 items-center gap-3 border-b border-border py-2 transition-colors duration-(--duration-fast) hover:bg-surface"
                >
                  <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0" style={{ backgroundColor: w.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-[16px] font-semibold leading-tight text-text">
                      {w.title}
                    </span>
                    <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
                      {w.seriesName}
                      {w.note ? ` · ${w.note}` : ''}
                    </span>
                  </span>
                  {i === 0 && w.firstStartIso ? (
                    <NextRaceCountdown target={w.firstStartIso} label={w.dateRangeLabel} color={w.color} />
                  ) : (
                    <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">
                      {w.dateRangeLabel}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── 4. The wire ──────────────────────────────────────────────────── */}
      {wire.length > 0 && (
        <section aria-label="The wire" className="mt-8">
          <SectionRule label="The wire" right="Reported elsewhere · linked out" />
          <ul>
            {wire.map(item => (
              <li key={item.link}>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-baseline gap-3 border-b border-border py-2 transition-colors duration-(--duration-fast) hover:bg-surface"
                >
                  <span aria-hidden="true" className="relative top-[2px] h-3.5 w-[3px] shrink-0 self-start" style={{ backgroundColor: item.seriesColor }} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-[16px] font-semibold leading-snug text-text">
                      {item.title}
                    </span>
                    <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
                      {item.seriesName} · {item.sourceHost}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-faint">{item.ageLabel}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
