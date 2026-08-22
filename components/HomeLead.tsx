import Link from 'next/link';
import { seriesInk } from '@/lib/site';
import { sessionSlug } from '@/lib/weekend';
import type { PodiumEntry } from '@/lib/home-results';
import { NextRaceCountdown } from '@/components/NextRaceCountdown';
import { SessionDayNote } from '@/components/SessionDayNote';

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
  /** Season over → the leader is the champion; the headline says so. */
  seasonComplete?: boolean;
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

/** The lead blog post. Shape-compatible with lib/blog's HomeBlogLead; the
 *  series fields are optional because the fetcher returns a slug and only the
 *  page can resolve it to a name and colour. */
export interface HomeLeadBlog {
  slug: string;
  title: string;
  summary: string;
  heroImage: string | null;
  publishedAtIso: string;
  readMinutes: number;
  seriesName?: string | null;
  seriesColor?: string | null;
  /** Relative stamp ("28m ago") — a lead story should read as news. */
  ageLabel?: string | null;
  /** Further reading, shown only where the 8/5 cover leaves room beside it. */
  suggested?: { slug: string; title: string }[];
}

/** The weekend running RIGHT NOW. Its presence is what demotes the
 *  just-finished result below it: a completed season elsewhere must not
 *  outrank a race in progress (the 2026-08-21 Formula E/Zandvoort inversion). */
export interface HomeLeadLiveWeekend {
  seriesSlug: string;
  seriesName: string;
  color: string;
  eventName: string;
  href: string;
  /** `endIso` is what lets the countdown flip to a LIVE pill instead of
   *  vanishing at zero — the flip is decided client-side, see
   *  NextRaceCountdown's liveUntil. */
  nextSession: { name: string; startIso: string; endIso: string } | null;
  /** Other sessions sharing `nextSession`'s day — which is NOT necessarily
   *  today, so the heading names the day rather than asserting one. */
  alsoSameDay: { name: string; startIso: string }[];
  /** The day those sessions fall on, YYYY-MM-DD, on the same UTC bucketing
   *  `groupByDay` uses. A bare date, not an instant, so SessionDayNote can name
   *  its weekday identically on the server and the client. */
  alsoDayIso: string | null;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
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
  blog,
  liveWeekend,
  result,
  changed,
  next,
  wire,
}: {
  blog?: HomeLeadBlog | null;
  liveWeekend?: HomeLeadLiveWeekend | null;
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
  // Season over → the title decision outranks the race result: the band leads
  // with "Season complete" + the champion, and the race winner drops to a
  // sub-line (operator, 2026-08-20). `changed` is always the result's series.
  const championName = changed?.seasonComplete ? changed.leader.name : null;

  // Anything above the result band pushes it down and takes the page's h1.
  const leadAbove = Boolean(blog || liveWeekend);
  const ResultHeading = blog ? 'h2' : 'h1';

  return (
    <div>
      {/* ── 0a. Our own writing, first. The lead story is a Paddock post, not
          a syndicated headline — the wire already carries those. Cover image
          left, the read right, in the Paper language rather than the testing
          build's dark treatment. ── */}
      {blog && (
        <section aria-label="Latest from the blog" className="border-[1.5px] border-text bg-surface-elevated shadow-lg">
          <div className="grid lg:grid-cols-[minmax(0,46%)_1fr]">
            {/* Redundant link: aria-hidden + tabIndex -1 so the picture stays
                clickable for a mouse without announcing a duplicate of the
                headline link beside it. */}
            <Link
              href={`/blog/${blog.slug}`}
              aria-hidden="true"
              tabIndex={-1}
              className="block border-b-[1.5px] border-text lg:border-b-0 lg:border-r-[1.5px]"
            >
              {blog.heroImage ? (
                // 8/5 = 1.6:1, operator's call: tall and dominant rather than a
                // letterbox. width/height carry the SAME ratio so the reserved
                // box matches the CSS one and nothing shifts before Tailwind
                // lands; object-cover crops whatever the source actually is.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={blog.heroImage}
                  alt=""
                  width={1200}
                  height={750}
                  fetchPriority="high"
                  className="aspect-[8/5] h-full w-full object-cover"
                />
              ) : (
                // No cover (7 of 8 published posts have none): a typographic
                // panel rather than a broken image box.
                <span className="flex aspect-[8/5] items-end bg-surface p-4">
                  <span className="font-mono text-[28px] font-bold uppercase leading-none tracking-[-0.02em] text-text-faint lg:text-[38px]">
                    {blog.seriesName ?? 'Paddock'}
                  </span>
                </span>
              )}
            </Link>

            {/* Vertically centred from lg up, where the grid is two columns and
                the image's 8/5 ratio drives the row height. PAGE_WIDE is fully
                fluid with NO max width (lib/site.ts:31), so at 2560px the image
                cell is 1142x713 while this content is only ~192px tall — 73% of
                the box was dead space until the fluid type below. */}
            <div className="flex min-w-0 flex-col p-[18px] lg:justify-center lg:p-5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-brand">
                  Lead story
                </span>
                {blog.ageLabel && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">
                    {blog.ageLabel}
                  </span>
                )}
                {blog.seriesName && (
                  <>
                    <span
                      aria-hidden="true"
                      className="h-3.5 w-[3px] shrink-0"
                      style={{ backgroundColor: blog.seriesColor ?? undefined }}
                    />
                    <span
                      className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]"
                      style={{ color: blog.seriesColor ? seriesInk(blog.seriesColor) : undefined }}
                    >
                      {blog.seriesName}
                    </span>
                  </>
                )}
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">
                  {blog.readMinutes} min read
                </span>
              </div>
              {/* Fluid type, not breakpoint steps: the page has no max width, so
                  a stepped scale leaves the same hole between breakpoints. The
                  ch-based measure rides the font-size, so the headline gains
                  lines as it grows instead of running to a 200-character line.
                  Measured fill of the text cell: 79% at 1280, 80% at 1440, 76%
                  at 1920, 72% at 2560 — against 27% before. */}
              <h1 className="mt-3 font-serif text-[clamp(30px,2.7vw,72px)] font-semibold leading-[1.06] text-text lg:max-w-[20ch]">
                <Link href={`/blog/${blog.slug}`} className="decoration-2 underline-offset-4 hover:underline">
                  {blog.title}
                </Link>
              </h1>
              <p className="mt-3 line-clamp-3 font-serif text-[clamp(17px,0.85vw,22px)] leading-snug text-text-muted lg:max-w-[56ch]">
                {blog.summary}
              </p>
              <Link
                href={`/blog/${blog.slug}`}
                className="mt-5 inline-flex min-h-11 items-center self-start bg-text px-5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted"
              >
                Read the story →
              </Link>

              {/* Further reading fills the space the 8/5 cover leaves beside it
                  (operator, 2026-08-21). xl and up only: below that the column
                  is already full and this would push the band taller than its
                  own picture. */}
              {blog.suggested && blog.suggested.length > 0 && (
                <div className="mt-8 hidden border-t border-border pt-4 xl:block">
                  <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    More reading
                  </span>
                  <ul className="mt-2">
                    {blog.suggested.map(s => (
                      <li key={s.slug}>
                        <Link
                          href={`/blog/${s.slug}`}
                          className="block border-b border-border py-2 font-serif text-[16px] font-semibold leading-snug text-text-muted transition-colors duration-(--duration-fast) last:border-b-0 hover:text-text"
                        >
                          {s.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 0b. The weekend in progress. Sits above the finished-race band so
          a completed season elsewhere cannot outrank a race running today. ── */}
      {liveWeekend && (
        <section
          aria-label="This weekend"
          className={`${blog ? 'mt-8 ' : ''}border-[1.5px] border-text bg-surface-elevated shadow-lg p-[18px] lg:p-5`}
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {/* Deliberately NOT "On now": the band also catches a weekend
                starting inside 24h (page.tsx's DAY_MS lookahead), and on the
                Friday morning of a race weekend no session has run yet. The
                countdown on the Up-next row carries the liveness instead. */}
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-brand">This weekend</span>
            <span
              aria-hidden="true"
              className="h-3.5 w-[3px] shrink-0 self-center"
              style={{ backgroundColor: liveWeekend.color }}
            />
            <span
              className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: seriesInk(liveWeekend.color) }}
            >
              {liveWeekend.seriesName}
            </span>
            <Link
              href={liveWeekend.href}
              className="min-w-0 font-serif text-[22px] font-semibold leading-tight text-text hover:underline lg:text-[26px]"
            >
              {liveWeekend.eventName}
            </Link>
          </div>

          {liveWeekend.nextSession && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              {/* No static "Up next" prefix: once the session starts the
                  countdown becomes a LIVE pill, and "Up next … Live now" reads
                  as a contradiction. The session name carries both states, and
                  uppercasing is avoided because it turns the raw title
                  "F1 - Practice 1" into "F1 - PRACTICE 1". */}
              {/* The session name links to its own session page, not just the
                  weekend (operator, 2026-08-21). sessionSlug is the same helper
                  the weekend page's own session links use, so the URL shape
                  cannot drift from theirs. */}
              <Link
                href={`${liveWeekend.href}/${sessionSlug(liveWeekend.nextSession.name)}`}
                className="min-w-0 font-serif text-[17px] font-semibold leading-tight text-text hover:underline"
              >
                {liveWeekend.nextSession.name}
              </Link>
              <NextRaceCountdown
                target={liveWeekend.nextSession.startIso}
                label={timeLabel(liveWeekend.nextSession.startIso)}
                color={liveWeekend.color}
                liveUntil={liveWeekend.nextSession.endIso}
              />
            </div>
          )}

          {liveWeekend.alsoSameDay.length > 0 && liveWeekend.alsoDayIso && (
            <>
              <span className="mt-4 block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                <SessionDayNote dayIso={liveWeekend.alsoDayIso} />
              </span>
              <ul className="mt-1">
                {liveWeekend.alsoSameDay.map(s => (
                  <li
                    key={`${s.name}-${s.startIso}`}
                    className="flex items-baseline justify-between gap-3 border-b border-border py-1.5 last:border-b-0"
                  >
                    <Link
                      href={`${liveWeekend.href}/${sessionSlug(s.name)}`}
                      className="min-w-0 truncate font-serif text-[15px] text-text-muted hover:text-text hover:underline"
                    >
                      {s.name}
                    </Link>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-faint">
                      {timeLabel(s.startIso)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {/* ── 1. The result that just happened ─────────────────────────────── */}
      {result && winner && (
        <section
          aria-label="Latest result"
          className={`${leadAbove ? 'mt-8 ' : ''}border-[1.5px] border-text bg-surface-elevated shadow-lg p-[18px] lg:p-5`}
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
              {championName && (
                <p className="mt-3 font-mono text-[12px] font-bold uppercase tracking-[0.2em] text-brand">
                  Season complete
                </p>
              )}
              {/* Demoted to h2 and a size down when the blog lead is above it,
                  so the two headlines do not compete for the same rank. */}
              <ResultHeading
                className={`${championName ? 'mt-1.5' : 'mt-3'} font-serif font-semibold leading-[1.1] text-text ${
                  blog ? 'text-[24px] lg:text-[30px]' : 'text-[30px] lg:text-[40px]'
                }`}
              >
                {championName
                  ? `${championName} is ${result.seriesName} champion`
                  : headlineFor(winner.name, result.raceName)}
              </ResultHeading>
              {championName ? (
                <p className="mt-2 font-serif text-[17px] leading-snug text-text-muted">
                  {headlineFor(winner.name, result.raceName)}
                  {result.margin ? ` — winning margin ${result.margin}` : ''}.
                </p>
              ) : (
                <p className="mt-2 font-mono text-[11px] tabular-nums text-text-muted">
                  {result.margin ? <>Winning margin <span className="text-text">{result.margin}</span></> : winner.detail}
                </p>
              )}
              <Link
                href={result.weekendHref}
                className="mt-4 inline-block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-brand hover:underline"
              >
                Full weekend report →
              </Link>
            </div>
            <div>
              <div className="flex items-baseline justify-between border-b border-text pb-1">
                {/* In champion mode the h1 is about the title, so the podium
                    must name its race itself (operator annotation, 2026-08-20). */}
                <span className="min-w-0 truncate font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  {championName ? `${result.raceName} · Classification` : 'Classification'}
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

      {/* ── 2 × 3. What it changed beside what's next (round-2 ⑤): the
          operator's arrows move the next-weekends list up into the right
          column, so the championship read and the calendar read share one
          band. EQUAL halves (operator, 2026-08-20): "what's next" is why
          users come, so it gets the same width as the championship read.
          Either half missing → the other takes the full width. ── */}
      {((changed && changed.top.length > 0) || next.length > 0) && (
        <div
          className={`mt-8 grid gap-x-10 gap-y-8 ${
            changed && changed.top.length > 0 && next.length > 0
              ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'
              : ''
          }`}
        >
          {changed && changed.top.length > 0 && (
            <section aria-label="What it changed" className="min-w-0">
              <SectionRule
                label="What it changed"
                right={`${changed.seriesName} · ${changed.seasonComplete ? 'Final standings' : "Drivers' championship"}`}
              />
              <div className="grid gap-6 xl:grid-cols-[minmax(0,300px)_1fr]">
                <div>
                  <h2 className="font-serif text-[22px] font-semibold leading-snug text-text lg:text-[26px]">
                    {changed.seasonComplete
                      ? changed.gapToSecond != null
                        ? `${changed.leader.name} takes the title by ${changed.gapToSecond} ${changed.gapToSecond === 1 ? 'point' : 'points'}`
                        : `${changed.leader.name} is champion`
                      : changed.gapToSecond != null
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

          {next.length > 0 && (
            <section aria-label="What's next" className="min-w-0">
              <SectionRule label="What's next" right="All series" />
              <ul>
                {next.map((w, i) => (
                  <li key={`${w.seriesSlug}-${w.href}`}>
                    <Link
                      href={w.href}
                      className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border py-2 transition-colors duration-(--duration-fast) hover:bg-surface"
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
        </div>
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
