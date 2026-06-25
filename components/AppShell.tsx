'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SeriesMeta } from '@/lib/types';
import { groupSeriesByCategory, type GroupedSeries } from '@/lib/categories';
import { BottomBar } from './BottomBar';
import { Footer } from './Footer';
import { OnboardingWizard } from './OnboardingWizard';
import { ContactModal } from './ContactModal';
import { HeaderUtils } from './HeaderUtils';
import { HeaderNavMenu } from './HeaderNavMenu';
import { PushSoundPlayer } from './PushSoundPlayer';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';

// One nav system since 0.17.0 (operator: "navigation menu and burger bar can
// go"): a single fixed header on every viewport — wordmark + inline links on
// lg+ — plus the mobile bottom bar. Since 0.97.0 the lg+ links are hover/focus
// mega-menus (HeaderNavMenu): Series → category grid, Community → Blog/Threads,
// Social → Play/Leagues/Friends, Calendar → month jump. Everything lives inside
// `hidden lg:flex`, so the BottomBar and any < lg viewport are byte-identical to
// before.
export function AppShell({
  children,
  seriesList,
  bettingEnabled,
}: {
  children: React.ReactNode;
  seriesList: SeriesMeta[];
  // Server-resolved (isBettingConfigured) — gates the Social nav entry so the
  // betting/social surface only appears once the Supabase env is provisioned.
  bettingEnabled: boolean;
}) {
  const pathname = usePathname();
  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const groups = groupSeriesByCategory(seriesList);

  // Installed-PWA detection (same condition as StandaloneRedirect). In the
  // PWA the wordmark must NOT link to the landing: the standalone guard on /
  // immediately bounces back to /app, so the click was a flash-of-landing
  // round trip (operator-reported). Browser users keep the landing link.
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    const detect = () =>
      setStandalone(
        window.matchMedia('(display-mode: standalone)').matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone === true,
      );
    const t = setTimeout(detect, 0);
    const mq = window.matchMedia('(display-mode: standalone)');
    mq.addEventListener('change', detect);
    return () => {
      clearTimeout(t);
      mq.removeEventListener('change', detect);
    };
  }, []);

  return (
    <TooltipProvider delay={300}>
      {/* Fixed (not sticky — overflow-x: hidden on body kills sticky) */}
      <header className="fixed top-0 left-0 right-0 z-30 bg-surface-elevated/85 backdrop-blur-xl border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl 3xl:max-w-[2000px]! mx-auto px-3 md:px-4 h-14 flex items-center gap-6">
          {/* Wordmark → landing in the browser; → home in the installed PWA
              (a "/" link there just flashes the landing before the standalone
              guard bounces back). */}
          <Link
            href={standalone ? '/app' : '/'}
            className="font-display text-base font-extrabold uppercase tracking-wide text-text"
          >
            Paddock<span className="text-brand">•</span>Tracker
          </Link>

          {/* Inline nav on lg+ only — below that the bottom bar owns primary nav. */}
          <nav aria-label="Sections" className="hidden lg:flex items-stretch self-stretch gap-5">
            <Link
              href="/app"
              aria-current={isActive('/app', true) ? 'page' : undefined}
              className={`inline-flex items-center border-b-2 px-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors duration-(--duration-fast) ${
                isActive('/app', true)
                  ? 'border-brand text-text'
                  : 'border-transparent text-text-muted hover:text-text'
              }`}
            >
              Home
            </Link>

            {/* Calendar — links to the timeline; hover/focus jumps straight to a month. */}
            <HeaderNavMenu
              label="Calendar"
              href="/calendar"
              active={isActive('/calendar', true)}
              panelLabel="Jump to month"
              panelClassName="w-64"
            >
              <CalendarMonthMenu />
            </HeaderNavMenu>

            {/* Series — links to the hub; hover/focus opens the category grid. */}
            <HeaderNavMenu
              label="Series"
              href="/series"
              active={isActive('/series')}
              dataTour="series"
              panelLabel="Browse series"
              panelClassName="w-[40rem] max-w-[calc(100vw-1.5rem)]"
            >
              <SeriesMegaMenu groups={groups} />
            </HeaderNavMenu>

            {/* Community — no page of its own, so a menu-only trigger. */}
            <HeaderNavMenu
              label="Community"
              active={isActive('/blog') || isActive('/threads')}
              panelLabel="Community"
            >
              <MenuLinkList
                items={[
                  { href: '/blog', label: 'Blog', desc: 'Analysis & recaps' },
                  { href: '/threads', label: 'Threads', desc: 'Fan discussion' },
                ]}
              />
            </HeaderNavMenu>

            {/* Social folded play + friends + leagues (0.84.0); gated on betting env. */}
            {bettingEnabled && (
              <HeaderNavMenu
                label="Social"
                href="/social"
                active={isActive('/social') || isActive('/play')}
                panelLabel="Social"
              >
                <MenuLinkList
                  items={[
                    { href: '/play', label: 'Play solo', desc: 'Back the grid' },
                    { href: '/social/leagues', label: 'Leagues', desc: 'Play with friends' },
                    { href: '/social/friends', label: 'Friends', desc: 'Requests & invites' },
                  ]}
                />
              </HeaderNavMenu>
            )}
          </nav>

          <div className="ml-auto" data-tour="account"><HeaderUtils seriesList={seriesList} /></div>
        </div>
      </header>

      {/* pt-14 clears the fixed header; bottom padding clears the mobile
          bottom bar (h-14 + device safe area). */}
      <main className="min-h-screen flex flex-col pt-14 pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <div className="flex-1">{children}</div>
        <Footer />
      </main>

      <BottomBar bettingEnabled={bettingEnabled} />

      <OnboardingWizard seriesList={seriesList} />
      <ContactModal />
      <PushSoundPlayer />
      <Toaster position="bottom-right" closeButton richColors />
    </TooltipProvider>
  );
}

// A simple labelled link list for the Community / Social menus.
function MenuLinkList({ items }: { items: { href: string; label: string; desc: string }[] }) {
  return (
    <ul className="flex flex-col">
      {items.map(it => (
        <li key={it.href}>
          <Link
            href={it.href}
            className="block rounded-md px-3 py-2 transition-colors duration-(--duration-fast) hover:bg-surface"
          >
            <div className="text-sm font-semibold text-text">{it.label}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint">{it.desc}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Category-grouped series grid (reuses groupSeriesByCategory — the same grouping
// the /series hub and onboarding use).
function SeriesMegaMenu({ groups }: { groups: GroupedSeries[] }) {
  return (
    <div className="grid grid-cols-3 gap-x-6 gap-y-4">
      {groups.map(g => (
        <div key={g.category.id}>
          <div className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">
            {g.category.label}
          </div>
          <ul className="flex flex-col">
            {g.series.map(s => (
              <li key={s.slug}>
                <Link
                  href={`/series/${s.slug}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors duration-(--duration-fast) hover:bg-surface"
                >
                  <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="truncate text-[13px] font-medium text-text">{s.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// Rolling 12-month jump list → /calendar?m=YYYY-MM. CalendarView reads the ?m=
// param to seed its anchor; the in-page picker stays season-aware.
function CalendarMonthMenu() {
  // Computed lazily on first mount — which only happens client-side, when the
  // menu opens (HeaderNavMenu renders children only while open). So `new Date()`
  // is the device clock and these months never reach the SSR'd HTML.
  const [months] = useState<{ key: string; label: string }[]>(() => {
    const now = new Date();
    const out: { key: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      out.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
      });
    }
    return out;
  });
  return (
    <div className="grid grid-cols-2 gap-1">
      {months.map(m => (
        <Link
          key={m.key}
          href={`/calendar?m=${m.key}`}
          className="rounded-md px-3 py-1.5 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:bg-surface hover:text-text"
        >
          {m.label}
        </Link>
      ))}
    </div>
  );
}
