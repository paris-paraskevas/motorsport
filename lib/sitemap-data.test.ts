import { describe, it, expect, beforeAll, vi } from 'vitest';
import { buildSitemapEntries, blogLastModified } from './sitemap-data';
import { NOINDEX_TABS, TRACKS_TAB_SLUGS } from './tabs';
import { loadSeries, loadAllSeriesMeta } from './series';
import { hasWeekendNote, loadDriverBios, loadChampionNotes, loadCuratedChampions, loadWeekendNotes } from './series-content';
import { loadAllDrivers } from './people';
import { groupByWeekend } from './group';
import { sessionBySlug, sessionSlug, weekendFor, weekendLabel } from './weekend';
import { circuitLayoutFor } from './circuit-layout';
import { listPostSlugs } from './posts';
import { SITE_URL } from './site';
import { RELEASE_INDEX } from './content-bundle.generated';

// The sitemap is regenerated on the Worker every six hours, where RELEASES.md does not exist (it stays out of the
// content bundle); here every read of the file fails as it does there, and the release pages must still be listed
// from the bundled index (X6 A).
vi.mock('./content-fs', async importOriginal => {
  const actual = await importOriginal<typeof import('./content-fs')>();
  const refuse = (p: unknown) => String(p).replace(/\\/g, '/').endsWith('/RELEASES.md');
  const readFile: typeof actual.readFile = async (p, enc) => {
    if (refuse(p)) throw new Error('RELEASES.md is not on the Worker');
    return actual.readFile(p, enc);
  };
  const readFileSync: typeof actual.readFileSync = (p, enc) => {
    if (refuse(p)) throw new Error('RELEASES.md is not on the Worker');
    return actual.readFileSync(p, enc);
  };
  return { ...actual, readFile, readFileSync, default: { ...actual.default, readFile, readFileSync } };
});

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

  it('advertises a weekend URL only for a round with an authored note (F1: the rounds in weekend-notes.json; a series without notes: none)', async () => {
    // R14 (2026-09-28): the page answers noindex without a note (the weekend
    // route reads hasWeekendNote), and a sitemap that submits a noindex URL earns
    // "Submitted URL marked noindex". Both derive from groupByWeekend, so this
    // still asserts page reality (the 1b-2 lesson: six FE URLs once 404'd).
    const f1 = await loadSeries('f1');
    const notes = await loadWeekendNotes('f1');
    const expected = groupByWeekend(f1.sessions, new Date(), f1.rounds)
      .filter((w) => w.round >= 1 && hasWeekendNote(notes, f1.meta.season, w.round))
      .map((w) => `${SITE_URL}/series/f1/weekend/${w.round}`)
      .sort();
    const f1Weekends = urls.filter((u) => /\/series\/f1\/weekend\/\d+$/.test(u.url)).map((u) => u.url).sort();
    expect(f1Weekends).toEqual(expected);
    expect(expected.length).toBeGreaterThanOrEqual(12); // rounds 1–12 of 2026 carry a note today
    expect(await loadWeekendNotes('formula-e')).toBeNull();
    expect(urls.some((u) => /\/series\/formula-e\/weekend\/\d+$/.test(u.url))).toBe(false);
  });

  it('advertises every session page of a series whose schedule links them (X13): F1 round 1 one URL per session slug, DTM too, NLS none', async () => {
    const f1 = await loadSeries('f1');
    const first = weekendFor(f1, 1);
    expect(first).toBeTruthy();
    const expected = [...new Set(first!.sessions.map((s) => sessionSlug(s.title)))].map((slug) => `${SITE_URL}/series/f1/weekend/1/${slug}`).sort();
    const listed = urls.filter((u) => u.url.startsWith(`${SITE_URL}/series/f1/weekend/1/`)).map((u) => u.url).sort();
    expect(listed).toEqual(expected);
    expect(expected.length).toBeGreaterThanOrEqual(5);
    // Page reality: every listed slug resolves through the session route's own lookup, and no two share a slug.
    const slugs = listed.map((u) => u.slice(`${SITE_URL}/series/f1/weekend/1/`.length));
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(sessionBySlug(first!, slug), slug).not.toBeNull();
    expect(urls.some((u) => /\/series\/dtm\/weekend\/\d+\/[a-z0-9-]+$/.test(u.url))).toBe(true);
    expect(urls.some((u) => /\/series\/nls\/weekend\/\d+\/[a-z0-9-]+$/.test(u.url))).toBe(false);
  });

  it('advertises no tab of the noindex list (news, blog, standings, results, drivers) and keeps every champions tab', async () => {
    for (const key of NOINDEX_TABS) {
      expect(urls.some((u) => new RegExp(`/series/[^/]+/${key}$`).test(u.url)), key).toBe(false);
    }
    const champions = urls.filter((u) => /\/series\/[^/]+\/champions$/.test(u.url));
    expect(champions.length).toBeGreaterThanOrEqual(15);
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

describe('the release pages (X6 A)', () => {
  it('advertises a page for every release of the bundled index right after /changelog, with RELEASES.md unreadable', async () => {
    expect(RELEASE_INDEX.length).toBeGreaterThanOrEqual(16);
    const list = (await buildSitemapEntries()).map(u => u.url);
    const at = list.indexOf(`${SITE_URL}/changelog`);
    expect(at).toBeGreaterThan(0);
    expect(list.slice(at + 1, at + 1 + RELEASE_INDEX.length)).toEqual(RELEASE_INDEX.map(r => `${SITE_URL}/changelog/${r.slug}`));
  }, 120_000);
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

  // Replaced a two-URL spot-check on 2026-08-27, when the enrichment programme
  // finished. The old test hardcoded two ADAC seasons as "un-enriched and must
  // not be advertised", and its own comment said "when the ADAC wave lands, this
  // list is what to update". The wave landed, and there is now no un-enriched
  // season anywhere to point at — the condition it sampled has ceased to exist,
  // so a sample is the wrong instrument for it.
  //
  // What replaces it is stronger, not weaker. The old version checked two URLs;
  // this checks every champions.json row in every series, and it fails the moment
  // somebody adds a season (a new F1 year, say) without writing its note — which
  // is the regression the sample existed to catch, generalised to all 489 rows.
  it('leaves no champions row without a note', async () => {
    const missing: string[] = [];
    for (const meta of await loadAllSeriesMeta()) {
      const [rows, notes] = await Promise.all([
        loadCuratedChampions(meta.slug),
        loadChampionNotes(meta.slug),
      ]);
      for (const row of rows ?? []) {
        if (!notes?.[String(row.year)]) missing.push(`${meta.slug} ${row.year}`);
      }
    }
    expect(missing, `seasons with no champion note: ${missing.join(', ')}`).toEqual([]);
  });

  // The other half of the same guarantee, kept derived: an advertised who-won URL
  // must name a year that some note covers. Deliberately NOT compared against the
  // registry, which is what builds the sitemap — that would only prove the sitemap
  // agrees with itself.
  it('advertises no who-won page for a year with no note anywhere', async () => {
    const noted = new Set<string>();
    for (const meta of await loadAllSeriesMeta()) {
      const notes = await loadChampionNotes(meta.slug);
      for (const year of Object.keys(notes ?? {})) noted.add(year);
    }
    const advertised = all.map((u) => u.url).filter((u) => /\/information\/[^/]+\/who-won-/.test(u));
    expect(advertised.length).toBeGreaterThan(0);
    for (const url of advertised) {
      const year = /who-won-the-(\d{4})-/.exec(url)?.[1];
      expect(year, `${url}: no year in slug`).toBeTruthy();
      expect(noted.has(year!), `${url} is advertised but no note covers ${year}`).toBe(true);
    }
  });
});
