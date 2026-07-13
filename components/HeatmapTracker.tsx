'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const CONSENT_KEY = 'paddock:consent';
const MAX_EVENTS = 250; // batch cap (well under sendBeacon's 64 KiB)
const MAX_IMPRESSION_TARGETS = 200; // cap observed elements per pageview
const DWELL_MS = 300; // element must stay >=50% visible this long to count as seen
const FLUSH_MS = 15000;

type Kind = 'click' | 'impression' | 'scroll' | 'rage' | 'dead';
interface PendingEvent {
  kind: Kind;
  elementId?: string;
  selector?: string;
  relX?: number;
  relY?: number;
  value?: number; // scroll depth 0..1 (kind='scroll' only)
}

// Rage-click detection: >= RAGE_COUNT clicks within RAGE_WINDOW_MS inside a
// RAGE_RADIUS_PX box = a frustration burst.
const RAGE_COUNT = 3;
const RAGE_WINDOW_MS = 500;
const RAGE_RADIUS_PX = 30;
// Ignore a page that was barely scrolled (tells us nothing).
const SCROLL_MIN = 0.05;
// Untagged click targets we still treat as a real (positioned) click, not dead.
const INTERACTIVE_SEL = 'a[href], button, [role="button"], input, select, textarea, label, summary';

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// mobile <768, tablet 768-1023, desktop >=1024 (matches Tailwind md/lg breaks).
function bucket(w: number): 'mobile' | 'tablet' | 'desktop' {
  return w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
}

// A rooted, depth-capped CSS path that querySelector can RE-RESOLVE on the live
// page — so an untagged click can still be positioned on its real element in the
// overlay (not just labelled). Prefers a stable #id (unique → anchor there), else
// tag + :nth-of-type per level. Tailwind utility classes are ignored on purpose
// (non-unique / unstable across renders).
function cssPath(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  for (let depth = 0; node && depth < 8 && node.tagName !== 'HTML' && node.tagName !== 'BODY'; depth++) {
    if (node.id && /^[A-Za-z][\w-]*$/.test(node.id)) {
      parts.unshift(`#${node.id}`);
      break; // an id is unique — anchor the path here
    }
    const parent: Element | null = node.parentElement;
    const tag = node.tagName.toLowerCase();
    if (parent) {
      const sameTag = Array.from(parent.children).filter(c => c.tagName === node!.tagName);
      parts.unshift(sameTag.length > 1 ? `${tag}:nth-of-type(${sameTag.indexOf(node) + 1})` : tag);
    } else {
      parts.unshift(tag);
    }
    node = parent;
  }
  return parts.join(' > ').slice(0, 200);
}

// Anonymous element-relative heatmap capture. Per pageview it records: CLICKS
// (element-relative ratio inside the nearest [data-heatmap-id] ancestor, else a
// re-resolvable CSS path to the nearest clickable element), DEAD clicks (on
// non-interactive space), RAGE clicks (rapid repeats in one spot), one IMPRESSION
// per tagged element that dwells >=50% visible for DWELL_MS, and one SCROLL-depth
// reading per pageview. Batches all of it, ships via sendBeacon on a 15s timer,
// on tab-hide, and on route change; when a page is framed for the /admin overlay
// (?hm=1) nothing is recorded. Consent-gated (analytics) + honours Do Not Track.
// No cookies, no PII, zero server imports — only the batch leaves the tab.
export function HeatmapTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // When the /admin heatmap overlay frames a page (?hm=1), never record — the
    // operator's own inspection clicks must not pollute the captured data.
    try {
      if (new URLSearchParams(window.location.search).get('hm') === '1') return;
    } catch {
      /* no window/search — fall through */
    }
    if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') return;
    let analytics = false;
    try {
      analytics = JSON.parse(localStorage.getItem(CONSENT_KEY) || '{}')?.analytics === true;
    } catch {
      /* no/blocked storage → no consent → don't track */
    }
    if (!analytics) return;

    const events: PendingEvent[] = [];
    const seen = new Set<string>(); // one impression per element id per pageview

    const push = (ev: PendingEvent) => {
      if (events.length < MAX_EVENTS) events.push(ev);
    };

    // Rage-click sliding window: recent click coordinates within RAGE_WINDOW_MS.
    const clickWindow: { t: number; x: number; y: number }[] = [];

    const onClick = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;

      // A click lands on a heatmap-tagged element (best anchor), on some other
      // interactive element (real click, positioned via a resolvable path), or on
      // non-interactive dead space (a frustration signal, not engagement).
      const tagged = target.closest('[data-heatmap-id]');
      const interactive = target.closest(INTERACTIVE_SEL);
      const anchor = tagged ?? interactive ?? target;
      const rect = anchor.getBoundingClientRect();
      const relX = rect.width > 0 ? clamp01((e.clientX - rect.left) / rect.width) : undefined;
      const relY = rect.height > 0 ? clamp01((e.clientY - rect.top) / rect.height) : undefined;
      const taggedId = tagged?.getAttribute('data-heatmap-id') || undefined;

      if (taggedId) {
        push({ kind: 'click', elementId: taggedId, relX, relY });
      } else {
        // Interactive-but-untagged is still a real click; non-interactive = dead.
        push({ kind: interactive ? 'click' : 'dead', selector: cssPath(anchor), relX, relY });
      }

      // Rage: >= RAGE_COUNT clicks within RAGE_WINDOW_MS inside a RAGE_RADIUS_PX
      // box. Emits ONE rage event anchored like the click, then clears the window
      // so the next burst needs a fresh cluster (no per-click spam).
      const now = Date.now();
      clickWindow.push({ t: now, x: e.clientX, y: e.clientY });
      while (clickWindow.length > 0 && now - clickWindow[0].t > RAGE_WINDOW_MS) clickWindow.shift();
      if (clickWindow.length >= RAGE_COUNT) {
        const xs = clickWindow.map(c => c.x);
        const ys = clickWindow.map(c => c.y);
        if (Math.max(...xs) - Math.min(...xs) <= RAGE_RADIUS_PX && Math.max(...ys) - Math.min(...ys) <= RAGE_RADIUS_PX) {
          push({ kind: 'rage', elementId: taggedId, selector: taggedId ? undefined : cssPath(anchor), relX, relY });
          clickWindow.length = 0;
        }
      }
    };

    // Impressions: observe the tagged elements present at mount / route change.
    // Feature-detected; older browsers simply skip impression capture.
    const dwellTimers = new Map<Element, number>();
    let io: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries, observer) => {
          for (const entry of entries) {
            const el = entry.target;
            if (entry.isIntersecting) {
              if (dwellTimers.has(el)) continue;
              const t = window.setTimeout(() => {
                dwellTimers.delete(el);
                observer.unobserve(el);
                const id = el.getAttribute('data-heatmap-id');
                if (id && !seen.has(id)) {
                  seen.add(id);
                  push({ kind: 'impression', elementId: id });
                }
              }, DWELL_MS);
              dwellTimers.set(el, t);
            } else {
              const t = dwellTimers.get(el);
              if (t !== undefined) {
                window.clearTimeout(t);
                dwellTimers.delete(el);
              }
            }
          }
        },
        { threshold: 0.5 },
      );
      const targets = document.querySelectorAll('[data-heatmap-id]');
      for (let i = 0; i < targets.length && i < MAX_IMPRESSION_TARGETS; i++) io.observe(targets[i]);
    }

    // Scroll depth: track the furthest the viewer reached this pageview (rAF-
    // throttled, only on scrollable pages); emitted once on a terminal flush.
    let maxScroll = 0;
    let scrollSent = false;
    let scrollQueued = false;
    const measureScroll = () => {
      scrollQueued = false;
      const full = document.documentElement.scrollHeight;
      if (full <= window.innerHeight + 4) return; // not scrollable — nothing to learn
      const depth = clamp01((window.scrollY + window.innerHeight) / full);
      if (depth > maxScroll) maxScroll = depth;
    };
    const onScroll = () => {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(measureScroll);
    };

    const flush = (terminal = false) => {
      // Attach this pageview's furthest scroll depth once, on a terminal flush.
      if (terminal && !scrollSent && maxScroll >= SCROLL_MIN) {
        push({ kind: 'scroll', value: maxScroll });
        scrollSent = true;
      }
      if (events.length === 0) return;
      const batch = events.splice(0, events.length);
      const w = window.innerWidth;
      const h = window.innerHeight;
      const payload = {
        path: pathname,
        viewportW: w,
        viewportH: h,
        breakpoint: bucket(w),
        pointer: window.matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'mouse',
        events: batch,
      };
      try {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon('/api/heatmap', blob);
      } catch {
        /* best-effort */
      }
    };

    const onHide = () => {
      if (document.visibilityState === 'hidden') flush(true);
    };

    document.addEventListener('click', onClick, { capture: true });
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('scroll', onScroll, { passive: true });
    const timer = window.setInterval(() => flush(), FLUSH_MS);

    return () => {
      flush(true); // attribute this path's events (incl. final scroll depth) before it changes
      document.removeEventListener('click', onClick, { capture: true } as EventListenerOptions);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('scroll', onScroll);
      window.clearInterval(timer);
      io?.disconnect();
      for (const t of dwellTimers.values()) window.clearTimeout(t);
      dwellTimers.clear();
    };
  }, [pathname]);

  return null;
}
