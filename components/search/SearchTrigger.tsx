'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
        title="Search"
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full bg-brand-fill px-3 py-1.5 text-bg transition-colors duration-(--duration-fast) hover:bg-brand-deep"
      >
        <Search size={16} aria-hidden />
        <span className="hidden sm:inline font-mono text-[11px] font-semibold uppercase tracking-[0.14em]">Search</span>
      </button>
      {/* Portal to <body>: the trigger lives in the fixed nav header (its own
          stacking context), so an inline overlay's backdrop-blur only frosts
          the nav. Rendered at the document root, the blur covers the whole page
          (operator 2026-07-09). `open` only flips client-side, so document.body
          is always present when this runs. */}
      {open && createPortal(<SearchOverlay onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
