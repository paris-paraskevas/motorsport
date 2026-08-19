import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ExternalLink } from 'lucide-react';
import { findDriverBySlug } from '@/lib/people';
import { loadSeries } from '@/lib/series';
import { groupByWeekend } from '@/lib/group';
import { weekendLabel } from '@/lib/weekend';
import { loadSnapshotSource } from '@/components/weekend/WeekendStandingsSnapshot';
import { driverSeasonForm, type DriverSeasonForm } from '@/lib/profile-stats';
import { fetchWikipediaBio, ageFromISO, flagEmoji, type WikipediaBio } from '@/lib/wikipedia-bio';
import { fetchNews, filterNewsByMention, newsMentionAliases } from '@/lib/news';
import type { NewsItem, Series } from '@/lib/types';
import { loadDriverPortraits, loadDriverBios, type DriverBio } from '@/lib/series-content';
import { NextRaceCountdown } from '@/components/NextRaceCountdown';
import { withSocialMeta } from '@/lib/seo';
import { PAGE_WIDE } from '@/lib/site';

// ISR: profile pages edge-cache (was force-dynamic). Season form comes from
// the cached results fetchers (loadSnapshotSource excludes WEC's no-store).
export const revalidate = 3600;

// On-demand generation + cache on first request (no build-time prerender of
// ~600 driver pages). The sitemap still lists them.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const driver = await findDriverBySlug(slug);
  // notFound() in metadata, not a fallback title: the streamed shell flushes
  // before the body's notFound() can 404 (soft-404 class, weekend/[round]).
  if (!driver) notFound();
  const description = `${driver.name}, ${driver.team} (${driver.seriesName}) — season form, results, team.`;
  return {
    title: driver.name,
    description,
    ...withSocialMeta({ title: driver.name, description, path: `/drivers/${slug}` }),
  };
}

// Short "About" bio (Wikipedia intro). Attribution mirrors the series About
// tab's "Source: Wikipedia →" credit; absent bio → no section (fail-soft).
function AboutSection({ bio }: { bio: WikipediaBio }) {
  return (
    <section className="mb-8 border-y border-border py-4">
      <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
        About
      </h2>
      <div className="space-y-3">
        {bio.paragraphs.map((p, i) => (
          <p key={i} className="text-sm text-text-muted leading-relaxed">
            {p}
          </p>
        ))}
      </div>
      <div className="mt-3 text-xs text-text-faint">
        Source:{' '}
        <a
          href={bio.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-muted hover:text-text underline underline-offset-2 transition-colors duration-(--duration-fast)"
        >
          Wikipedia &rarr;
        </a>
      </div>
    </section>
  );
}

// Curated, authored bio (content/series/<slug>/bios.json) — preferred over the
// Wikipedia AboutSection above. Same layout; credited to Paddock, no external
// source link (original prose, fact-checked against the sources kept in the JSON).
function CuratedAboutSection({ bio }: { bio: DriverBio }) {
  return (
    <section className="mb-8 border-y border-border py-4">
      <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
        About
      </h2>
      <div className="space-y-3">
        {bio.paragraphs.map((p, i) => (
          <p key={i} className="text-sm text-text-muted leading-relaxed">
            {p}
          </p>
        ))}
      </div>
      <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
        Profile by Paddock
      </div>
    </section>
  );
}

// Latest series-feed stories mentioning this name — same wire-row language as
// the series News tab, condensed for the rail (§4.9/#13). Dates are absolute
// (the page is ISR-cached, so a relative "3h ago" would go stale).
function NewsMentionsRail({ items }: { items: NewsItem[] }) {
  return (
    <div className="mt-6 border-t border-border pt-3">
      <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        In the news
      </span>
      <div className="divide-y divide-border/60">
        {items.map(item => (
          <a
            key={item.link}
            href={item.link}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="group block py-3 transition-colors duration-(--duration-fast) hover:bg-surface"
          >
            <div className="mb-1 flex items-center gap-2">
              <time
                dateTime={item.pubDate.toISOString()}
                className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint tnum"
              >
                {item.pubDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </time>
              <ExternalLink
                size={11}
                className="ml-auto shrink-0 text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)"
              />
            </div>
            <h3 className="text-sm font-semibold leading-snug tracking-tight text-text">
              {item.title}
            </h3>
          </a>
        ))}
      </div>
      <div className="pt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-text-faint">
        Source:{' '}
        <a
          href="https://www.motorsport.com/"
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="text-text-muted hover:text-text underline underline-offset-2 transition-colors duration-(--duration-fast)"
        >
          motorsport.com ↗
        </a>
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint font-semibold">
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl md:text-3xl font-bold tabular-nums text-text">
        {value}
      </div>
    </div>
  );
}

// The five numbers that define a season, on one line (§4.9 + #13's podiums) —
// derived from the results table below, never separately asserted.
function SeasonStats({ form }: { form: DriverSeasonForm }) {
  return (
    <section className="mb-8 border-y border-border py-4">
      <div className="flex gap-10 flex-wrap">
        <StatBlock label="Championship" value={`P${form.position} · ${form.points} pts`} />
        <StatBlock label="Wins" value={String(form.wins)} />
        <StatBlock label="Podiums" value={String(form.podiums)} />
        <StatBlock label="Best finish" value={form.bestFinish != null ? `P${form.bestFinish}` : '—'} />
        <StatBlock label="Starts" value={String(form.starts)} />
      </div>
      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
        of {form.fieldSize} classified this season · every figure from the results below
      </div>
    </section>
  );
}

// EVERY round of the season, ascending, with the venue as a sub-line (#13:
// "add venue sub-line from RaceResult.circuit").
function EveryRound({ rounds }: { rounds: DriverSeasonForm['rounds'] }) {
  return (
    <section className="mb-8 border-y border-border py-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          Every round this season
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint">
          finish · points · running total
        </span>
      </div>
      <ul>
        {rounds.map((r, i) => (
          <li key={`${r.round}-${r.raceName}-${i}`} className="flex items-baseline gap-3 border-b border-border py-1.5">
            <span className="w-9 shrink-0 text-right font-mono text-[11px] font-semibold tabular-nums text-tint">
              R{r.round}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-serif text-[15px] font-semibold text-text">
                {r.raceName}
              </span>
              {r.circuit && (
                <span className="block truncate font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">
                  {r.circuit}
                </span>
              )}
            </span>
            <span className={`w-10 shrink-0 text-right font-mono text-sm tabular-nums ${r.position === 1 ? 'font-semibold text-brand' : 'text-text'}`}>
              {r.position >= 1 ? `P${r.position}` : '—'}
            </span>
            <span className="w-10 shrink-0 text-right font-mono text-sm tabular-nums text-text-muted">
              {r.points > 0 ? `+${r.points}` : '0'}
            </span>
            <span className="w-12 shrink-0 text-right font-mono text-sm font-semibold tabular-nums text-text">
              {r.runningTotal}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Whole-page placeholder while the body's network trio (results form,
// Wikipedia bio, news mentions) resolves — replaces this segment's deleted
// loading.tsx, whose early flush locked dead driver URLs into streamed 200
// soft-404s (the 0.291.0 fold-in, final part).
function DriverSkeleton() {
  return (
    <div aria-busy="true" className={PAGE_WIDE}>
      <div className="mb-8 space-y-4">
        <div className="h-3 w-48 animate-pulse bg-surface/70" />
        <div className="h-9 w-56 animate-pulse bg-surface md:h-11 md:w-80" />
        <div className="h-4 w-36 animate-pulse bg-surface/70" />
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
          <div key={i} className="h-10 animate-pulse border-y border-border bg-surface/40" />
        ))}
      </div>
    </div>
  );
}

async function DriverBody({
  slug,
  driver,
}: {
  slug: string;
  driver: NonNullable<Awaited<ReturnType<typeof findDriverBySlug>>>;
}) {
  // One series load feeds both the season form and the rail's Next out block.
  const series: Series | null = await loadSeries(driver.seriesSlug).catch(() => null);

  // Season form from the series' results feeds — the same cumulation the
  // weekend snapshots use. Null (no feed / no points / name unmatched)
  // degrades to the identity-only page. The Wikipedia bio and the series news
  // feed load in parallel with it; each is independently fail-soft (absent
  // section, never an error).
  const [form, bio, seriesNews] = await Promise.all([
    (async (): Promise<DriverSeasonForm | null> => {
      try {
        if (!series) return null;
        const source = await loadSnapshotSource(series);
        if (!source) return null;
        // Headline stats AND the every-round table derive from this one call
        // (design handoff §4.9: never separately asserted values).
        return driverSeasonForm(source.races, source.extras, driver.name);
      } catch {
        return null;
      }
    })(),
    fetchWikipediaBio(driver.name),
    fetchNews(driver.seriesSlug),
  ]);
  const mentions = filterNewsByMention(seriesNews, newsMentionAliases('driver', driver.name));

  // Identity layer (W4): nationality + age from the Wikipedia intro (fail-soft —
  // absent when the article doesn't match). Header omits the line entirely when
  // neither resolves.
  const nationality = bio?.nationality ?? null;
  const age = bio?.bornISO ? ageFromISO(bio.bornISO) : null;

  // Portrait: prefer a curated free-licensed Commons portrait (rendered with
  // attribution) over the F1-only OpenF1 headshot (F1 official media, not
  // CC-licensed). Both fail-soft — no portrait → the header renders exactly as
  // before (no image).
  const portrait = (await loadDriverPortraits(driver.seriesSlug))[slug] ?? null;
  // Curated bio preferred over the Wikipedia intro (fetched above, still used for
  // the header nationality/age + as the About fallback for uncovered drivers).
  const curatedBio = (await loadDriverBios(driver.seriesSlug))[slug] ?? null;
  // Commons-or-nothing: the old OpenF1-headshot fallback is gone — those are
  // F1 official media; the CC licence on OpenF1's DATA does not license the
  // images (lib/openf1/headshots.ts header + design handoff §7).
  const headshotUrl: string | null = portrait?.src ?? null;

  // Next out (#13): the series' next weekend + a countdown to its first timed
  // session. Local ICS grouping — no network.
  const now = new Date();
  const nextW = (() => {
    if (!series) return null;
    try {
      return (
        groupByWeekend(series.sessions, now, series.rounds).find(
          w => !w.isPast && w.sessions.some(x => x.end >= now),
        ) ?? null
      );
    } catch {
      return null;
    }
  })();
  const nextSession = nextW
    ? [...nextW.sessions]
        .filter(s => !s.dateOnly && s.start > now)
        .sort((a, b) => a.start.getTime() - b.start.getTime())[0]
    : undefined;

  return (
    <div
      className={`relative ${PAGE_WIDE}`}
      style={{
        '--tint': driver.seriesColor, '--tint-fill': driver.seriesColor,
        ['--series-color' as string]: driver.seriesColor,
      } as React.CSSProperties}
    >
      <div
        className="absolute top-0 left-0 right-0 h-px -z-10"
        style={{
          background: `linear-gradient(90deg, transparent, ${driver.seriesColor}, transparent)`,
        }}
      />

      <header className="mb-8 border-y border-border py-5 md:py-6">
        <div className="flex items-start gap-5 md:gap-6">
          {headshotUrl && (
            <figure className="shrink-0">
              {/* Plain <img>, not next/image: remote hosts and next.config
                  deliberately configures no images.remotePatterns, so
                  next/image would throw. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={headshotUrl}
                alt={driver.name}
                width={176}
                height={176}
                loading="lazy"
                decoding="async"
                className="h-32 w-32 md:h-44 md:w-44 rounded-2xl object-cover bg-surface border border-border"
              />
              <figcaption className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint">
                {portrait ? (
                  <>
                    Photo:{' '}
                    <a
                      href={portrait.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-text-muted"
                    >
                      {portrait.by}
                    </a>{' '}
                    · {portrait.license}
                  </>
                ) : null}
              </figcaption>
            </figure>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2.5 mb-3 flex-wrap font-mono text-[11px] uppercase tracking-[0.18em] font-semibold">
              <Link
                href={`/series/${driver.seriesSlug}`}
                className="text-tint hover:underline underline-offset-4"
              >
                {driver.seriesName}
              </Link>
              <span className="text-border-strong">·</span>
              <Link
                href={`/teams/${driver.teamSlug}`}
                className="text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
              >
                {driver.team}
              </Link>
            </div>

            <h1 className="font-serif text-[38px] md:text-[58px] font-medium tracking-[-0.02em] leading-[0.98] text-text">
              {driver.name}
            </h1>

            {(nationality || age != null) && (
              <div className="mt-3 flex items-center gap-2 flex-wrap font-mono text-[12px] uppercase tracking-[0.14em] text-text-muted">
                {nationality && (
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="text-base leading-none">
                      {flagEmoji(nationality.code)}
                    </span>
                    {nationality.demonym}
                  </span>
                )}
                {nationality && age != null && <span className="text-border-strong">·</span>}
                {age != null && <span>{age} yrs</span>}
              </div>
            )}

            <div className="mt-4 flex items-baseline gap-3 flex-wrap">
              {driver.number != null && (
                <span className="text-2xl font-mono tabular-nums text-text-muted">
                  #{driver.number}
                </span>
              )}
              {driver.code && (
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] font-semibold text-text-muted border border-border px-2 py-1">
                  {driver.code}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {form && <SeasonStats form={form} />}

      {/* Two columns (#13): the season's rounds + the prose left, the living
          rail — next out, mentions, the comparison and the team — right. */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {form && form.rounds.length > 0 && <EveryRound rounds={form.rounds} />}
          {curatedBio ? (
            <CuratedAboutSection bio={curatedBio} />
          ) : (
            bio && <AboutSection bio={bio} />
          )}
        </div>

        <aside>
          <div className="border-b border-text pb-1">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Next out
            </span>
          </div>
          {nextW ? (
            <div className="mt-2">
              <p className="font-serif text-[17px] font-semibold leading-tight text-text">
                {nextW.roundName ?? weekendLabel(nextW, nextW.round).title}
              </p>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">
                Round {nextW.round} · {nextW.dateRangeLabel}
              </p>
              {nextSession && (
                <div className="mt-2">
                  <NextRaceCountdown
                    target={nextSession.start.toISOString()}
                    label={nextSession.title.replace(/^.*?[-–—:]\s*/, '').trim() || nextSession.title}
                    color={driver.seriesColor}
                  />
                </div>
              )}
              <Link
                href={`/series/${driver.seriesSlug}/weekend/${nextW.round}`}
                className="mt-1 inline-block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-brand hover:underline"
              >
                Preview →
              </Link>
            </div>
          ) : (
            <p className="mt-2 font-serif text-[15px] italic text-text-muted">Season complete.</p>
          )}

          {mentions.length > 0 && <NewsMentionsRail items={mentions.slice(0, 3)} />}

          {driver.seriesSlug === 'f1' && (
            <div className="mt-6 border-t border-border pt-3">
              <Link
                href={`/f1/compare?a=${slug}`}
                data-heatmap-id="driver:compare"
                className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-brand transition-colors duration-(--duration-fast) hover:text-text"
              >
                Compare with a team-mate →
              </Link>
            </div>
          )}

          <div className="mt-6 border-t border-border pt-3">
            <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Team
            </span>
            <Link
              href={`/teams/${driver.teamSlug}`}
              className="group mt-1 inline-block"
              style={
                driver.teamColor
                  ? { borderLeft: `3px solid ${driver.teamColor}`, paddingLeft: '0.75rem' }
                  : undefined
              }
            >
              <span className="font-serif text-[17px] font-semibold text-text transition-colors duration-(--duration-fast) group-hover:text-tint">
                {driver.team}
              </span>
              <span className="ml-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-text-faint transition-colors duration-(--duration-fast) group-hover:text-text-muted">
                Team page →
              </span>
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default async function DriverPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const driver = await findDriverBySlug(slug);
  if (!driver) notFound();
  return (
    <Suspense fallback={<DriverSkeleton />}>
      <DriverBody slug={slug} driver={driver} />
    </Suspense>
  );
}
