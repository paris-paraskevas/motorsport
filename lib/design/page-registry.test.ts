import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CODE_PAGES, OWN_BREADCRUMB_LD, PAGE_GROUPS, registryPathOf } from './page-registry';

// THE ROUTE-COLLISION TEST (Phase 3 step 1). The registry and the route files
// must agree exactly, both ways: a route the code serves and the registry does
// not know would let a row page (step 2) take its path; a registry path with no
// route file would list a page that does not exist. The console's own pages and
// the catch-all that renders the 404 are infrastructure, not pages of the site.

const APP = path.join(process.cwd(), 'app');

function routesFromFiles(): { route: string; file: string }[] {
  const out: { route: string; file: string }[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'page.tsx') {
        const rel = path.relative(APP, path.dirname(p)).replace(/\\/g, '/');
        if (rel.startsWith('(admin)')) continue;
        const route = '/' + rel.replace(/\([a-z]+\)\/?/g, '').replace(/\/$/, '');
        if (route === '/[...catchall]') continue;
        out.push({ route: route === '' ? '/' : route, file: p });
      }
    }
  };
  walk(APP);
  return out;
}

describe('the page registry', () => {
  const files = routesFromFiles();

  it('names every route the site serves, and nothing that does not exist; a page served from rows has no route file', () => {
    const fromFiles = new Set(files.map(f => registryPathOf(f.route)));
    const byFile = CODE_PAGES.filter(p => p.served !== 'rows');
    const fromRegistry = new Set(byFile.map(p => p.path));
    expect([...fromRegistry].filter(p => !fromFiles.has(p)), 'in the registry but no route file').toEqual([]);
    expect([...fromFiles].filter(p => !fromRegistry.has(p)), 'a route file the registry does not know').toEqual([]);
    expect(fromRegistry.size).toBe(byFile.length);
    // The components programme (R4): a page whose route file has left is served
    // from its row by the catch-all, and its file must indeed be gone.
    const composed = CODE_PAGES.filter(p => p.served === 'rows').map(p => p.path);
    // P2.5 PR C: the news page's route file left; the catch-all serves it from its row.
    expect(composed).toEqual(['/calendar', '/news']);
    for (const p of composed) expect(fromFiles.has(p), `${p} still has a route file`).toBe(false);
    expect(new Set(CODE_PAGES.map(p => p.path)).size).toBe(CODE_PAGES.length);
  });

  it("records each route's rendering as the file declares it", () => {
    for (const f of files) {
      const src = fs.readFileSync(f.file, 'utf8');
      const declared = /export const dynamic = 'force-dynamic'/.test(src) ? 'dynamic' : 'cached';
      const page = CODE_PAGES.find(p => p.path === registryPathOf(f.route));
      expect(page?.rendering, f.route).toBe(declared);
    }
  });

  it('routes every page through pageMetadata and withPageGate with its own path, and exports nothing around them', () => {
    // THE COVERAGE TEST (the Page Designer plan, PR 1): a route added later
    // cannot skip the frame, and a path copied from another page cannot pass.
    for (const f of files) {
      const src = fs.readFileSync(f.file, 'utf8');
      const p = registryPathOf(f.route);
      expect(src, `${f.route} imports the frame`).toContain("from '@/lib/design/page-frame'");
      expect(src, `${f.route} metadata through the frame`).toContain(`pageMetadata('${p}'`);
      expect(src, `${f.route} page through the frame`).toContain(`withPageGate('${p}'`);
      expect(src, `${f.route} exports metadata directly`).not.toMatch(/^export const metadata\b/m);
      expect(src, `${f.route} exports generateMetadata directly`).not.toMatch(/^export (async )?function generateMetadata\b/m);
      expect(src, `${f.route} exports its component directly`).not.toMatch(/^export default (async )?function\b/m);
    }
  });

  it('uses the seeded groups and folds a library catch-all into its parent', () => {
    for (const p of CODE_PAGES) expect(PAGE_GROUPS, p.path).toContain(p.group);
    expect(registryPathOf('/sign-in/[[...sign-in]]')).toBe('/sign-in');
    expect(registryPathOf('/series/[slug]/[tab]')).toBe('/series/[slug]/[tab]');
    expect(registryPathOf('/')).toBe('/');
  });

  it('is seeded by the pages_seed migrations, every path once and no other', () => {
    // 20260908233000 seeded the first fifty-seven; a route added later brings
    // its own *_pages_seed_*.sql, so an applied migration is never edited.
    const dir = path.join(process.cwd(), 'supabase', 'migrations');
    const sql = fs
      .readdirSync(dir)
      .filter(f => /_pages_seed/.test(f))
      .sort()
      .map(f => fs.readFileSync(path.join(dir, f), 'utf8'))
      .join('\n');
    const seeded = [...sql.matchAll(/\('paddock',\s*'([^']+)',/g)].map(m => m[1]);
    expect(seeded.length).toBe(CODE_PAGES.length);
    expect(new Set(seeded).size).toBe(seeded.length);
    expect([...seeded].sort()).toEqual(CODE_PAGES.map(p => p.path).sort());
    for (const p of CODE_PAGES) {
      const line = sql.split('\n').find(l => l.includes(`'${p.path}',`));
      expect(line, p.path).toBeDefined();
      expect(line, p.path).toContain(`'${p.group}',`);
      expect(line, p.path).toContain(`'${p.authz}',`);
      // A later *_pages_seed_*.sql may correct a row's rendering (20260930194100, X7) or its
      // indexable value (20260928190000, R14) with an update; the last word wins over the insert.
      const rendering = [...sql.matchAll(/update page\s+set rendering = '(dynamic|cached)'[^;]*?path in \(([^)]*)\)/gi)]
        .filter(m => m[2].includes(`'${p.path}'`))
        .pop();
      if (rendering) expect(rendering[1], p.path).toBe(p.rendering);
      else expect(line, p.path).toContain(`'${p.rendering}',`);
      const corrected = [...sql.matchAll(/update page\s+set indexable = (true|false)[^;]*?path in \(([^)]*)\)/gi)]
        .filter(m => m[2].includes(`'${p.path}'`))
        .pop();
      if (corrected) expect(corrected[1] === 'true', p.path).toBe(p.indexable);
      else expect(line, p.path).toMatch(new RegExp(`'(dynamic|cached)',\\s*${p.indexable},`));
    }
  });

  it('keeps the Learn topic, the Learn answer and the author profile indexable, so the frame leaves the code its own robots rule (R14)', () => {
    // Off, lib/design/page-frame.tsx applyFrame adds noindex, follow to every
    // page of the pattern: 801 of 1,279 sitemap pages from 1.0.70 to 2026-09-28.
    for (const p of ['/information/[topic]', '/information/[topic]/[slug]', '/authors/[slug]']) {
      expect(CODE_PAGES.find(c => c.path === p)?.indexable, p).toBe(true);
    }
  });

  it('P2.17: OWN_BREADCRUMB_LD names exactly the pages whose route file, a component it imports, or its family prints a BreadcrumbList; the Breadcrumb region prints none there', () => {
    // The series tab prints its through components/SeriesPageView.tsx, so the scan follows each route's @/components imports one hop.
    const prints = (file: string) => fs.existsSync(file) && /breadcrumbLd\(/.test(fs.readFileSync(file, 'utf8'));
    const owning = new Set<string>();
    for (const f of files) {
      const src = fs.readFileSync(f.file, 'utf8');
      const imported = [...src.matchAll(/from '@\/components\/([^']+)'/g)].flatMap(m => {
        const base = path.join(process.cwd(), 'components', m[1]);
        return [`${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx')];
      });
      if (/breadcrumbLd\(/.test(src) || imported.some(prints)) owning.add(registryPathOf(f.route));
    }
    for (const p of CODE_PAGES.filter(c => c.served === 'rows')) {
      if (prints(path.join(process.cwd(), 'lib', 'design', 'families', `${p.path.slice(1)}.tsx`))) owning.add(p.path);
    }
    expect([...OWN_BREADCRUMB_LD].sort()).toEqual([...owning].sort());
    expect(OWN_BREADCRUMB_LD.size).toBe(19);
    for (const p of OWN_BREADCRUMB_LD) expect(CODE_PAGES.some(c => c.path === p), p).toBe(true);
  });
});
