import 'server-only';
import { loadAllSeriesMeta } from '../series';
import {
  loadCuratedChampions,
  loadChampionNotes,
  loadRecordNotes,
  type ChampionNote,
  type RecordNote,
} from '../series-content';
import { slugify } from '../slug';
import { topicForSeries } from './topics';
import type { InfoEntry, InfoSource } from './types';
import type { Champion, SeriesMeta } from '../types';

// Q&A entries generated from our OWN curated, already-fact-checked champions
// data (content/series/<slug>/champions.json). Every fact here traces to a
// vetted repo file — so these are `verified`. They give the section genuine
// scale (hundreds of pages) with zero fabrication risk. Since 2026-07-31 every
// champion page ships featured (indexable) — see the note at the loop that builds
// them. The record pages stay gated on hasStableName(), which is a factual guard,
// not an indexing one: F2/F3 were rebranded from GP2/GP3, so a "most titles"
// aggregate for them would silently mix two eras.

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

/** The endurance families put a whole crew in one `driver` string — "James
 *  Calado, Antonio Giovinazzi, Alessandro Pier Guidi" — and NLS and the shared
 *  1996 IndyCar title use slashes. Counting titles by that whole string treats a
 *  crew as a person, which published a false claim on every WEC page: the 2019
 *  answer read "It was Sébastien Buemi, Fernando Alonso, Kazuki Nakajima's FIRST
 *  FIA WEC title" when Buemi had already won in 2014 with a different crew, and
 *  the all-time record read "2 titles" shared between two crews when Buemi and
 *  Hartley had four each. So: split, and count people.
 *
 *  Verified against all 15 curated `champions.json` files — 145 crew rows across
 *  six families — that no individual name contains a comma or a slash, so this
 *  split cannot cut a name in half. */
export function driversOf(driverField: string): string[] {
  return driverField
    .split(/\s*[,/]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// 1 → "1st", 2 → "2nd", 3 → "3rd", 11 → "11th"…
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

// Sources shared by every generated entry for a series: our curated records +
// the series' own Wikipedia champions page + official site. All from meta.json,
// so never fabricated.
/** "www.formula1.com/en/latest/..." → "formula1.com". Falls back to the raw
 *  string if the URL is unparseable, so a malformed entry can never throw during
 *  generation. */
function sourceLabel(url: string): string {
  try {
    const u = new URL(url);
    const host = u.host.replace(/^www\./, '');
    // A bare host is the right label for a one-off news URL, but an entry citing
    // two different Wikipedia articles rendered them as "en.wikipedia.org" twice,
    // which reads as the same link listed twice rather than two sources. Name the
    // article for those (2026-08-27, found by looking at the DTM record page).
    if (/(^|\.)wikipedia\.org$/.test(host) && u.pathname.startsWith('/wiki/')) {
      const raw = u.pathname.slice('/wiki/'.length);
      let title = raw;
      try {
        title = decodeURIComponent(raw);
      } catch {
        // Malformed percent-encoding: the raw path still names the article.
      }
      return `Wikipedia — ${title.replace(/_/g, ' ')}`;
    }
    return host;
  } catch {
    return url;
  }
}

/** The label for a note's lead clause comes from the DATA, not from this file:
 *  whichever of the three lead fields is set decides it. `clinched` is the
 *  default and what every note written to date uses; `season` exists for
 *  championships whose deciding round no source records (pre-1990, mostly), so
 *  the page can say what the season was instead of inventing a round; `race`
 *  exists for the single-race families (ADAC 24h, NLS) where a title clause is
 *  meaningless. Returns null for a note with no lead clause, which the integrity
 *  gate rejects, so this is belt-and-braces rather than a supported state. */
export function noteLead(note: ChampionNote): { label: string; text: string } | null {
  if (note.clinched?.trim()) return { label: 'Title clinched', text: note.clinched.trim() };
  if (note.season?.trim()) return { label: 'The season', text: note.season.trim() };
  if (note.race?.trim()) return { label: 'The race', text: note.race.trim() };
  return null;
}

/** The authored enrichment for a record page. Everything the two record
 *  generators produce is derived from champions.json, so all 23 of those pages
 *  read as one page with the names swapped — at 42–81 rendered words the
 *  thinnest cohort on the site when it was measured (2026-08-27). This is the
 *  part that says what the data cannot: when the record was set and what it
 *  displaced, who is closest, and what would have to happen for it to change.
 *
 *  Placed AFTER the derived lines but BEFORE the "Based on our curated…"
 *  provenance footer, which reads as the end of the page (operator decision,
 *  2026-08-27; the who-won entry has no such footer, so "append last" there and
 *  here are not the same position). No note → no lines, and the page renders
 *  byte-identically to what it did. */
function recordNoteLines(note: RecordNote | undefined): string[] {
  if (!note) return [];
  const out: string[] = [];
  const lead = note.lead?.trim();
  if (lead) out.push(`**The record:** ${lead}.`);
  const body = note.note?.trim();
  if (body) out.push(body);
  return out;
}

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
  note?: ChampionNote,
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
  // Title context — which number title this was for each person who won it, and
  // how that sits against the all-time series record. Counted PER DRIVER, which
  // for the crew families is the whole point: see driversOf.
  const winners = driversOf(champ.driver);
  const yearsFor = (driver: string) =>
    all
      .filter((c) => driversOf(c.driver).includes(driver))
      .map((c) => c.year)
      .sort((a, b) => a - b);
  if (winners.length === 1) {
    // Single-driver seasons keep their exact previous wording: 166 authored notes
    // were written to sit under this sentence.
    const driverYears = yearsFor(winners[0]);
    const nth = driverYears.indexOf(champ.year) + 1;
    lines.push(
      driverYears.length > 1
        ? `It was **${champ.driver}**’s ${ordinal(nth)} of ${driverYears.length} ${name} titles (${driverYears.join(', ')}).`
        : `It was **${champ.driver}**’s first ${name} title.`,
    );
  } else {
    const firsts: string[] = [];
    const repeats: string[] = [];
    for (const driver of winners) {
      const years = yearsFor(driver);
      if (years.length > 1) {
        repeats.push(
          `**${driver}**’s ${ordinal(years.indexOf(champ.year) + 1)} of ${years.length} (${years.join(', ')})`,
        );
      } else {
        firsts.push(`**${driver}**`);
      }
    }
    // Joined by hand rather than through joinNames: the firsts clause already
    // ends in "and X", so gluing the two with another "and" reads as a stutter
    // ("…for Alonso and Nakajima and Buemi's 2nd of 4").
    const firstsClause = firsts.length ? `a first ${name} title for ${joinNames(firsts)}` : '';
    const repeatsClause = repeats.length ? joinNames(repeats) : '';
    const body =
      firstsClause && repeatsClause
        ? `${firstsClause}, and ${repeatsClause}`
        : firstsClause || repeatsClause;
    lines.push(`It was ${body}.`);
  }
  const driverRecord = topHolders(rankTitles(all, (c) => driversOf(c.driver)));
  if (driverRecord.count >= 2) {
    lines.push(
      `The all-time ${name} ${driversTitleWord(meta)} record is **${driverRecord.count}** titles, ${driverRecord.names.length > 1 ? 'shared by' : 'held by'} **${joinNames(driverRecord.names)}**.`,
    );
  }
  // The authored enrichment, when this season has one: where and when the title
  // was clinched, plus what the season is remembered for. Everything above is
  // derived from champions.json and therefore reads the same shape for every
  // year; this is the part that makes the page about THAT season (the AdSense
  // low-value-content finding, audit 2026-08-20). Appended last so the factual
  // answer still comes first for someone who only wants the name.
  if (note) {
    const lead = noteLead(note);
    if (lead) lines.push(`**${lead.label}:** ${lead.text}.`);
    lines.push(note.note);
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
    // The enrichment's own primary references join the series-level sources, so
    // every clinch claim on the page is traceable to what it was checked
    // against (RULE #1). Labelled by host: these are one-off article URLs
    // rather than a named archive.
    sources: [
      ...seriesSources(meta),
      ...(note?.sources ?? []).map((url) => ({ label: sourceLabel(url), url })),
    ],
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
function rankTitles(champs: Champion[], key: (c: Champion) => string | string[] | undefined) {
  const counts = new Map<string, number>();
  for (const c of champs) {
    const v = key(c);
    for (const name of Array.isArray(v) ? v : v ? [v] : []) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
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
function mostDriverTitlesEntry(
  meta: SeriesMeta,
  champs: Champion[],
  topic: string,
  note?: RecordNote,
): InfoEntry | null {
  const ranked = rankTitles(champs, (c) => driversOf(c.driver));
  if (ranked.length === 0 || ranked[0][1] < 2) return null;
  const [topName, topN] = ranked[0];
  const multi = ranked.filter(([, n]) => n > 1).slice(0, 8);
  const predecessorNote = hasStableName(meta)
    ? ''
    : ' (including its predecessor series)';

  const who = meta.category === 'motorcycle' ? 'riders' : 'drivers';
  // Counted per person, not per crew: "different drivers crowned" means people.
  const distinct = new Set(champs.flatMap((c) => driversOf(c.driver))).size;
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
  lines.push(...recordNoteLines(note));
  lines.push(`Based on our curated ${meta.name} champions, ${span(champs)}.`);

  return {
    kind: 'qa',
    topic,
    slug: slugify(`most-${meta.name}-championships`),
    question: `Who has won the most ${meta.name} championships?`,
    // Scoped to the curated span, as the body's provenance line already is. Four
    // files start long after their championship did (NASCAR 2000, WRC 1979,
    // IndyCar 1996, NLS 2010), so an unqualified summary is an all-time claim the
    // data cannot support — and the summary is the meta description and the hub
    // teaser, which is where a reader meets the claim first.
    summary:
      rec.names.length > 1
        ? `${joinNames(rec.names)} share the record with ${topN} ${meta.name} titles each across ${span(champs)}.`
        : `${topName} holds the record with ${topN} ${meta.name} titles across ${span(champs)}.`,
    keywords: [
      `most ${meta.name} titles`,
      `most ${meta.name} championships`,
      `${meta.name} record champion`,
      topName,
    ],
    bodyMarkdown: lines.join('\n\n'),
    // The note's own primary references join the series-level sources, so every
    // authored claim on the page is traceable (RULE #1), same as whoWonEntry.
    sources: [
      ...seriesSources(meta),
      ...(note?.sources ?? []).map((url) => ({ label: sourceLabel(url), url })),
    ],
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

function mostConstructorTitlesEntry(
  meta: SeriesMeta,
  champs: Champion[],
  topic: string,
  note?: RecordNote,
): InfoEntry | null {
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
  lines.push(...recordNoteLines(note));
  lines.push(`Based on our curated ${meta.name} ${label} champions, ${span(champs)}.`);

  return {
    kind: 'qa',
    topic,
    slug: slugify(`most-successful-${meta.name}-team`),
    question: `Which team has won the most ${meta.name} titles?`,
    // Same scoping as the drivers' record above, for the same reason.
    summary:
      rec.names.length > 1
        ? `${joinNames(rec.names)} share the record with ${topN} ${meta.name} ${label} titles each across ${span(champs)}.`
        : `${topName} leads with ${topN} ${meta.name} ${label} titles across ${span(champs)}.`,
    keywords: [
      `most successful ${meta.name} team`,
      `${meta.name} constructors record`,
      `${meta.name} ${label} champion`,
      topName,
    ],
    bodyMarkdown: lines.join('\n\n'),
    sources: [
      ...seriesSources(meta),
      ...(note?.sources ?? []).map((url) => ({ label: sourceLabel(url), url })),
    ],
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
    // Authored per-season enrichment, wave by wave: absent file or absent year
    // leaves that page exactly as it was (fail-soft, same gate as bios.json).
    const notes = (await loadChampionNotes(meta.slug)) ?? {};
    // The two record pages get their own sidecar, keyed by half rather than by
    // year. Same fail-soft gate: absent file leaves both pages as they were.
    const records = (await loadRecordNotes(meta.slug)) ?? {};
    const topic = topicForSeries(meta.slug, meta.category);

    // A champion page is indexable IFF it has an authored note. One predicate,
    // and because `verified && featured` is the single gate read by the page's
    // robots tag, the sitemap (lib/sitemap-data.ts) and the registry's `indexed`
    // filter, the three cannot drift apart.
    //
    // HISTORY, because this reverses a decision rather than fixing an oversight.
    // 2026-07-31 flipped ALL 488 featured, on the reasoning that they were not
    // thin: shortest body 188 characters, median 316, every fact traced to a
    // vetted champions.json. The AdSense verdict landed FIVE DAYS LATER.
    //
    // Audited on prod 2026-08-25, measuring rendered words rather than source
    // characters, which is what a reviewer sees:
    //   • un-enriched: 67–101 words, 55–66% of the text shared verbatim with
    //     its sibling years
    //   • enriched:   150–160 words, sibling overlap down to 18–19%
    // 443 of the 488 were un-enriched — 35.4% of the ENTIRE index. The pages are
    // individually defensible and collectively a scaled-content signal, and the
    // overlap figure is the part the earlier reasoning had no measurement for.
    //
    // Operator decision, 2026-08-25: noindex the un-enriched, keep enriching in
    // waves, and let each wave flip its own pages back by simply existing. The
    // pages stay LIVE and linked — this removes them from the index, not from the
    // site, exactly as 0.334.8 did for the news tabs.
    for (const c of [...champs].sort((a, b) => b.year - a.year)) {
      const note = notes[String(c.year)];
      out.push(whoWonEntry(meta, c, champs, topic, Boolean(note), note));
    }
    const md = mostDriverTitlesEntry(meta, champs, topic, records.drivers);
    if (md) out.push(md);
    const mc = mostConstructorTitlesEntry(meta, champs, topic, records.teams);
    if (mc) out.push(mc);
  }

  return out;
}
