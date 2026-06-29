'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { PushHistoryItem } from '@/lib/push-history';

// Header notification center (push history). A bell button that opens a popover
// listing the pushes we've actually sent this signed-in user, newest first, each
// row deep-linking to where the push pointed — so users can "be sure what
// arrived". No unread badge in v1 (read-state is a follow-up); just a clean list.
//
// Signed-in only: mirrors HeaderUtils' own Clerk useAuth gate (the SDK is already
// loaded for the header, so this pulls in nothing new) and renders NOTHING when
// loading or signed out — no bell flash for anonymous visitors.
//
// History starts EMPTY (the backend only began recording recently) and fills as
// pushes go out, so the empty state is worded as intentional, not broken.
//
// Open/close: click-toggle (it's an action, not a nav-to-page link, so unlike the
// hover-based HeaderNavMenu it toggles on click) + closes on outside-click,
// Escape, and route change. Mounted on ALL viewports via HeaderUtils, so the
// panel is fixed + right-aligned + width-capped to stay on-screen on phones.

// Past-direction relative time ("2h ago"). lib/date's formatRelative is
// FORWARD-looking ("in 2h") — wrong direction here — and HomeContent's
// equivalent is a private helper in a 'use client' module, so a few local lines
// beat exporting/refactoring across scope (working agreement: no premature
// shared abstraction). `now` is captured at fetch time, not at render, to keep
// the render pure.
function timeAgo(ts: number, now: number): string {
  const mins = Math.round((now - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  // `now` is the clock at load time, so the per-row "Nm ago" math stays out of
  // render (calling Date.now() during render is impure / lint-flagged).
  | { status: 'ready'; items: PushHistoryItem[]; now: number };

export function NotificationBell() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadState>({ status: 'idle' });
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();

  // Close on route change. Adjusting state during render (the documented React
  // pattern, same as HeaderNavMenu) so the panel is closed before paint — no
  // cascading-render lint, no flash of the old route's panel.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  // Lazy fetch, driven from the open handler (a user event) rather than an
  // effect — the documented place for user-initiated fetches, and it keeps the
  // setState calls out of an effect body. Fail-soft to an empty list: the route
  // already returns [] on error, but a network/parse failure here mustn't wedge
  // the panel in a permanent skeleton.
  const loadOnce = useCallback(() => {
    setState(prev => (prev.status === 'idle' ? { status: 'loading' } : prev));
    fetch('/api/push/history')
      .then(r => (r.ok ? r.json() : []))
      .then((items: PushHistoryItem[]) => {
        setState({ status: 'ready', items: Array.isArray(items) ? items : [], now: Date.now() });
      })
      .catch(() => {
        setState({ status: 'ready', items: [], now: Date.now() });
      });
  }, []);

  const toggle = useCallback(() => {
    // In an event handler, `open` is the current value — no functional updater
    // needed, which keeps the setState call (loadOnce) out of an updater body.
    if (!open) loadOnce(); // self-guards: a no-op once past the idle state.
    setOpen(o => !o);
  }, [open, loadOnce]);

  // Outside-click + Escape close while open. (HeaderNavMenu is hover-driven so it
  // doesn't need outside-click; a click-opened popover on all viewports does.)
  // No setState in the effect body itself — only inside the event callbacks —
  // so this doesn't trip the cascading-render rule.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node | null)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Render nothing until Clerk resolves, and nothing for signed-out visitors —
  // no bell, no flash.
  if (!isLoaded || !isSignedIn) return null;

  return (
    <div ref={wrapRef} className="relative flex items-center">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex items-center justify-center text-text-muted hover:text-text bg-surface hover:bg-surface-elevated border border-border rounded-full p-1.5 transition-colors duration-(--duration-fast)"
      >
        <Bell size={15} />
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label="Notifications"
          className="fixed right-3 top-[calc(env(safe-area-inset-top)+3.25rem)] z-40 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-border bg-surface-elevated/95 shadow-xl backdrop-blur-xl motion-safe:transition motion-safe:duration-(--duration-fast) motion-safe:starting:-translate-y-1 motion-safe:starting:opacity-0"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">
              Notifications
            </span>
          </div>

          <div className="max-h-[min(70vh,28rem)] overflow-y-auto overscroll-contain">
            {state.status === 'ready' && state.items.length > 0 ? (
              <ul className="flex flex-col">
                {state.items.map((it, i) => (
                  <li key={`${it.ts}-${i}`}>
                    <Link
                      href={it.url || '/app'}
                      onClick={() => setOpen(false)}
                      className="flex flex-col gap-0.5 border-b border-border/60 px-3 py-2.5 transition-colors duration-(--duration-fast) last:border-b-0 hover:bg-surface"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-text">{it.title}</span>
                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-text-faint">
                          {timeAgo(it.ts, state.now)}
                        </span>
                      </div>
                      <span className="line-clamp-2 text-xs text-text-muted">{it.body}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : state.status === 'ready' ? (
              <div className="px-3 py-8 text-center">
                <p className="text-sm font-medium text-text">No notifications yet.</p>
                <p className="mt-1 text-xs text-text-muted">
                  Alerts you receive will show up here.
                </p>
              </div>
            ) : (
              // Loading skeleton (covers idle + loading).
              <ul className="flex flex-col" aria-hidden="true">
                {[0, 1, 2].map(i => (
                  <li key={i} className="flex flex-col gap-1.5 border-b border-border/60 px-3 py-2.5 last:border-b-0">
                    <div className="h-3.5 w-1/2 animate-pulse rounded bg-surface" />
                    <div className="h-3 w-4/5 animate-pulse rounded bg-surface" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
