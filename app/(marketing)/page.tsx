import type { Metadata } from 'next';
import { loadAllSeries } from '@/lib/series';
import { loadAllDrivers } from '@/lib/people';
import { groupByWeekend } from '@/lib/group';
import { buildRoundLookupAcrossSeries, roundFor } from '@/lib/weekend';
import { JsonLd } from '@/components/JsonLd';
import { organizationLd, websiteLd } from '@/lib/json-ld';
import { StandaloneRedirect } from '@/components/landing/StandaloneRedirect';
import { TickerBar, type TickerEntry } from '@/components/landing/TickerBar';
import { LandingNav } from '@/components/landing/LandingNav';
import { Hero, type HeroSession } from '@/components/landing/Hero';
import { SeriesStrip } from '@/components/landing/SeriesStrip';
import { StatsBand } from '@/components/landing/StatsBand';
import { FeatureBlocks } from '@/components/landing/FeatureBlocks';
import { DisciplinesGrid } from '@/components/landing/DisciplinesGrid';
import { PerksCta } from '@/components/landing/PerksCta';
import { LandingFooter } from '@/components/landing/LandingFooter';

export const revalidate = 300;

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default async function Landing() {
  const all = await loadAllSeries();
  const drivers = await loadAllDrivers();
  const now = new Date();

  const flat = all
    .flatMap(s =>
      s.sessions.map(session => ({
        session,
        seriesName: s.meta.name,
        seriesSlug: s.meta.slug,
        seriesColor: s.meta.color,
      })),
    )
    .sort((a, b) => a.session.start.getTime() - b.session.start.getTime());

  const upcoming = flat.filter(x => x.session.end >= now);

  const ticker: TickerEntry[] = upcoming.slice(0, 12).map(x => ({
    seriesName: x.seriesName,
    seriesColor: x.seriesColor,
    title: x.session.title,
    start: x.session.start,
    dateOnly: x.session.dateOnly,
  }));

  const roundLookup = buildRoundLookupAcrossSeries(all, now);
  const heroSessions: HeroSession[] = upcoming.slice(0, 6).map(x => {
    const round = roundFor(roundLookup, x.seriesSlug, x.session.uid);
    return {
      seriesSlug: x.seriesSlug,
      seriesName: x.seriesName,
      seriesColor: x.seriesColor,
      title: x.session.title,
      start: x.session.start,
      end: x.session.end,
      location: x.session.location,
      dateOnly: x.session.dateOnly,
      weekendHref: round ? `/series/${x.seriesSlug}/weekend/${round}` : undefined,
    };
  });

  const stats = {
    series: all.length,
    sessions: flat.length,
    races: all.reduce((acc, s) => acc + groupByWeekend(s.sessions, now).length, 0),
    drivers: drivers.length,
  };

  const seriesList = all.map(s => s.meta);

  return (
    <>
      <StandaloneRedirect />
      <JsonLd data={organizationLd()} />
      <JsonLd data={websiteLd()} />

      <TickerBar entries={ticker} now={now} />
      <LandingNav />
      <main>
        <Hero sessions={heroSessions} now={now} />
        <SeriesStrip seriesList={seriesList} />
        <StatsBand stats={stats} />
        <FeatureBlocks />
        <DisciplinesGrid seriesList={seriesList} />
        <PerksCta />
      </main>
      <LandingFooter seriesList={seriesList} />
    </>
  );
}
