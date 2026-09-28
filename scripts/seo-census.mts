/**
 * The SEO census (R14, 2026-09-28): every URL of the deployed sitemap fetched and checked the way the Seobility report
 * checked the home, page by page, then summarised by page family. It exits 1 on a contradiction a single-page check can
 * never see: a sitemap URL that answers noindex, a redirect, a 404 or a 5xx. The other findings are reported, not failing.
 *
 *   npx tsx scripts/seo-census.mts                                      # against https://paddock-tracker.com
 *   npx tsx scripts/seo-census.mts --site https://testing.paddock-tracker.com
 *   npx tsx scripts/seo-census.mts --out .seo-census                    # the CSV and the summary go there (the default)
 *   npx tsx scripts/seo-census.mts --limit 50                           # the first fifty URLs, a smoke run
 *
 * The raw HTML under-counts the words of the families whose tables stream in (drivers, series tabs, weekends): the
 * sentence-words column counts the paragraphs of fifteen words or more in the HTML as sent, exact for the static families
 * and a floor for the streamed ones; a browser measures those (docs/perf-baselines.md, 2026-09-28).
 */
import fs from 'node:fs';
import path from 'node:path';
import { basename } from 'node:path';

export interface PageInput {
  url: string;
  status: number;
  /** The Location of a 3xx answer, when the page redirected instead of answering. */
  location?: string | null;
  ms: number;
  html: string;
}

export interface PageAudit {
  url: string;
  path: string;
  family: string;
  status: number;
  ms: number;
  robots: string;
  title: string;
  description: string;
  h1: number;
  images: number;
  imagesWithoutAlt: number;
  canonical: string;
  jsonLd: number;
  words: number;
  sentenceWords: number;
  findings: string[];
}

/** The findings that fail the run: the sitemap contradicts what the page answers. */
export const FAILING = new Set(['noindex-in-sitemap', 'redirect', 'status']);

/** Enough of an XML parser for a sitemap, which is a flat urlset of locs. */
export function parseSitemap(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
}

/** The page family, the unit the AdSense question is asked in (the report of 2026-09-28). */
export function familyOf(pathname: string): string {
  const p = pathname.split('/').filter(Boolean);
  if (p.length === 0) return 'home';
  if (p[0] === 'information') {
    const slug = p[2] ?? '';
    if (!p[2]) return !p[1] || p[1] === 'series-guides' || p[1] === 'map' ? 'information/hub' : 'information/topic index';
    if (p[1] === 'tracks') return 'information/tracks';
    if (/^who-won-the-\d{4}/.test(slug)) return 'information/who-won-<year>';
    if (/^who-has-won-the-most|^most-/.test(slug)) return 'information/most';
    if (/^how-.*-points-work$/.test(slug)) return 'information/how-points-work';
    if (/^the-history-of-/.test(slug)) return 'information/the-history-of';
    if (/^how-.*-race-weekend-works$/.test(slug)) return 'information/how-a-weekend-works';
    if (/-rules-explained$/.test(slug)) return 'information/rules-explained';
    return 'information/other';
  }
  if (p[0] === 'series') {
    if (p[2] === 'weekend') return 'series/weekend';
    if (p[2]) return `series/${p[2]}`;
    return p[1] ? 'series/hub' : 'series/index';
  }
  if (p[0] === 'drivers') return 'drivers';
  if (p[0] === 'blog') return p[1] ? 'blog/post' : 'blog/list';
  if (p[0] === 'authors') return p[1] ? 'authors/profile' : 'authors/index';
  if (p[0] === 'archive') return 'archive';
  return 'site pages';
}

const attr = (tag: string, name: string): string => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[2] ?? m[3] ?? m[4] ?? '') : '';
};
const decode = (s: string): string =>
  s.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
const text = (s: string): string =>
  decode(s.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const wordsOf = (s: string): number => (s ? s.split(' ').filter(Boolean).length : 0);

/** One page's checks over the HTML as sent. Pure: the fetch stays in main. */
export function auditPage(input: PageInput): PageAudit {
  const url = new URL(input.url);
  const findings: string[] = [];
  const html = input.html ?? '';
  const head = (html.match(/<head[\s\S]*?<\/head>/i) ?? [html])[0];
  const metaTag = (name: string): string => {
    const m = head.match(new RegExp(`<meta\\s[^>]*name\\s*=\\s*["']${name}["'][^>]*>`, 'i'));
    return m ? decode(attr(m[0], 'content')) : '';
  };
  const robots = metaTag('robots').toLowerCase();
  const title = decode((head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '').trim());
  const description = metaTag('description');
  const canonicalTag = head.match(/<link\s[^>]*rel\s*=\s*["']canonical["'][^>]*>/i)?.[0] ?? '';
  const canonical = canonicalTag ? decode(attr(canonicalTag, 'href')) : '';
  const h1 = (html.match(/<h1[\s>]/gi) ?? []).length;
  const imgs = html.match(/<img\s[^>]*>/gi) ?? [];
  const imagesWithoutAlt = imgs.filter(t => !/\salt\s*=/i.test(t) || attr(t, 'alt').trim() === '').length;
  const jsonLd = (html.match(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>/gi) ?? []).length;
  const main = (html.match(/<main[\s\S]*?<\/main>/i) ?? [html])[0];
  const words = wordsOf(text(main));
  const sentenceWords = (main.match(/<p[\s>][\s\S]*?<\/p>/gi) ?? [])
    .map(p => wordsOf(text(p)))
    .filter(n => n >= 15)
    .reduce((s, n) => s + n, 0);

  if (input.status >= 300 && input.status < 400) findings.push(`redirect:${input.location ?? input.status}`);
  else if (input.status !== 200) findings.push(`status:${input.status}`);
  if (input.status === 200) {
    if (/\bnoindex\b/.test(robots)) findings.push('noindex-in-sitemap');
    if (!title) findings.push('title-missing');
    else if (title.length < 30 || title.length > 60) findings.push(`title-length:${title.length}`);
    if (!description) findings.push('description-missing');
    else if (description.length < 70 || description.length > 160) findings.push(`description-length:${description.length}`);
    if (h1 !== 1) findings.push(`h1-count:${h1}`);
    if (imagesWithoutAlt > 0) findings.push(`alt-missing:${imagesWithoutAlt}`);
    // The root's canonical is the origin with or without its slash; every other path is compared without one.
    const norm = (u: string): string => u.replace(/\/$/, '');
    const self = norm(`${url.origin}${url.pathname}`);
    if (!canonical) findings.push('canonical-missing');
    else if (norm(canonical) !== self) findings.push(`canonical-other:${canonical}`);
    if (jsonLd === 0) findings.push('jsonld-missing');
    if (input.ms > 2000) findings.push(`slow:${input.ms}`);
  }
  return {
    url: input.url, path: url.pathname || '/', family: familyOf(url.pathname), status: input.status, ms: input.ms,
    robots, title, description, h1, images: imgs.length, imagesWithoutAlt, canonical, jsonLd, words, sentenceWords, findings,
  };
}

const code = (f: string): string => f.split(':')[0];
const median = (a: number[]): number | null => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

export interface FamilySummary {
  family: string;
  pages: number;
  failing: number;
  medianMs: number | null;
  medianSentenceWords: number | null;
  findings: Record<string, number>;
}

export function summarise(audits: readonly PageAudit[]): FamilySummary[] {
  const by = new Map<string, PageAudit[]>();
  for (const a of audits) (by.get(a.family) ?? by.set(a.family, []).get(a.family)!).push(a);
  return [...by.entries()]
    .map(([family, rows]) => {
      const findings: Record<string, number> = {};
      for (const r of rows) for (const f of new Set(r.findings.map(code))) findings[f] = (findings[f] ?? 0) + 1;
      return {
        family, pages: rows.length,
        failing: rows.filter(r => r.findings.some(f => FAILING.has(code(f)))).length,
        medianMs: median(rows.map(r => r.ms)), medianSentenceWords: median(rows.map(r => r.sentenceWords)), findings,
      };
    })
    .sort((a, b) => b.pages - a.pages);
}

export function toCsv(audits: readonly PageAudit[]): string {
  const cell = (v: unknown): string => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rows = [['path', 'family', 'status', 'ms', 'robots', 'title_length', 'description_length', 'h1', 'images_without_alt', 'canonical', 'jsonld', 'words', 'sentence_words', 'findings'].join(',')];
  for (const a of audits) {
    rows.push([a.path, a.family, a.status, a.ms, a.robots, a.title.length, a.description.length, a.h1, a.imagesWithoutAlt, a.canonical, a.jsonLd, a.words, a.sentenceWords, a.findings.join('; ')].map(cell).join(','));
  }
  return rows.join('\n');
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const UA = 'paddock-seo-census/1.0 (+https://paddock-tracker.com)';

async function fetchPage(url: string): Promise<PageInput> {
  const t0 = Date.now();
  const res = await fetch(url, { redirect: 'manual', headers: { 'user-agent': UA } });
  const html = res.status === 200 ? await res.text() : '';
  return { url, status: res.status, location: res.headers.get('location'), ms: Date.now() - t0, html };
}

async function main(): Promise<void> {
  const site = (arg('--site') ?? 'https://paddock-tracker.com').replace(/\/$/, '');
  const out = arg('--out') ?? '.seo-census';
  const limit = Number(arg('--limit') ?? 0) || 0;
  const xml = await (await fetch(`${site}/sitemap.xml`, { headers: { 'user-agent': UA } })).text();
  let urls = parseSitemap(xml);
  if (urls.length === 0) throw new Error(`no <loc> in ${site}/sitemap.xml`);
  if (limit > 0) urls = urls.slice(0, limit);
  console.log(`[seo-census] ${urls.length} URLs from ${site}/sitemap.xml`);
  const audits: PageAudit[] = [];
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < urls.length) {
      const url = urls[next++];
      try { audits.push(auditPage(await fetchPage(url))); }
      catch (e) { audits.push(auditPage({ url, status: 0, ms: 0, html: '' })); console.error(`[seo-census] ${url}: ${(e as Error).message}`); }
      if (audits.length % 200 === 0) console.log(`[seo-census] ${audits.length} of ${urls.length}`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  audits.sort((a, b) => a.path.localeCompare(b.path));
  const summary = summarise(audits);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'seo-census.csv'), toCsv(audits));
  fs.writeFileSync(path.join(out, 'seo-census-summary.json'), JSON.stringify({ site, at: new Date().toISOString(), pages: audits.length, summary }, null, 1));
  console.table(summary.map(s => ({ family: s.family, pages: s.pages, failing: s.failing, ms: s.medianMs, sentenceWords: s.medianSentenceWords, findings: Object.entries(s.findings).map(([k, v]) => `${k} ${v}`).join(', ') })));
  const failing = audits.filter(a => a.findings.some(f => FAILING.has(code(f))));
  for (const a of failing) console.log(`[seo-census] FAIL ${a.path}: ${a.findings.filter(f => FAILING.has(code(f))).join(', ')}`);
  console.log(`[seo-census] ${audits.length} pages, ${failing.length} contradict the sitemap; ${path.join(out, 'seo-census.csv')}`);
  if (failing.length > 0) process.exitCode = 1;
}

if (process.argv[1] && basename(process.argv[1]) === 'seo-census.mts') await main();
