import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CODE_PAGES, PAGE_GROUPS, registryPathOf } from './page-registry';

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

  it('names every route the site serves, and nothing that does not exist', () => {
    const fromFiles = new Set(files.map(f => registryPathOf(f.route)));
    const fromRegistry = new Set(CODE_PAGES.map(p => p.path));
    expect([...fromRegistry].filter(p => !fromFiles.has(p)), 'in the registry but no route file').toEqual([]);
    expect([...fromFiles].filter(p => !fromRegistry.has(p)), 'a route file the registry does not know').toEqual([]);
    expect(fromRegistry.size).toBe(CODE_PAGES.length);
  });

  it("records each route's rendering as the file declares it", () => {
    for (const f of files) {
      const src = fs.readFileSync(f.file, 'utf8');
      const declared = /export const dynamic = 'force-dynamic'/.test(src) ? 'dynamic' : 'cached';
      const page = CODE_PAGES.find(p => p.path === registryPathOf(f.route));
      expect(page?.rendering, f.route).toBe(declared);
    }
  });

  it('uses the seeded groups and folds a library catch-all into its parent', () => {
    for (const p of CODE_PAGES) expect(PAGE_GROUPS, p.path).toContain(p.group);
    expect(registryPathOf('/sign-in/[[...sign-in]]')).toBe('/sign-in');
    expect(registryPathOf('/series/[slug]/[tab]')).toBe('/series/[slug]/[tab]');
    expect(registryPathOf('/')).toBe('/');
  });

  it('is seeded by migration 20260908233000, every path once and no other', () => {
    const sql = fs.readFileSync(path.join(process.cwd(), 'supabase', 'migrations', '20260908233000_pages_seed.sql'), 'utf8');
    const seeded = [...sql.matchAll(/\('paddock',\s*'([^']+)',/g)].map(m => m[1]);
    expect(seeded.length).toBe(CODE_PAGES.length);
    expect(new Set(seeded).size).toBe(seeded.length);
    expect([...seeded].sort()).toEqual(CODE_PAGES.map(p => p.path).sort());
    for (const p of CODE_PAGES) {
      const line = sql.split('\n').find(l => l.includes(`'${p.path}',`));
      expect(line, p.path).toBeDefined();
      expect(line, p.path).toContain(`'${p.group}',`);
      expect(line, p.path).toContain(`'${p.authz}',`);
      expect(line, p.path).toContain(`'${p.rendering}',`);
      expect(line, p.path).toMatch(new RegExp(`'${p.rendering}',\\s*${p.indexable},`));
    }
  });
});
