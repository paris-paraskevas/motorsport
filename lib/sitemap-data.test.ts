import { describe, it, expect, beforeAll } from 'vitest';
import { buildSitemapEntries, blogLastModified } from './sitemap-data';
import { TRACKS_TAB_SLUGS } from './tabs';
import { loadSeries, loadAllSeriesMeta } from './series';
import { loadDriverBios, loadChampionNotes } from './series-content';
import { loadAllDrivers } from './people';
import { groupByWeekend } from './group';
import { weekendLabel } from './weekend';
import { circuitLayoutFor } from './circuit-layout';
import { listPostSlugs } from './posts';
import { SITE_URL } from './site';

describe('buildSitemapEntries', () => {
  // ONE call, shared. buildSitemapEntries() takes no arguments and is
  // deterministic, but it walks the entire content tree, so calling it per test
  // meant eleven full walks against vitest's 5 s per-test budget. Under load
  // (the rest of the suite in parallel) each call blew that budget and the file
  // failed a DIFFERENT subset every run — 4, then 2, then 3 — always with
  // "Test timed out in 5000ms" and never an assertion. It took 26.8 s for 17
  // tests while passing in isolation, which is what made it read as flake
  // rather than as cost. No assertion is changed by this; the hook gets an
  // explicit budget while every test keeps the default, so a genuine slowdown
  // inside an assertion still fails the way it should.
  let urls!: Awaited<ReturnType<typeof buildSitemapEntries>>;
  beforeAll(async () => {
    urls = await buildSitemapEntries();
  }, 120_000);

  it('emits the home URL without a trailing slash (matches metadataBase)', async () => {
    expect(urls[0]?.url).toBe(SITE_URL);
  });

  it('includes all 15 series index pages', async () => {
    const seriesUrls = urls.filter((u) => /\/series\/[^/]+$/.test(u.url));
    expect(seriesUrls).toHaveLength(15);
  });

  it('F1 has 23 weekend URLs in 2026 (Saudi cancelled; Bahrain back, rescheduled at Sepang)', async () => {
    // 24 original rounds - Saudi (cancelled) - Bahrain (cancelled) = 22 until
    // 0.245.2 restored Bahrain as round 16 at Sepang (2-4 Oct) → 23. Stale-guard:
    // if this fails, re-check content/series/f1/rounds.json before touching it.
    const f1Weekends = urls.filter((u) => u.url.includes('/series/f1/weekend/'));
    expect(f1Weekends).toHaveLength(23);
  });

  it('Formula E emits all 17 weekend URLs (doubleheader race 2s split into their own weekends)', async () => {
    // Before the 1b-2 fix the sitemap listed 17 FE rounds from rounds.json
    // while the pages only resolved 11 — six advertised URLs 404'd. Both
    // sides now derive from groupByWeekend, so this asserts page reality.
    const feWeekends = urls.filter((u) => u.url.includes('/series/formula-e/weekend/'));
    expect(feWeekends).toHaveLength(17);
  });

  it('emits the Tracks tab URL only for coverage-gated series (today: f1)', async () => {
    const trackUrls = urls
      .filter((u) => /\/series\/[^/]+\/tracks$/.test(u.url))
      .map((u) => u.url);
    expect(trackUrls).toEqual(
      TRACKS_TAB_SLUGS.map((slug) => `${SITE_URL}/series/${slug}/tracks`),
    );
  });

  it('every Tracks-tab series has real circuit-layout coverage (gate sync)', async () => {
    // TRACKS_TAB_SLUGS is a static list (lib/tabs is client- and
    // middleware-bundled, so it can't fs-check content/circuits-layout.json
    // itself). This test IS the sync: a slug may only be listed while most of
    // its season resolves a curated layout via the same resolver the tab uses.
    const now = new Date();
    for (const slug of TRACKS_TAB_SLUGS) {
      const series = await loadSeries(slug);
      const weekends = groupByWeekend(series.sessions, now, series.rounds).filter(
        (w) => w.round >= 1,
      );
      expect(weekends.length).toBeGreaterThan(0);
      const layouts = await Promise.all(
        weekends.map((w) =>
          circuitLayoutFor(
            w.sessions.find((s) => s.location)?.location,
            weekendLabel(w, w.round).title,
          ),
        ),
      );
      const covered = layouts.filter(Boolean).length;
      expect(covered / weekends.length).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('advertises exactly the bio-backed /drivers/* pages, and no /teams/* (thin-page gate)', async () => {
    // The gate: a /drivers/<slug> URL is advertised IFF a bios.json across any
    // series carries that key. Derived from the same files the sitemap reads,
    // so this holds as bios are authored without pinning a count. /teams/*
    // stays out until team pages carry an equivalent depth mechanism. (The
    // pre-0.257 version of this test pinned both trees OUT with a "they 404
    // today" comment — stale; both resolve on prod since the drivers.json era.)
    const advertised = urls
      .filter((u) => u.url.startsWith(`${SITE_URL}/drivers/`))
      .map((u) => u.url)
      .sort();
    const bioSlugs = new Set<string>();
    for (const meta of await loadAllSeriesMeta()) {
      for (const key of Object.keys(await loadDriverBios(meta.slug))) bioSlugs.add(key);
    }
    expect(advertised).toEqual([...bioSlugs].sort().map((s) => `${SITE_URL}/drivers/${s}`));
    expect(bioSlugs.size).toBeGreaterThanOrEqual(2); // hamilton + alonso seeded the sidecar
    expect(urls.some((u) => u.url.startsWith(`${SITE_URL}/teams/`))).toBe(false);
  });

  it('every advertised /drivers/* slug resolves to a curated driver (no 404s advertised)', async () => {
    // The FE doubleheader lesson (audit 3-6) applied to driver pages: a bios.json
    // key that matches no curated driver would advertise a 404 — this catches a
    // typo'd or stale bio key the moment it lands. One loadAllDrivers scan + set
    // membership, NOT findDriverBySlug per slug — the per-slug version re-read
    // every series file per lookup and pushed the suite past its timeout once the
    // advertised set grew past ~100 (session 27).
    const slugs = urls
      .filter((u) => u.url.startsWith(`${SITE_URL}/drivers/`))
      .map((u) => u.url.split('/').pop()!);
    const curated = new Set((await loadAllDrivers()).map((d) => d.slug));
    for (const slug of slugs) {
      expect(curated.has(slug), `/drivers/${slug} is advertised but resolves to no curated driver`).toBe(true);
    }
  });

  it('every URL starts with SITE_URL', async () => {
    for (const u of urls) {
      expect(u.url.startsWith(SITE_URL)).toBe(true);
    }
  });

  it('series index URLs are emitted alphabetically by slug', async () => {
    const seriesSlugs = urls
      .filter((u) => /\/series\/[^/]+$/.test(u.url))
      .map((u) => u.url.split('/').pop()!);
    const sorted = [...seriesSlugs].sort((a, b) => a.localeCompare(b));
    expect(seriesSlugs).toEqual(sorted);
  });

  // The legacy MDX posts were retired in 0.249.0 (operator call: their pages
  // stopped rendering on the Cloudflare runtime, so the cards linked to broken
  // URLs). This pins content/posts EMPTY — the blog SOP forbids new MDX posts
  // (they auto-publish on merge, unsigned); if one legitimately returns, it must
  // also be re-added to the sitemap assertions here.
  it('carries no legacy MDX blog posts (retired 0.249.0; DB posts are the blog)', async () => {
    const slugs = await listPostSlugs();
    expect(slugs).toHaveLength(0);
  });

  it('emits each blog URL once and keeps /blog itself', async () => {
    const hrefs = urls.map((u) => u.url);
    const blogPosts = hrefs.filter((u) => u.startsWith(`${SITE_URL}/blog/`));
    expect(new Set(blogPosts).size).toBe(blogPosts.length);
    expect(hrefs).toContain(`${SITE_URL}/blog`);
  });

  // NARROWED in 0.334.22, deliberately, not to make anything pass. The previous
  // assertion was "no entry carries lastModified", on the reasoning that we had
  // no verifiable per-page change timestamp. DB blog posts now do (`updated_at`),
  // so they are the one exception. Everything else is unchanged, and
  // changeFrequency / priority remain banned outright — Google ignores both.
  //
  // Note this suite runs with Supabase unconfigured, so `publishedPosts()`
  // fail-softs to [] and no blog entry gets a stamp here. That is why the
  // non-blog assertion below is the real guard, and why the mapping itself is
  // covered separately in the unit test underneath.
  it('only blog URLs may carry lastModified; nothing carries changeFrequency or priority', async () => {
    for (const u of urls) {
      if (!u.url.startsWith(`${SITE_URL}/blog/`)) {
        expect(u.lastModified).toBeUndefined();
      }
      expect(u.changeFrequency).toBeUndefined();
      expect(u.priority).toBeUndefined();
    }
  });
});

describe('blogLastModified', () => {
  const iso = '2026-08-24T06:30:00.000Z';

  it('prefers updated_at, because that is what moves when a post is corrected', () => {
    expect(
      blogLastModified({ updatedAt: iso, publishedAt: '2026-01-01T00:00:00Z', createdAt: '2025-01-01T00:00:00Z' }),
    ).toBe(iso);
  });

  it('falls back to published, then created', () => {
    expect(blogLastModified({ updatedAt: null, publishedAt: iso, createdAt: '2025-01-01T00:00:00Z' })).toBe(iso);
    expect(blogLastModified({ updatedAt: null, publishedAt: null, createdAt: iso })).toBe(iso);
  });

  it('returns null rather than a guess when there is no usable stamp', () => {
    expect(blogLastModified({})).toBeNull();
    expect(blogLastModified({ updatedAt: null, publishedAt: null, createdAt: null })).toBeNull();
    expect(blogLastModified({ updatedAt: 'not a date' })).toBeNull();
  });

  it('normalises to ISO so the emitted lastmod is well-formed', () => {
    expect(blogLastModified({ updatedAt: '2026-08-24 06:30:00+00' })).toBe(iso);
  });
});

// AdSense low-value-content gate, added 0.334.43 (operator decision 2026-08-25).
//
// A "who won the YYYY X championship" page is indexable IFF a curated note for
// that season exists in content/series/<slug>/champion-notes.json. Audited on
// prod: un-enriched pages render 67-101 words with 55-66% of their text shared
// verbatim with sibling years, while enriched ones reach 150-160 words at 18-19%
// overlap. 443 of 488 were un-enriched, which was 35.4% of the whole index.
//
// This test is DERIVED, not pinned to a number, so each enrichment wave flips its
// own pages indexable and the assertion keeps holding without an edit.
describe('who-won pages are advertised only when enriched', () => {
  // Its own call: `urls` above is scoped to the other describe block.
  let all!: Awaited<ReturnType<typeof buildSitemapEntries>>;
  beforeAll(async () => {
    all = await buildSitemapEntries();
  }, 120_000);

  it('advertises exactly the note-backed seasons, and no others', async () => {
    const advertised = all
      .map((u) => u.url)
      .filter((u) => /\/information\/[^/]+\/who-won-/.test(u));

    let authored = 0;
    for (const meta of await loadAllSeriesMeta()) {
      const notes = await loadChampionNotes(meta.slug);
      authored += notes ? Object.keys(notes).length : 0;
    }

    expect(authored).toBeGreaterThan(0); // the waves exist; a zero here is a bug
    expect(advertised).toHaveLength(authored);
  });

  it('advertises no un-enriched season (spot-check across series)', () => {
    const advertised = new Set(all.map((u) => u.url));
    // Seasons with no note as of the 0.334.43 audit. If a later wave enriches
    // one, this list is what to update - deliberately explicit rather than
    // derived, so re-indexing a page stays a visible decision.
    const shouldBeAbsent = [
      `${SITE_URL}/information/formula-1/who-won-the-1985-formula-1-championship`,
      `${SITE_URL}/information/endurance/who-won-the-2023-adac-ravenol-24h-nurburgring-championship`,
    ];
    for (const u of shouldBeAbsent) {
      expect(advertised.has(u), `${u} is un-enriched and must not be advertised`).toBe(false);
    }
  });
});
