'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { BarChart3, CalendarDays, ChevronDown, Flag, Lock, Newspaper, Trophy, Users } from 'lucide-react';
import type { SeriesCategory } from '@/lib/types';
import { CATEGORIES } from '@/lib/categories';

// Minimal, serializable series shape for the Standings/Results pickers — the
// page derives it from loadAllSeries() and passes it down (SeriesMeta is heavier
// + not all fields are needed client-side).
export interface LauncherSeries {
  slug: string;
  name: string;
  color: string;
  category: SeriesCategory;
}

// The home "Jump to" launcher: a single chip row for the top destinations,
// rendered above the customizable widget zone so the 1-click guarantee holds for
// everyone. All content is public, so the row shows for guests too; the
// account-only F1 Analysis surface carries a lock hint. Standings / Results open
// a category-grouped series picker; the long tail is covered by ⌘K search.
export function HomeLauncher({ series }: { series: LauncherSeries[] }) {
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState<'standings' | 'results' | null>(null);
  const ref = useRef<HTMLElement>(null);

  // Close the open picker on outside-click or Escape (standard disclosure).
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const grouped = CATEGORIES.map(cat => ({
    cat,
    list: series.filter(s => s.category === cat.id),
  })).filter(g => g.list.length > 0);

  const chip =
    'inline-flex shrink-0 items-center gap-1.5 border border-border bg-surface/60 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-border-strong hover:text-text';

  const picker = (tab: 'standings' | 'results') => (
    <div className="absolute left-0 top-full z-30 mt-1.5 max-h-80 w-64 overflow-y-auto border border-border-strong bg-bg p-2 shadow-lg">
      {grouped.map(g => (
        <div key={g.cat.id} className="mb-2 last:mb-0">
          <div className="px-1 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-text-faint">
            {g.cat.label}
          </div>
          {g.list.map(s => (
            <Link
              key={s.slug}
              href={`/series/${s.slug}/${tab}`}
              onClick={() => setOpen(null)}
              className="flex items-center gap-2 px-2 py-1.5 text-sm text-text-muted transition-colors duration-(--duration-fast) hover:bg-surface hover:text-text"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="truncate">{s.name}</span>
            </Link>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <nav ref={ref} aria-label="Jump to" className="flex flex-wrap items-center gap-2 border-y border-border py-3">
      <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.18em] text-text-faint">Jump to</span>

      <Link href="/calendar" className={chip}>
        <CalendarDays size={13} aria-hidden /> Calendar
      </Link>

      <Link href="/f1/analysis" className={chip}>
        <Flag size={13} aria-hidden /> F1 Analysis
        {!isSignedIn && <Lock size={11} className="text-text-faint" aria-label="sign in to unlock" />}
      </Link>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(open === 'standings' ? null : 'standings')}
          aria-expanded={open === 'standings'}
          aria-haspopup="menu"
          className={chip}
        >
          <Trophy size={13} aria-hidden /> Standings
          <ChevronDown size={12} aria-hidden className={open === 'standings' ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
        {open === 'standings' && picker('standings')}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(open === 'results' ? null : 'results')}
          aria-expanded={open === 'results'}
          aria-haspopup="menu"
          className={chip}
        >
          <BarChart3 size={13} aria-hidden /> Results
          <ChevronDown size={12} aria-hidden className={open === 'results' ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
        {open === 'results' && picker('results')}
      </div>

      <Link href="/news" className={chip}>
        <Newspaper size={13} aria-hidden /> News
      </Link>

      <Link href="/social" className={chip}>
        <Users size={13} aria-hidden /> Social
      </Link>
    </nav>
  );
}
