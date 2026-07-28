'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { SeriesMeta } from '@/lib/types';
import { groupSeriesByCategory, type GroupedSeries } from '@/lib/categories';
import { BottomBar } from './BottomBar';
import { Footer } from './Footer';
import { OnboardingWizard } from './OnboardingWizard';
import { ContactModal } from './ContactModal';
import { HeaderUtils } from './HeaderUtils';
import { HeaderNavMenu } from './HeaderNavMenu';
import { seriesSubPages } from '@/lib/tabs';
import { PushSoundPlayer } from './PushSoundPlayer';
import { SearchTrigger } from './search/SearchTrigger';
import { ThemeToggle } from './theme/ThemeToggle';

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

  // Pointer glow (operator idea): a soft signal-amber halo trails the cursor to
  // highlight where the mouse is. Desktop-mouse only and off under reduced
  // motion; pointer-events:none so it never intercepts a click. Driven by a ref
  // + rAF (no React state) so mousemove costs no re-render.
  const glowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const el = glowRef.current;
    if (!el || !finePointer || reducedMotion) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    let shown = false;
    const onMove = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        el.style.transform = `translate3d(${x - 220}px, ${y - 220}px, 0)`;
        if (!shown) {
          el.style.opacity = '1';
          shown = true;
        }
      });
    };
    const onLeave = () => {
      el.style.opacity = '0';
      shown = false;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      {/* Skip link: the first focusable element, visually hidden until keyboard
          focus, jumps past the fixed header/nav to the main content (WCAG 2.4.1). */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-md focus:border focus:border-border focus:bg-surface-elevated focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-text"
      >
        Skip to content
      </a>
      {/* Fixed (not sticky — overflow-x: hidden on body kills sticky) */}
      <header className="fixed top-0 left-0 right-0 z-30 bg-surface-elevated/85 backdrop-blur-xl border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="w-full px-4 md:px-6 lg:px-8 h-14 flex items-center gap-2 lg:gap-6">
          {/* Wordmark → landing in the browser; → home in the installed PWA
              (a "/" link there just flashes the landing before the standalone
              guard bounces back). */}
          <Link
            href={standalone ? '/app' : '/'}
            data-heatmap-id="nav:wordmark"
            className="font-display text-base font-extrabold uppercase tracking-wide text-text"
          >
            Paddock<span className="text-brand">•</span>Tracker
          </Link>

          {/* Inline nav on lg+ only — below that the bottom bar owns primary nav. */}
          <nav aria-label="Sections" className="hidden lg:flex items-stretch self-stretch gap-5">
            <Link
              href="/app"
              data-heatmap-id="nav:home"
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
              dataHeatmapId="nav:calendar"
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
              dataHeatmapId="nav:series"
              panelLabel="Browse series"
              panelClassName="w-[34rem] max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-4.5rem)] overflow-y-auto"
            >
              <SeriesMegaMenu groups={groups} />
            </HeaderNavMenu>

            {/* News is now a top-level clickable destination (→ /news); Blog +
                Threads sit on its hover panel (was the menu-only "Community"). */}
            <HeaderNavMenu
              label="News"
              href="/news"
              active={isActive('/news') || isActive('/blog') || isActive('/threads')}
              dataHeatmapId="nav:news"
              panelLabel="News & community"
            >
              <MenuLinkList
                items={[
                  { href: '/blog', label: 'Blog', desc: 'Analysis & recaps' },
                  { href: '/threads', label: 'Threads', desc: 'Fan discussion' },
                ]}
              />
            </HeaderNavMenu>

            {/* Information hub — the "questions answered" + reference section. */}
            <HeaderNavMenu
              label="Learn"
              href="/information"
              active={isActive('/information')}
              dataHeatmapId="nav:learn"
              panelLabel="Learn about motorsport"
            >
              <MenuLinkList
                items={[
                  { href: '/information/series-guides', label: 'Series guides', desc: 'Every championship: history & rules' },
                  { href: '/information/formula-1', label: 'Formula 1 & Open-Wheel', desc: 'Champions, rules & records' },
                  { href: '/information/feeder-series', label: 'Feeder Series', desc: 'The junior ladder' },
                  { href: '/information/tracks', label: 'Tracks & Circuits', desc: 'Venues by country' },
                  { href: '/information/map', label: 'Circuit Map', desc: 'All 138 venues on one map' },
                  { href: '/information/general', label: 'Motorsport 101', desc: 'The basics & big debates' },
                ]}
              />
            </HeaderNavMenu>

            {/* Social folded play + friends + leagues (0.84.0); gated on betting env. */}
            {bettingEnabled && (
              <HeaderNavMenu
                label="Social"
                href="/social"
                active={isActive('/social') || isActive('/play')}
                dataHeatmapId="nav:social"
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

          <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
            <ThemeToggle />
            <SearchTrigger />
            <div data-tour="account"><HeaderUtils /></div>
          </div>
        </div>
      </header>

      {/* pt-14 clears the fixed header; bottom padding clears the mobile
          bottom bar (h-14 + device safe area). */}
      <main id="main-content" tabIndex={-1} className="min-h-screen flex flex-col pt-14 pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0 outline-none">
        <div className="flex-1">{children}</div>
        <Footer />
      </main>

      <BottomBar bettingEnabled={bettingEnabled} />

      <OnboardingWizard seriesList={seriesList} />
      <ContactModal />
      <PushSoundPlayer />

      {/* Cursor glow — see the effect above. Always rendered; only animated
          (and only visible) when gated in, otherwise it stays at opacity 0. */}
      <div
        ref={glowRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[60] h-[440px] w-[440px] rounded-full opacity-0 transition-opacity duration-300 will-change-transform"
        style={{
          background:
            'radial-gradient(circle, rgba(255,180,0,0.11) 0%, rgba(255,180,0,0.05) 40%, rgba(255,180,0,0.018) 62%, transparent 82%)',
          mixBlendMode: 'screen',
        }}
      />
    </>
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
// the /series hub and onboarding use). Leads with the F1 Telemetry & Analysis
// hub (0.114.1) — the one cross-round destination that isn't a series tab.
function SeriesMegaMenu({ groups }: { groups: GroupedSeries[] }) {
  const allSeries = groups.flatMap(g => g.series);
  // The series list is a SINGLE column with the detail pane immediately to its
  // right, so the pointer path from a series to its pages crosses no OTHER
  // series. The earlier two-column layout let a row transited on the way to the
  // detail hijack the pane (the classic "menu-aim" steal — you couldn't reach
  // F2's pages without falling onto an endurance row en route); a single column
  // makes that impossible by geometry, with no hover-intent timing hack.
  // Defaults to the first series (F1) and follows hover/focus.
  const [activeSlug, setActiveSlug] = useState<string | undefined>(allSeries[0]?.slug);
  const active = allSeries.find(s => s.slug === activeSlug) ?? allSeries[0];
  const subPages = active ? seriesSubPages(active) : [];
  return (
    <div className="flex flex-col gap-3">
      {/* Cross-round F1 tools + the guides hub — compact chips so the single
          series column below stays within the viewport. */}
      <div className="flex flex-wrap gap-2">
        {[
          { href: '/f1/analysis', label: 'F1 Analysis', heatmap: 'nav:f1-analysis' },
          { href: '/f1/compare', label: 'F1 Head-to-head', heatmap: 'nav:f1-compare' },
          { href: '/information/series-guides', label: 'Series guides', heatmap: 'nav:series-guides' },
        ].map(sc => (
          <Link
            key={sc.href}
            href={sc.href}
            data-heatmap-id={sc.heatmap}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface/60 px-2.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:bg-surface hover:text-text"
          >
            <span aria-hidden="true" className="h-3 w-[3px] shrink-0 bg-brand-fill" />
            {sc.label}
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_12rem] border-t border-border pt-3">
        {/* Master: single column of category-grouped series. Hover/focus loads a
            series' pages into the detail pane; click still navigates to the hub. */}
        <div className="flex flex-col gap-3 pr-3">
          {groups.map(g => (
            <div key={g.category.id}>
              <div className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">
                {g.category.label}
              </div>
              <ul className="flex flex-col">
                {g.series.map(s => (
                  <li key={s.slug}>
                    <Link
                      href={`/series/${s.slug}`}
                      onMouseEnter={() => setActiveSlug(s.slug)}
                      onFocus={() => setActiveSlug(s.slug)}
                      data-heatmap-id={`nav:series:${s.slug}`}
                      className={`flex items-center gap-2 rounded-md px-2 py-1 transition-colors duration-(--duration-fast) hover:bg-surface ${
                        active?.slug === s.slug ? 'bg-surface' : ''
                      }`}
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
        {/* Detail: the hovered/focused series' pages. */}
        {active && (
          <div className="border-l border-border pl-3">
            <div className="mb-1.5 flex items-center gap-2">
              <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0" style={{ backgroundColor: active.color }} />
              <span className="truncate font-display text-sm font-extrabold uppercase tracking-wide text-text">
                {active.name}
              </span>
            </div>
            <ul className="flex flex-col">
              {subPages.map(p => (
                <li key={p.key}>
                  <Link
                    href={p.href}
                    data-heatmap-id={`nav:series:${active.slug}:${p.key}`}
                    className="block rounded-md px-2 py-1 text-[13px] text-text-muted transition-colors duration-(--duration-fast) hover:bg-surface hover:text-text"
                  >
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
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
