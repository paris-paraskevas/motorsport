'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
  DEFAULT_HOME_LAYOUT,
  getLocalHomeLayout,
  setLocalHomeLayout,
  reconcileHomeLayout,
  type HomeLayoutPrefs,
  type HomeElementId,
} from './homeLayout';

/**
 * Auth-aware home-layout state.
 *
 * The layout is seeded SYNCHRONOUSLY from localStorage on first client render
 * (every persist writes localStorage, signed-in included), so the home paints in
 * the user's saved order/visibility immediately — no waiting on a KV round-trip.
 * That wait is what used to leave the page in its DEFAULT arrangement until the
 * fetch resolved (the "loads un-customised, then snaps" flash).
 *
 * Signed-in users additionally reconcile against Vercel KV (cross-device) ONCE
 * when auth resolves. That one-shot read is dirty-guarded so it can never clobber
 * an edit the user just made — the previous version re-fetched on every change
 * (via a change event) and the slower PUT lost the race to the GET, which is why
 * a move/hide visibly "rolled back". Mirrors useFollowedSeries.
 */
export function useHomeLayout(): {
  layout: HomeLayoutPrefs;
  move: (id: HomeElementId, dir: -1 | 1) => void;
  reorder: (order: HomeElementId[]) => void;
  toggleHidden: (id: HomeElementId) => void;
  toggleCollapsed: (id: HomeElementId) => void;
  reset: () => void;
} {
  const { isLoaded, isSignedIn } = useAuth();
  const [layout, setLayout] = useState<HomeLayoutPrefs>(() => getLocalHomeLayout() ?? DEFAULT_HOME_LAYOUT);
  const dirty = useRef(false); // touched only in callbacks/effects, never during render

  // One-shot cross-device reconcile for signed-in users. Runs only when auth
  // resolves (NOT on every edit), and the setState lives in the async `.then`
  // continuation — never synchronously in the effect body — so it neither
  // clobbers optimistic edits nor trips react-hooks/set-state-in-effect.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return; // signed out → the localStorage seed is authoritative
    let cancelled = false;
    fetch('/api/user/home-layout')
      .then(res => (res.ok ? res.json() : null))
      .then((data: { layout: HomeLayoutPrefs | null } | null) => {
        if (cancelled || dirty.current || !data) return;
        if (data.layout) {
          const reconciled = reconcileHomeLayout(data.layout);
          setLayout(reconciled);
          setLocalHomeLayout(reconciled); // refresh the local seed for next load
        } else {
          // first sign-in with local prefs → migrate them (the localStorage seed) up to KV
          fetch('/api/user/home-layout', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(getLocalHomeLayout() ?? DEFAULT_HOME_LAYOUT),
          }).catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  const persist = useCallback(
    (next: HomeLayoutPrefs) => {
      dirty.current = true;
      setLayout(next);
      setLocalHomeLayout(next); // synchronous local copy → instant correct paint next load
      if (isSignedIn) {
        fetch('/api/user/home-layout', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        }).catch(() => {
          /* best-effort; UI already updated */
        });
      }
    },
    [isSignedIn],
  );

  // Handlers are recreated each render, so they close over the current `layout`.
  const move = (id: HomeElementId, dir: -1 | 1) => {
    const order = [...layout.order];
    const i = order.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    persist({ ...layout, order });
  };

  // Persist an arbitrary new order (drag-and-drop in the customise banner).
  const reorder = (order: HomeElementId[]) => persist({ ...layout, order });

  const toggleHidden = (id: HomeElementId) => {
    const hidden = layout.hidden.includes(id) ? layout.hidden.filter(x => x !== id) : [...layout.hidden, id];
    persist({ ...layout, hidden });
  };

  const toggleCollapsed = (id: HomeElementId) => {
    const collapsed = layout.collapsed.includes(id)
      ? layout.collapsed.filter(x => x !== id)
      : [...layout.collapsed, id];
    persist({ ...layout, collapsed });
  };

  const reset = () => persist(DEFAULT_HOME_LAYOUT);

  return { layout, move, reorder, toggleHidden, toggleCollapsed, reset };
}
