// Verify every series' Wikipedia URL fields actually resolve.
// Run via `node scripts/audit-wikipedia.mjs`. Read-only — does not modify anything.
//
// Output: status per series + per field. 200 = page exists, 404 = needs fixing.

import fs from 'node:fs';
import path from 'node:path';

const SERIES_DIR = path.join('content', 'series');
const FIELDS = ['wikipediaPage', 'championsPage', 'seasonPage'];

const slugs = fs.readdirSync(SERIES_DIR).filter(s =>
  fs.statSync(path.join(SERIES_DIR, s)).isDirectory(),
);

async function check(title) {
  if (!title) return { status: 'missing' };
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: 'manual',
        headers: { 'User-Agent': 'Paddock-PWA audit (https://paddock-tracker.com)' },
      });
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      return { status: res.status, redirected: res.headers.get('location') };
    } catch (err) {
      return { status: 'error', error: String(err.message ?? err) };
    }
  }
  return { status: 'rate-limited' };
}

const broken = [];
for (const slug of slugs) {
  const metaPath = path.join(SERIES_DIR, slug, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  console.log(`\n[${slug}] ${meta.name}`);
  for (const field of FIELDS) {
    const title = meta[field];
    const result = await check(title);
    const flag = result.status === 200 ? 'OK ' : 'BAD';
    console.log(`  ${flag} ${field.padEnd(15)} -> ${title ?? '(missing)'}  (${result.status})`);
    if (result.status !== 200 && title) {
      broken.push({ slug, field, title, result });
    }
    // be polite to Wikipedia
    await new Promise(r => setTimeout(r, 300));
  }
}

console.log(`\n--- Summary ---`);
console.log(`Broken: ${broken.length}`);
for (const b of broken) {
  console.log(`  ${b.slug}.${b.field} = ${b.title}  -> ${b.result.status}`);
}
