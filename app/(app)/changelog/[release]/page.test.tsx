import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

// THE RELEASE PAGE (X6 A): one release's every update, prerendered at build
// from RELEASES.md, which the Worker never holds; the source is scanned for the
// three exports that make that true, and the page is rendered from a fixture
// file through the parser the changelog uses.

const NOT_FOUND = new Error('NEXT_NOT_FOUND');
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw NOT_FOUND;
  },
}));
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: unknown; children: React.ReactNode; className?: string }) => (
    <a href={String(href)} className={className}>
      {children}
    </a>
  ),
}));
// The frame reads the page registry row from the database at build; here the code's own metadata and page stand alone.
vi.mock('@/lib/design/page-frame', () => ({
  pageMetadata: (_path: string, base: unknown) => (typeof base === 'function' ? base : async () => base),
  withPageGate: (_path: string, Page: unknown) => Page,
}));

const FIXTURE = md(
  '# 1.0 · Lights out',
  '',
  'Paddock is out of early access.',
  '',
  '## 1.0.2 — 2026-09-22',
  '',
  'The second push.',
  '',
  '## 1.0.1 — 2026-09-21',
  '',
  'The first push.',
  '',
  '# Release 15 · The finishing pass',
  '',
  'The story of fifteen.',
  '',
  '## 0.334.30 — 2026-08-24',
  '',
  'Fifteen, last.',
);
function md(...lines: string[]) {
  return lines.join('\n');
}
const fixturePath = path.join(os.tmpdir(), `paddock-releases-${process.pid}.md`);
vi.mock('../releases', async () => {
  const actual = await vi.importActual<typeof import('../releases')>('../releases');
  return { ...actual, releasesFilePath: () => fixturePath };
});

import ReleasePage, { generateMetadata, generateStaticParams } from './page';
import { RELEASE_INDEX } from '@/lib/content-bundle.generated';

const src = fs.readFileSync(path.join(__dirname, 'page.tsx'), 'utf8').replace(/\r\n/g, '\n');
const params = (release: string) => ({ params: Promise.resolve({ release }) });

describe('the release page’s build contract', () => {
  it('is prerendered at build, every listed slug and no other', () => {
    expect(src).toMatch(/^export const dynamic = 'force-static';$/m);
    expect(src).toMatch(/^export const dynamicParams = false;$/m);
    expect(src).toMatch(/^export (async )?function generateStaticParams\(\)/m);
    expect(src).not.toMatch(/^export const revalidate\b/m);
  });

  it('lists every release of the bundled index as a param', async () => {
    const list = await generateStaticParams();
    expect(list).toEqual(RELEASE_INDEX.map(r => ({ release: r.slug })));
    expect(list.length).toBeGreaterThanOrEqual(16);
  });
});

describe('the release page from a fixture file', () => {
  beforeAll(() => {
    fs.writeFileSync(fixturePath, FIXTURE);
  });

  it('draws the release’s header, its story and every update, newest first, with the way back to the changelog', async () => {
    const html = renderToStaticMarkup(await ReleasePage(params('the-finishing-pass')));
    expect(html).toContain('The finishing pass');
    expect(html).toContain('Release 15');
    expect(html).toContain('The story of fifteen.');
    expect(html).toContain('v0.334.30');
    expect(html).toContain('Fifteen, last.');
    expect(html).toContain('href="/changelog"');
    expect(html).not.toContain('The first push.');
    const newest = renderToStaticMarkup(await ReleasePage(params('lights-out')));
    expect(newest.indexOf('The second push.')).toBeLessThan(newest.indexOf('The first push.'));
    expect(newest).toContain('2 updates');
  });

  it('names the release in its metadata and 404s an unknown slug', async () => {
    const meta = await generateMetadata(params('lights-out'));
    expect(meta.title).toBe('Lights out — release notes');
    expect(meta.description).toBe('Paddock is out of early access.');
    await expect(ReleasePage(params('no-such-release'))).rejects.toBe(NOT_FOUND);
  });
});
