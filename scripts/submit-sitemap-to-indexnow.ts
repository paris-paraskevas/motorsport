// Manual IndexNow submission of the full sitemap.
// Run via: npm run indexnow:submit

import { buildSitemapEntries } from '../lib/sitemap-data';
import { submitUrls } from '../lib/indexnow';

async function main(): Promise<void> {
  const entries = await buildSitemapEntries();
  const urls = entries.map((e) =>
    typeof e.url === 'string' ? e.url : String(e.url),
  );
  console.log(`[indexnow] preparing ${urls.length} URLs from sitemap`);
  if (urls.length === 0) {
    console.warn('[indexnow] sitemap is empty — nothing to submit');
    return;
  }
  await submitUrls(urls);
  console.log('[indexnow] submission complete');
}

main().catch((err) => {
  console.error('[indexnow] fatal:', err);
  process.exit(1);
});
