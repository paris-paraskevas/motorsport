// Manual IndexNow submission — tells Bing and Yandex which pages changed.
// Run via: npm run indexnow:submit
// Submit a subset with a substring filter: npm run indexnow:submit -- information/
//   Write the filter WITHOUT a leading slash. Git Bash on Windows rewrites a
//   leading-slash argument into a real path — "/information/" arrives as
//   "C:/Program Files/Git/information/" and matches nothing.
//
// Reads the DEPLOYED sitemap rather than rebuilding it in-process. Two reasons,
// and the second is the one that matters:
//
//  1. Rebuilding it here does not run at all. `buildSitemapEntries` reaches
//     `lib/information/registry.ts`, which imports `server-only` — a module whose
//     whole job is to throw outside a Server Component. It resolves to an empty
//     file only under the `react-server` export condition, which Next's bundler
//     sets and plain Node does not. Passing `--conditions=react-server` to tsx
//     fixes that import and immediately breaks the next one: React then resolves
//     to its react-server build, which has no `createContext`, and something in
//     the chain pulls in `next/link`. The script has been dead since those
//     imports landed.
//
//  2. IndexNow is a claim about what a crawler will find. The deployed sitemap is
//     the only honest source for that. A locally rebuilt list can contain a URL
//     that has not shipped yet, which sends a crawler to a 404 — the opposite of
//     the favour we are asking for.

import { submitUrls } from '../lib/indexnow';
import { SITE_URL } from '../lib/site';

const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;

// Enough of an XML parser for a sitemap, which is a flat <urlset> of <loc>s.
// A dependency for this would cost more than it saves.
function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    m[1]
      .trim()
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'"),
  );
}

async function main(): Promise<number> {
  const filter = process.argv[2];

  console.log(`[indexnow] reading ${SITEMAP_URL}`);
  const res = await fetch(SITEMAP_URL, { headers: { 'User-Agent': 'paddock-indexnow' } });
  if (!res.ok) {
    console.error(`[indexnow] sitemap fetch failed: HTTP ${res.status} ${res.statusText}`);
    return 1;
  }

  const all = extractLocs(await res.text());
  if (all.length === 0) {
    // A sitemap that parses to nothing means the page broke or the shape changed.
    // Reporting success here would hide it, so this is a failure.
    console.error('[indexnow] sitemap contained no <loc> entries — refusing to report success');
    return 1;
  }

  const urls = filter ? all.filter((u) => u.includes(filter)) : all;
  console.log(
    filter
      ? `[indexnow] ${urls.length} of ${all.length} URLs match "${filter}"`
      : `[indexnow] ${urls.length} URLs in sitemap`,
  );
  if (urls.length === 0) {
    console.error(`[indexnow] no URL matched "${filter}" — nothing submitted`);
    return 1;
  }

  await submitUrls(urls);
  console.log('[indexnow] submission complete');
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error('[indexnow] fatal:', err);
    process.exitCode = 1;
  });
