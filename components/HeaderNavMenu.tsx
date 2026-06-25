'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// Desktop-only (lg+) disclosure-nav menu. A top-level nav item that reveals a
// panel on hover OR keyboard focus and closes on mouse-leave, Escape, focus-out,
// or route change. This is the W3C "disclosure navigation" pattern — chosen over
// Base UI's Menu / NavigationMenu because those toggle the panel on trigger
// *click*, whereas our hub items (Series / Calendar / Social) must NAVIGATE to
// their page on click and only reveal the submenu on hover/focus. Menu-only
// items (Community — no page of its own) omit `href` and render a <button>.
//
// Mounted only inside AppShell's `hidden lg:flex` nav, so phones and the bottom
// bar never render it.
export function HeaderNavMenu({
  label,
  href,
  active = false,
  dataTour,
  panelLabel,
  panelClassName,
  children,
}: {
  label: string;
  /** Present → trigger is a <Link> to a hub page; absent → a menu-only <button>. */
  href?: string;
  active?: boolean;
  dataTour?: string;
  panelLabel?: string;
  panelClassName?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const panelId = useId();

  // Client nav keeps this mounted in the layout — close when the route changes.
  // Adjusting state during render (the documented React pattern) rather than in
  // an effect: no cascading-render lint, and the menu is closed before paint.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  // Escape closes from anywhere while open (a hover-opened menu has no focus
  // inside the wrapper) and restores focus to the trigger.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const triggerClass = cn(
    'inline-flex items-center gap-1 self-stretch border-b-2 px-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors duration-(--duration-fast)',
    active ? 'border-brand text-text' : 'border-transparent text-text-muted hover:text-text',
  );

  const inner = (
    <>
      {label}
      <ChevronDown
        size={12}
        aria-hidden="true"
        className={cn('transition-transform duration-(--duration-fast)', open && 'rotate-180')}
      />
    </>
  );

  return (
    <div
      className="relative flex items-stretch"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={e => {
        // Stay open while focus moves between the trigger and panel children.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      {href ? (
        <Link
          ref={el => {
            triggerRef.current = el;
          }}
          href={href}
          aria-current={active ? 'page' : undefined}
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={panelId}
          data-tour={dataTour}
          className={triggerClass}
        >
          {inner}
        </Link>
      ) : (
        <button
          ref={el => {
            triggerRef.current = el;
          }}
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={panelId}
          data-tour={dataTour}
          className={triggerClass}
        >
          {inner}
        </button>
      )}

      {open && (
        <div
          id={panelId}
          aria-label={panelLabel ?? label}
          className={cn(
            'absolute left-0 top-full z-40 mt-px min-w-48 rounded-b-lg border border-t-0 border-border bg-surface-elevated/95 p-2 shadow-xl backdrop-blur-xl',
            'motion-safe:transition motion-safe:duration-(--duration-fast) motion-safe:starting:-translate-y-1 motion-safe:starting:opacity-0',
            panelClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
