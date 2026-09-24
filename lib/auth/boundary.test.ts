import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Who may import Clerk (PA A1): lib/auth/ and a named allow-list that shrinks with each PR of the phase, so the files that
// read the provider move behind the seam once and stay there. After A1a the server files are behind it; the browser's files
// and the two layouts wait for A1b, the middleware, the sign-in pages and the webhook for A3.
const ALLOWED = new Set([
  'middleware.ts',
  'app/api/webhooks/clerk/route.ts',
  'app/(admin)/layout.tsx',
  'app/(app)/layout.tsx',
  'app/(app)/settings/page.tsx',
  'app/(app)/sign-in/[[...sign-in]]/page.tsx',
  'app/(app)/sign-up/[[...sign-up]]/page.tsx',
  'components/AccountIdentity.tsx',
  'components/AccountStaffLinks.tsx',
  'components/AppShell.tsx',
  'components/BottomBar.tsx',
  'components/ContactModal.tsx',
  'components/EnableNotifications.tsx',
  'components/NotifPrefsSection.tsx',
  'components/OnboardingWizard.tsx',
  'components/SettingsClient.tsx',
  'components/SupportPrompt.tsx',
  'components/YourDevices.tsx',
  'components/assistant/AssistantWidget.tsx',
  'components/authors/WriteForUsForm.tsx',
  'components/blog/StudioLink.tsx',
  'components/page/DeveloperToolbar.tsx',
  'components/useVisitor.ts',
  'components/whats-new/WhatsNewModal.tsx',
  'lib/useFollowedSeries.ts',
]);

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CLERK = /from '@clerk\//;

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
const imports = (rel: string) => CLERK.test(readFileSync(join(ROOT, rel), 'utf8'));

describe('the Clerk boundary (PA A1)', () => {
  it('no file outside lib/auth and the allow-list imports @clerk/', () => {
    const files = [...sources('app'), ...sources('components'), ...sources('lib'), 'middleware.ts'];
    expect(files.length).toBeGreaterThan(100);
    expect(files.filter(f => !f.startsWith('lib/auth/') && !ALLOWED.has(f) && imports(f))).toEqual([]);
  });

  it('every allow-listed file still imports Clerk, so the list shrinks as the phase moves and never lists a file already moved', () => {
    for (const f of ALLOWED) expect(imports(f), f).toBe(true);
  });
});
