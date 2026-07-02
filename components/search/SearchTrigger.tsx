'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

// The overlay (+ the matcher + the fetched index) load ONLY when search opens —
// kept off the initial app bundle via dynamic(ssr:false).
const SearchOverlay = dynamic(() => import('./SearchOverlay'), { ssr: false });

export function SearchTrigger() {
  const [open, setOpen] = useState(false);

  // Global ⌘K / Ctrl-K toggles search; "/" opens it when not typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === '/' && !open) {
        const el = document.activeElement;
        const typing =
          el instanceof HTMLElement &&
          (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
        if (!typing) {
          e.preventDefault();
          setOpen(true);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        title="Search (⌘K)"
        className="inline-flex items-center gap-2 rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-text-muted transition-colors duration-(--duration-fast) hover:border-border-strong hover:text-text"
      >
        <Search size={15} aria-hidden />
        <span className="hidden xl:inline font-mono text-[10px] uppercase tracking-[0.14em]">Search</span>
        <span className="hidden xl:inline font-mono text-[10px] text-text-faint" aria-hidden>
          ⌘K
        </span>
      </button>
      {open && <SearchOverlay onClose={() => setOpen(false)} />}
    </>
  );
}
