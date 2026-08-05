import { describe, it, expect } from 'vitest';
import { buildSitemapEntries } from './sitemap-data';
import { TRACKS_TAB_SLUGS } from './tabs';
import { loadSeries, loadAllSeriesMeta } from './series';
import { loadDriverBios } from './series-content';
import { loadAllDrivers } from './people';
import { groupByWeekend } from './group';
import { weekendLabel } from './weekend';
import { circuitLayoutFor } from './circuit-layout';
import { listPostSlugs } from './posts';
import { SITE_URL } from './site';

describe('buildSitemapEntries', () => {
  it('emits the home URL without a trailing slash (matches metadataBase)', async () => {
    const urls = await buildSitemapEntries();
    expect(urls[0]?.url).toBe(SITE_URL);
  });

  it('includes all 15 series index pages', async () => {
    const urls = await buildSitemapEntries();
    const seriesUrls = urls.filter((u) => /\/series\/[^/]+$/.test(u.url));
    expect(seriesUrls).toHaveLength(15);
  });

  it('F1 has 23 weekend URLs in 2026 (Saudi cancelled; Bahrain back, rescheduled at Sepang)', async () => {
    // 24 original rounds - Saudi (cancelled) - Bahrain (cancelled) = 22 until
    // 0.245.2 restored Bahrain as round 16 at Sepang (2-4 Oct) → 23. Stale-guard:
    // if this fails, re-check content/series/f1/rounds.json before touching it.
    const urls = await buildSitemapEntries();
    const f1Weekends = urls.filter((u) => u.url.includes('/series/f1/weekend/'));
    expect(f1Weekends).toHaveLength(23);
  });

  it('Formula E emits all 17 weekend URLs (doubleheader race 2s split into their own weekends)', async () => {
    // Before the 1b-2 fix the sitemap listed 17 FE rounds from rounds.json
    // while the pages only resolved 11 — six advertised URLs 404'd. Both
    // sides now derive from groupByWeekend, so this asserts page reality.
    const urls = await buildSitemapEntries();
    const feWeekends = urls.filter((u) => u.url.includes('/series/formula-e/weekend/'));
    expect(feWeekends).toHaveLength(17);
  });

  it('emits the Tracks tab URL only for coverage-gated series (today: f1)', async () => {
    const urls = await buildSitemapEntries();
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
    const urls = await buildSitemapEntries();
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
    const urls = await buildSitemapEntries();
    const slugs = urls
      .filter((u) => u.url.startsWith(`${SITE_URL}/drivers/`))
      .map((u) => u.url.split('/').pop()!);
    const curated = new Set((await loadAllDrivers()).map((d) => d.slug));
    for (const slug of slugs) {
      expect(curated.has(slug), `/drivers/${slug} is advertised but resolves to no curated driver`).toBe(true);
    }
  });

  it('every URL starts with SITE_URL', async () => {
    const urls = await buildSitemapEntries();
    for (const u of urls) {
      expect(u.url.startsWith(SITE_URL)).toBe(true);
    }
  });

  it('series index URLs are emitted alphabetically by slug', async () => {
    const urls = await buildSitemapEntries();
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
    const urls = (await buildSitemapEntries()).map((u) => u.url);
    const blogPosts = urls.filter((u) => u.startsWith(`${SITE_URL}/blog/`));
    expect(new Set(blogPosts).size).toBe(blogPosts.length);
    expect(urls).toContain(`${SITE_URL}/blog`);
  });

  it('no entry carries lastModified / changeFrequency / priority (Google ignores all three in 2026)', async () => {
    const urls = await buildSitemapEntries();
    for (const u of urls) {
      expect(u.lastModified).toBeUndefined();
      expect(u.changeFrequency).toBeUndefined();
      expect(u.priority).toBeUndefined();
    }
  });
});
