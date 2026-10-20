// The weekly copy of the WordPress site's published posts, pages and media list (slot O10).
//
// WordPress.com keeps its own daily backups; this is the copy off the platform,
// as JSON on the `paddock-data` branch, where git history keeps every week
// (.github/workflows/wp-backup.yml). That branch is as public as the repository,
// so the copy holds only what the site already shows: published items without a
// password. Drafts, pending, private and protected items stay on WordPress.com.
// The publisher's own pages are left out too: they carry its marker and are
// rebuilt from the data beside them. Media is the list (addresses, captions,
// sizes), not the files.
//
//   npx tsx scripts/wp-backup.mts --out paddock-data/backup
//
// Needs WP_SITE_URL (an https origin), WP_USER and WP_APP_PASSWORD (never printed).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MARKER } from '../lib/wp/render';

const i = process.argv.indexOf('--out');
const OUT = i >= 0 ? process.argv[i + 1] : undefined;
const site = (process.env.WP_SITE_URL ?? '').trim().replace(/\/+$/, '');
const user = (process.env.WP_USER ?? '').trim();
const password = (process.env.WP_APP_PASSWORD ?? '').trim();

if (!OUT) {
  console.error('--out <dir> is needed');
  process.exit(1);
}
if (!site || !user || !password) {
  console.error('WP_SITE_URL, WP_USER and WP_APP_PASSWORD are needed');
  process.exit(1);
}
if (!/^https:\/\/[^/\s]+$/.test(site)) {
  console.error('WP_SITE_URL must be an https origin with no path, e.g. https://example.com');
  process.exit(1);
}

const auth = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
type Item = Record<string, unknown> & { id: number };

/** Every item of a collection, oldest first, without the `_links` block. */
async function all(collection: string, query: string): Promise<Item[]> {
  const items: Item[] = [];
  for (let page = 1, total = 1; page <= total && page <= 100; page++) {
    const res = await fetch(`${site}/wp-json/wp/v2/${collection}?per_page=100&page=${page}&orderby=id&order=asc${query}`, {
      headers: { Authorization: auth, Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`GET /wp-json/wp/v2/${collection} answered HTTP ${res.status}: ${text.slice(0, 200)}`);
    total = Number(res.headers.get('x-wp-totalpages') ?? '1');
    for (const item of JSON.parse(text) as Item[]) {
      const copy: Item = { ...item };
      delete copy._links;
      items.push(copy);
    }
  }
  return items.sort((a, b) => a.id - b.id);
}

// The edit view for the raw block markup a restore needs; the public view for media,
// whose edit view names the (possibly unpublished) post each file belongs to.
const PUBLISHED = '&context=edit&status=publish';
const raw = (item: Item): string => {
  const content = item.content as { raw?: unknown } | undefined;
  return typeof content?.raw === 'string' ? content.raw : '';
};
/** Published and readable by anyone: no password, and the field itself never copied. */
const open = (item: Item): Item | null => {
  if (item.status !== 'publish' || (typeof item.password === 'string' && item.password !== '')) return null;
  const copy: Item = { ...item };
  delete copy.password;
  return copy;
};

try {
  const posts = (await all('posts', PUBLISHED)).map(open).filter((p): p is Item => p !== null);
  const pages = (await all('pages', PUBLISHED))
    .map(open)
    .filter((p): p is Item => p !== null && !MARKER.test(raw(p)));
  const media = await all('media', '&context=view');
  mkdirSync(OUT, { recursive: true });
  for (const [name, items] of [['posts', posts], ['pages', pages], ['media', media]] as const) {
    writeFileSync(join(OUT, `${name}.json`), `${JSON.stringify(items, null, 2)}\n`);
  }
  console.error(`backup of ${new URL(site).host}: ${posts.length} posts, ${pages.length} pages, ${media.length} media items → ${OUT}`);
} catch (err) {
  console.error(`backup failed: ${err instanceof Error ? err.message : String(err)}`);
  // No process.exit() after the fetches: on Windows it can abort while handles close (exit 127, IDEAS.md:127).
  process.exitCode = 1;
}
