import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// THE ROUTE-SCAN TEST (X7). The session page edge-caches like the weekend page:
// `revalidate` names the window and an empty `generateStaticParams` puts the
// route in the prerender manifest, which is what Next and OpenNext's cache
// interception key on; a route without that export is rendered dynamically
// whatever the page does (the installed docs, generate-static-params.md: "You
// must always return an array from generateStaticParams, even if it's empty.
// Otherwise, the route will be dynamically rendered"). The source is read, not
// imported: the page's fan-out pulls the F1 analyses and their client pieces.

const src = fs.readFileSync(path.join(__dirname, 'page.tsx'), 'utf8').replace(/\r\n/g, '\n');

describe('the session page’s cache declaration', () => {
  it('revalidates every five minutes, the weekend page’s window', () => {
    expect(src).toMatch(/^export const revalidate = 300;$/m);
  });

  it('declares no params to prerender, so every session renders on its first visit and enters the edge cache', () => {
    expect(src).toMatch(/^export (async )?function generateStaticParams\(\) \{\s*return \[\];\s*\}/m);
  });

  it('no longer opts out of the cache', () => {
    expect(src).not.toMatch(/^export const dynamic\b/m);
    expect(src).not.toMatch(/^export const fetchCache\b/m);
  });
});
