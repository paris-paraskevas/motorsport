import 'server-only';
import { loadAllSeriesMeta } from '../series';
import { loadCuratedChampions } from '../series-content';
import { slugify } from '../slug';
import { topicForSeries } from './topics';
import type { InfoEntry, InfoSource } from './types';
import type { Champion, SeriesMeta } from '../types';

// Q&A entries generated from our OWN curated, already-fact-checked champions
// data (content/series/<slug>/champions.json). Every fact here traces to a
// vetted repo file — so these are `verified`. They give the section genuine
// scale (hundreds of pages) with zero fabrication risk. Most ship un-featured
// (noindex, on-site-search only); only the current champion + the record pages
// per series are featured (indexable) — see registry.ts.

const WIKI = 'https://en.wikipedia.org/wiki/';
// Curation date. A constant (not new Date()) so build output is deterministic.
const GENERATED_ON = '2026-07-07';

// F2/F3 were rebranded from GP2/GP3; label predecessor-era rows correctly so we
// never claim e.g. a 2010 "Formula 2" champion (it was GP2). Every other series
// keeps a stable name across its curated span.
function seriesNameForYear(meta: SeriesMeta, year: number): string {
  if (meta.slug === 'f2') return year >= 2017 ? 'Formula 2' : 'GP2 Series';
  if (meta.slug === 'f3') return year >= 2019 ? 'Formula 3' : 'GP3 Series';
  return meta.name;
}

// True where the series name is stable across all curated rows — so aggregate
// "most titles" pages aren't mixing rebranded eras under one label.
function hasStableName(meta: SeriesMeta): boolean {
  return meta.slug !== 'f2' && meta.slug !== 'f3';
}

// The correct label for the second championship, per discipline.
function secondTitleLabel(meta: SeriesMeta): string {
  if (meta.slug === 'f1' || meta.slug === 'indycar') return 'constructors’';
  if (meta.category === 'formula') return 'teams’'; // F2, F3, Formula E
  return 'manufacturers’'; // motorcycle, rally, endurance, gt, stock
}

const driversTitleWord = (meta: SeriesMeta) =>
  meta.category === 'motorcycle' ? 'riders’' : 'drivers’';

// 1 → "1st", 2 → "2nd", 3 → "3rd", 11 → "11th"…
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

// Sources shared by every generated entry for a series: our curated records +
// the series' own Wikipedia champions page + official site. All from meta.json,
// so never fabricated.
function seriesSources(meta: SeriesMeta): InfoSource[] {
  const out: InfoSource[] = [{ label: 'Paddock curated championship records' }];
  if (meta.championsPage) {
    out.push({ label: `Wikipedia — ${meta.name} champions`, url: WIKI + meta.championsPage });
  } else if (meta.wikipediaPage) {
    out.push({ label: `Wikipedia — ${meta.name}`, url: WIKI + meta.wikipediaPage });
  }
  if (meta.officialSite) out.push({ label: `${meta.name} official site`, url: meta.officialSite });
  return out;
}

function whoWonEntry(
  meta: SeriesMeta,
  champ: Champion,
  all: Champion[],
  topic: string,
  featured: boolean,
): InfoEntry {
  const name = seriesNameForYear(meta, champ.year);
  const question = `Who won the ${champ.year} ${name} championship?`;
  const slug = slugify(`who-won-the-${champ.year}-${name}-championship`);
  const teamWith = champ.constructor ? ` with ${champ.constructor}` : '';
  const summary = `${champ.driver} won the ${champ.year} ${name} championship${teamWith}.`;

  const lines: string[] = [];
  const teamRacing = champ.constructor ? `, racing for **${champ.constructor}**` : '';
  const pointsClause =
    typeof champ.points === 'number' ? `, clinching the title on **${champ.points}** points` : '';
  lines.push(
    `**${champ.driver}** won the ${champ.year} ${name} ${driversTitleWord(meta)} championship${teamRacing}${pointsClause}.`,
  );
  if (champ.constructorChampion) {
    const label = secondTitleLabel(meta);
    lines.push(
      champ.constructorChampion === champ.constructor
        ? `**${champ.constructorChampion}** also took the ${label} championship that season.`
        : `The ${label} championship went to **${champ.constructorChampion}**.`,
    );
  }
  if (champ.secondaryDriver) {
    const sTeam = champ.secondaryTeam ? ` (${champ.secondaryTeam})` : '';
    lines.push(
      `In the ${champ.secondaryLabel ?? 'secondary championship'}, **${champ.secondaryDriver}**${sTeam} was champion.`,
    );
  }
  // Title context for this driver — which number title this was, and how it sits
  // against the all-time series record. All exact-name matches on our curated
  // data, so every claim is a true, sourced fact.
  const driverYears = all
    .filter((c) => c.driver === champ.driver)
    .map((c) => c.year)
    .sort((a, b) => a - b);
  const nth = driverYears.indexOf(champ.year) + 1;
  lines.push(
    driverYears.length > 1
      ? `It was **${champ.driver}**’s ${ordinal(nth)} of ${driverYears.length} ${name} titles (${driverYears.join(', ')}).`
      : `It was **${champ.driver}**’s first ${name} title.`,
  );
  const driverRecord = topHolders(rankTitles(all, (c) => c.driver));
  if (driverRecord.count >= 2) {
    lines.push(
      `The all-time ${name} ${driversTitleWord(meta)} record is **${driverRecord.count}** titles, ${driverRecord.names.length > 1 ? 'shared by' : 'held by'} **${joinNames(driverRecord.names)}**.`,
    );
  }

  return {
    kind: 'qa',
    topic,
    slug,
    question,
    summary,
    keywords: [
      `${champ.year} ${name} champion`,
      `who won ${champ.year} ${name}`,
      `${name} ${champ.year}`,
      champ.driver,
    ],
    bodyMarkdown: lines.join('\n\n'),
    sources: seriesSources(meta),
    related: [
      { label: `${meta.name} — all champions`, href: `/series/${meta.slug}/champions` },
      { label: `${meta.name} history`, href: `/information/${topic}/the-history-of-${meta.slug}` },
      { label: `${meta.name} home`, href: `/series/${meta.slug}` },
    ],
    review: 'verified',
    featured,
    updated: GENERATED_ON,
  };
}

// Rank a field's title counts; returns [name, count] sorted desc, count-first.
function rankTitles(champs: Champion[], key: (c: Champion) => string | undefined) {
  const counts = new Map<string, number>();
  for (const c of champs) {
    const v = key(c);
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function span(champs: Champion[]): string {
  const years = champs.map((c) => c.year);
  return `${Math.min(...years)}–${Math.max(...years)}`;
}

// Everyone tied at the top of a ranking — so shared records are stated honestly
// (e.g. Hamilton AND Schumacher on 7 F1 titles, not just the first alphabetically).
function topHolders(ranked: Array<[string, number]>): { names: string[]; count: number } {
  if (ranked.length === 0) return { names: [], count: 0 };
  const count = ranked[0][1];
  return { names: ranked.filter(([, n]) => n === count).map(([n]) => n), count };
}
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// "Who has won the most X championships?" — only when the record-holder has ≥2
// (otherwise the page is meaningless, e.g. endurance crews that never repeat).
function mostDriverTitlesEntry(meta: SeriesMeta, champs: Champion[], topic: string): InfoEntry | null {
  const ranked = rankTitles(champs, (c) => c.driver);
  if (ranked.length === 0 || ranked[0][1] < 2) return null;
  const [topName, topN] = ranked[0];
  const multi = ranked.filter(([, n]) => n > 1).slice(0, 8);
  const predecessorNote = hasStableName(meta)
    ? ''
    : ' (including its predecessor series)';

  const who = meta.category === 'motorcycle' ? 'riders' : 'drivers';
  const distinct = new Set(champs.map((c) => c.driver)).size;
  const rec = topHolders(ranked);
  const lines = [
    rec.names.length > 1
      ? `**${joinNames(rec.names)}** share the record for the most ${meta.name} ${driversTitleWord(meta)} titles, with **${topN}** each${predecessorNote}.`
      : `**${topName}** has won the most ${meta.name} ${driversTitleWord(meta)} titles, with **${topN}**${predecessorNote}.`,
    `Across ${span(champs)}, ${distinct} different ${who} have been crowned ${meta.name} champion.`,
  ];
  if (multi.length > 1) {
    lines.push('Drivers with multiple titles:');
    lines.push(multi.map(([n, c]) => `- **${n}** — ${c}`).join('\n'));
  }
  lines.push(`Based on our curated ${meta.name} champions, ${span(champs)}.`);

  return {
    kind: 'qa',
    topic,
    slug: slugify(`most-${meta.name}-championships`),
    question: `Who has won the most ${meta.name} championships?`,
    summary:
      rec.names.length > 1
        ? `${joinNames(rec.names)} share the record with ${topN} ${meta.name} titles each.`
        : `${topName} holds the record with ${topN} ${meta.name} titles.`,
    keywords: [
      `most ${meta.name} titles`,
      `most ${meta.name} championships`,
      `${meta.name} record champion`,
      topName,
    ],
    bodyMarkdown: lines.join('\n\n'),
    sources: seriesSources(meta),
    related: [
      { label: `${meta.name} — all champions`, href: `/series/${meta.slug}/champions` },
      { label: `${meta.name} history`, href: `/information/${topic}/the-history-of-${meta.slug}` },
      { label: `${meta.name} home`, href: `/series/${meta.slug}` },
    ],
    review: 'verified',
    featured: hasStableName(meta),
    updated: GENERATED_ON,
  };
}

function mostConstructorTitlesEntry(meta: SeriesMeta, champs: Champion[], topic: string): InfoEntry | null {
  const ranked = rankTitles(champs, (c) => c.constructorChampion);
  if (ranked.length === 0 || ranked[0][1] < 2) return null;
  const [topName, topN] = ranked[0];
  const label = secondTitleLabel(meta).replace('’', '');
  const multi = ranked.filter(([, n]) => n > 1).slice(0, 8);

  const distinct = new Set(champs.map((c) => c.constructorChampion).filter(Boolean)).size;
  const rec = topHolders(ranked);
  const lines = [
    rec.names.length > 1
      ? `**${joinNames(rec.names)}** share the record for the most ${meta.name} ${label} championships, with **${topN}** each.`
      : `**${topName}** has won the most ${meta.name} ${label} championships, with **${topN}**.`,
    `Across ${span(champs)}, the ${meta.name} ${label} title has gone to ${distinct} different ${label}.`,
  ];
  if (multi.length > 1) {
    lines.push('Most successful:');
    lines.push(multi.map(([n, c]) => `- **${n}** — ${c}`).join('\n'));
  }
  lines.push(`Based on our curated ${meta.name} ${label} champions, ${span(champs)}.`);

  return {
    kind: 'qa',
    topic,
    slug: slugify(`most-successful-${meta.name}-team`),
    question: `Which team has won the most ${meta.name} titles?`,
    summary:
      rec.names.length > 1
        ? `${joinNames(rec.names)} share the record with ${topN} ${meta.name} ${label} titles each.`
        : `${topName} leads with ${topN} ${meta.name} ${label} titles.`,
    keywords: [
      `most successful ${meta.name} team`,
      `${meta.name} constructors record`,
      `${meta.name} ${label} champion`,
      topName,
    ],
    bodyMarkdown: lines.join('\n\n'),
    sources: seriesSources(meta),
    related: [
      { label: `${meta.name} — all champions`, href: `/series/${meta.slug}/champions` },
      { label: `${meta.name} history`, href: `/information/${topic}/the-history-of-${meta.slug}` },
      { label: `${meta.name} home`, href: `/series/${meta.slug}` },
    ],
    review: 'verified',
    featured: hasStableName(meta),
    updated: GENERATED_ON,
  };
}

/** All verified Q&A generated from curated champions data, across every series
 *  that has a champions.json. Deterministic order (series slug, then year desc). */
export async function generateInfoEntries(): Promise<InfoEntry[]> {
  const metas = (await loadAllSeriesMeta()).sort((a, b) => a.slug.localeCompare(b.slug));
  const out: InfoEntry[] = [];

  for (const meta of metas) {
    const champs = await loadCuratedChampions(meta.slug);
    if (!champs || champs.length === 0) continue;
    const topic = topicForSeries(meta.slug, meta.category);
    const maxYear = Math.max(...champs.map((c) => c.year));

    for (const c of [...champs].sort((a, b) => b.year - a.year)) {
      out.push(whoWonEntry(meta, c, champs, topic, c.year === maxYear));
    }
    const md = mostDriverTitlesEntry(meta, champs, topic);
    if (md) out.push(md);
    const mc = mostConstructorTitlesEntry(meta, champs, topic);
    if (mc) out.push(mc);
  }

  return out;
}
