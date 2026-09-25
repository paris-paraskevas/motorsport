import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Who may import the provider (PA A1–A3): nobody, since the switch. lib/auth/ is the seam and knows Supabase Auth
// (@supabase/ssr, @supabase/supabase-js); no file under app, components or lib, nor the middleware, imports Clerk, and
// the site's dependencies no longer list its SDK. The import script alone (scripts/import-clerk-users.mts) reads Clerk's
// Backend API through @clerk/backend, for the run after the deploy, until A4 retires it.
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CLERK = /from '@clerk\//;
const SSR = /from '@supabase\/ssr'/;

/** Every .ts/.tsx source under a directory, as a repo-relative path with forward slashes; tests and node_modules left out. */
function sources(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(join(ROOT, d))) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const rel = `${d}/${name}`;
      if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(rel);
    }
  };
  walk(dir);
  return out;
}
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('the provider boundary (PA A3)', () => {
  it('no file imports @clerk/ any more, and the site no longer depends on its SDK', () => {
    const files = [...sources('app'), ...sources('components'), ...sources('lib'), 'middleware.ts'];
    expect(files.length).toBeGreaterThan(100);
    expect(files.filter(f => CLERK.test(read(f)))).toEqual([]);
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    expect(Object.keys(pkg.dependencies).filter(k => k.startsWith('@clerk/'))).toEqual([]);
  });

  it('the session library is imported by the seam alone', () => {
    const files = [...sources('app'), ...sources('components'), ...sources('lib'), 'middleware.ts'];
    expect(files.filter(f => !f.startsWith('lib/auth/') && SSR.test(read(f)))).toEqual([]);
  });
});
