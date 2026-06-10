'use client';
import { Fragment, useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SeriesMeta } from '@/lib/types';
import { groupSeriesByCategory } from '@/lib/categories';
import { BottomBar } from './BottomBar';
import { Footer } from './Footer';
import { OnboardingWizard } from './OnboardingWizard';
import { ContactModal } from './ContactModal';
import { HeaderUtils } from './HeaderUtils';
import { PushSoundPlayer } from './PushSoundPlayer';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';

export function AppShell({
  children,
  seriesList,
}: {
  children: React.ReactNode;
  seriesList: SeriesMeta[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <TooltipProvider delay={300}>
      {/* Mobile/tablet header (hidden on lg+) — fixed because overflow-x: hidden on body kills `sticky` */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-surface-elevated/85 backdrop-blur-xl border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-3 h-14 flex items-center">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="p-2 -ml-2 text-text-muted hover:text-text rounded-lg hover:bg-surface transition-colors duration-(--duration-fast)"
          >
            <Menu size={22} />
          </button>
          <Link
            href="/app"
            className="ml-2 font-display text-base font-extrabold uppercase tracking-wide text-text"
          >
            Paddock<span className="text-brand">•</span>Tracker
          </Link>
          <HeaderUtils className="ml-auto" seriesList={seriesList} />
        </div>
      </header>

      {/* Desktop floating utilities — top right of main content area */}
      <div className="hidden lg:flex fixed top-0 right-0 z-30 p-4 gap-2 items-center pointer-events-none">
        <div className="pointer-events-auto">
          <HeaderUtils seriesList={seriesList} />
        </div>
      </div>

      {/* Mobile backdrop (hidden on lg+) */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={`lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer / Sidebar — slides on mobile, permanent on lg+ */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-surface-elevated border-r border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] overflow-y-auto
                    transition-transform duration-200 ease-out
                    lg:translate-x-0
                    ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/app"
            className="font-display text-lg font-extrabold uppercase tracking-wide text-text"
          >
            Paddock<span className="text-brand">•</span>Tracker
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="lg:hidden p-2 -mr-2 text-text-faint hover:text-text rounded-lg hover:bg-surface transition-colors duration-(--duration-fast)"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="space-y-0.5">
          <DrawerLink href="/app" active={pathname === '/app'} label="Home" />
          <DrawerLink href="/calendar" active={pathname === '/calendar'} label="Calendar" />
          {/* Exact match only — per-series links below own /series/[slug]. */}
          <DrawerLink href="/series" active={pathname === '/series'} label="Series" />
          <DrawerLink href="/blog" active={pathname.startsWith('/blog')} label="Blog" />

          {groupSeriesByCategory(seriesList).map(group => (
            <Fragment key={group.category.id}>
              <DrawerLabel>{group.category.label}</DrawerLabel>
              {group.series.map(s => (
                <DrawerLink
                  key={s.slug}
                  href={`/series/${s.slug}`}
                  active={pathname.startsWith(`/series/${s.slug}`)}
                  label={s.name}
                  dot={s.color}
                />
              ))}
            </Fragment>
          ))}

          <DrawerLabel>More</DrawerLabel>
          <DrawerLink href="/about" active={pathname === '/about'} label="About" />
        </nav>
      </aside>

      {/* Main content — shifted right on lg+ for the permanent sidebar.
          pt-14 on mobile clears the fixed header; bottom padding clears the
          fixed bottom bar (h-14 + device safe area). */}
      <main className="lg:ml-72 min-h-screen flex flex-col pt-14 lg:pt-0 pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <div className="flex-1">{children}</div>
        <Footer />
      </main>

      <BottomBar />

      <OnboardingWizard seriesList={seriesList} />
      <ContactModal />
      <PushSoundPlayer />
      <Toaster position="bottom-right" closeButton richColors />
    </TooltipProvider>
  );
}

function DrawerLink({
  href,
  active,
  label,
  dot,
}: {
  href: string;
  active: boolean;
  label: string;
  dot?: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors duration-(--duration-fast) ${
        active
          ? 'bg-tint/10 text-tint'
          : 'text-text-muted hover:bg-surface hover:text-text'
      }`}
    >
      {dot && (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: dot }}
        />
      )}
      <span className={`font-medium ${dot ? '' : 'ml-[20px]'}`}>{label}</span>
    </Link>
  );
}

function DrawerLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-5 pb-1 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-text-faint font-semibold">
      {children}
    </div>
  );
}
