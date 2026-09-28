import { describe, expect, it } from 'vitest';
import { FAILING, auditPage, familyOf, parseSitemap, summarise, toCsv } from './seo-census.mjs';

// R14 (2026-09-28): the census checks a page the way the Seobility report checked
// the home, and fails the run only where the sitemap contradicts the page.

const page = (opts: { robots?: string; title?: string; description?: string | null; h1s?: number; imgs?: string[]; canonical?: string | null; jsonLd?: boolean; paragraphs?: string[] } = {}) => {
  const title = opts.title ?? 'Formula 1 2026 standings — drivers and constructors';
  const description = opts.description === undefined ? 'Live 2026 Formula 1 standings — the full drivers and constructors championship tables with points, wins and gaps.' : opts.description;
  const h1s = Array.from({ length: opts.h1s ?? 1 }, (_, i) => `<h1>Heading ${i + 1}</h1>`).join('');
  const paragraphs = (opts.paragraphs ?? ['Russell won the opener from pole but only after a virtual safety car split the strategies across the whole field of twenty cars.']).map(p => `<p>${p}</p>`).join('');
  return `<!doctype html><html><head><title>${title}</title>${description === null ? '' : `<meta name="description" content="${description}"/>`}<meta name="robots" content="${opts.robots ?? 'index, follow'}"/>${opts.canonical === null ? '' : `<link rel="canonical" href="${opts.canonical ?? 'https://paddock-tracker.com/series/f1/standings'}"/>`}${opts.jsonLd === false ? '' : '<script type="application/ld+json">{"@type":"WebSite"}</script>'}</head><body><header><nav>Home Series Blog</nav></header><main>${h1s}${(opts.imgs ?? []).join('')}${paragraphs}<p>Short.</p></main></body></html>`;
};
const input = (html: string, extra: Partial<Parameters<typeof auditPage>[0]> = {}) => ({ url: 'https://paddock-tracker.com/series/f1/standings', status: 200, ms: 350, html, ...extra });

describe('auditPage', () => {
  it('finds nothing on a page that answers the way the sitemap says', () => {
    const a = auditPage(input(page()));
    expect(a.findings).toEqual([]);
    expect(a.family).toBe('series/standings');
    expect(a.h1).toBe(1);
    expect(a.sentenceWords).toBe(23);
    expect(a.words).toBeGreaterThan(23);
    expect(a.robots).toBe('index, follow');
  });

  it('fails the run on a sitemap URL that answers noindex, a redirect, a 404 or a 5xx, and on nothing else', () => {
    expect(auditPage(input(page({ robots: 'noindex, follow' }))).findings).toEqual(['noindex-in-sitemap']);
    expect(auditPage(input('', { status: 301, location: 'https://paddock-tracker.com/series/f1' })).findings).toEqual(['redirect:https://paddock-tracker.com/series/f1']);
    expect(auditPage(input('', { status: 404 })).findings).toEqual(['status:404']);
    expect(auditPage(input('', { status: 503 })).findings).toEqual(['status:503']);
    expect([...FAILING].sort()).toEqual(['noindex-in-sitemap', 'redirect', 'status']);
    const reported = auditPage(input(page({ title: 'Short', description: null, h1s: 2, imgs: ['<img src="/a.jpg">', '<img src="/b.jpg" alt="">', '<img src="/c.jpg" alt="A car">'], canonical: 'https://paddock-tracker.com/series/f1', jsonLd: false }), { ms: 2600 }));
    expect(reported.findings).toEqual(['title-length:5', 'description-missing', 'h1-count:2', 'alt-missing:2', 'canonical-other:https://paddock-tracker.com/series/f1', 'jsonld-missing', 'slow:2600']);
    expect(reported.findings.some(f => FAILING.has(f.split(':')[0]))).toBe(false);
  });

  it('measures the title and the description against the widths the SEO check used, and a missing canonical', () => {
    const long = auditPage(input(page({ title: 'A'.repeat(61), description: 'B'.repeat(161), canonical: null })));
    expect(long.findings).toEqual(['title-length:61', 'description-length:161', 'canonical-missing']);
    const fine = auditPage(input(page({ title: 'A'.repeat(30), description: 'B'.repeat(70), canonical: 'https://paddock-tracker.com/series/f1/standings/' })));
    expect(fine.findings).toEqual([]);
    // The home's canonical is the origin, with or without its slash (metadataBase writes it without one).
    for (const canonical of ['https://paddock-tracker.com', 'https://paddock-tracker.com/']) {
      expect(auditPage(input(page({ canonical }), { url: 'https://paddock-tracker.com/' })).findings, canonical).toEqual([]);
    }
  });
});

describe('familyOf and parseSitemap', () => {
  it('names the families the report measured', () => {
    expect(familyOf('/')).toBe('home');
    expect(familyOf('/information/formula-1/who-won-the-2010-formula-1-championship')).toBe('information/who-won-<year>');
    expect(familyOf('/information/tracks/sachsenring')).toBe('information/tracks');
    expect(familyOf('/information/endurance/how-wec-points-work')).toBe('information/how-points-work');
    expect(familyOf('/information/endurance')).toBe('information/topic index');
    expect(familyOf('/series/f1/weekend/15')).toBe('series/weekend');
    expect(familyOf('/series/f1/champions')).toBe('series/champions');
    expect(familyOf('/series/f1')).toBe('series/hub');
    expect(familyOf('/drivers/pierre-gasly')).toBe('drivers');
    expect(familyOf('/blog/f1-baku-2026-practice')).toBe('blog/post');
    expect(familyOf('/authors/paris-paraskevas')).toBe('authors/profile');
    expect(familyOf('/calendar')).toBe('site pages');
  });

  it('reads every loc of a sitemap', () => {
    expect(parseSitemap('<urlset><url><loc>https://paddock-tracker.com</loc></url><url><loc> https://paddock-tracker.com/blog </loc></url></urlset>')).toEqual(['https://paddock-tracker.com', 'https://paddock-tracker.com/blog']);
  });
});

describe('summarise and toCsv', () => {
  it('groups by family with the failing count, the medians and each finding counted once per page', () => {
    const audits = [
      auditPage(input(page())),
      auditPage(input(page({ robots: 'noindex, follow', h1s: 0 }), { url: 'https://paddock-tracker.com/series/f2/standings', ms: 900 })),
      auditPage(input('', { url: 'https://paddock-tracker.com/blog/gone', status: 404 })),
    ];
    const s = summarise(audits);
    expect(s.map(x => x.family)).toEqual(['series/standings', 'blog/post']);
    expect(s[0]).toMatchObject({ pages: 2, failing: 1, medianMs: 900, findings: { 'noindex-in-sitemap': 1, 'h1-count': 1 } });
    expect(s[1]).toMatchObject({ pages: 1, failing: 1, findings: { status: 1 } });
    const csv = toCsv(audits).split('\n');
    expect(csv[0]).toBe('path,family,status,ms,robots,title_length,description_length,h1,images_without_alt,canonical,jsonld,words,sentence_words,findings');
    expect(csv).toHaveLength(4);
    expect(csv[2]).toContain('/series/f2/standings,series/standings,200,900,"noindex, follow"');
    expect(csv[2]).toContain('noindex-in-sitemap; h1-count:0');
  });
});
