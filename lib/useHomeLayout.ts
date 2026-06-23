'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
  DEFAULT_HOME_LAYOUT,
  getLocalHomeLayout,
  setLocalHomeLayout,
  type HomeLayoutPrefs,
  type HomeElementId,
} from './homeLayout';

const CHANGED_EVENT = 'paddock:home-layout-changed';

function emitChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGED_EVENT));
}

/**
 * Auth-aware home-layout state. Signed in → Vercel KV via /api/user/home-layout
 * (cross-device); signed out → localStorage. On first sign-in, an empty KV with
 * local prefs migrates local → KV. Mirrors useFollowedSeries.
 */
export function useHomeLayout(): {
  layout: HomeLayoutPrefs;
  hydrated: boolean;
  move: (id: HomeElementId, dir: -1 | 1) => void;
  toggleHidden: (id: HomeElementId) => void;
  reset: () => void;
} {
  const { isLoaded, isSignedIn } = useAuth();
  const [layout, setLayout] = useState<HomeLayoutPrefs>(DEFAULT_HOME_LAYOUT);
  const [hydrated, setHydrated] = useState(false);

  const hydrate = useCallback(async () => {
    if (!isLoaded) return;
    if (isSignedIn) {
      try {
        const res = await fetch('/api/user/home-layout');
        if (res.ok) {
          const data = (await res.json()) as { layout: HomeLayoutPrefs | null };
          if (data.layout === null) {
            const local = getLocalHomeLayout();
            if (local) {
              await fetch('/api/user/home-layout', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(local),
              });
              setLayout(local);
              setHydrated(true);
              return;
            }
          }
          setLayout(data.layout ?? DEFAULT_HOME_LAYOUT);
          setHydrated(true);
          return;
        }
      } catch {
        /* fall through to local */
      }
    }
    setLayout(getLocalHomeLayout() ?? DEFAULT_HOME_LAYOUT);
    setHydrated(true);
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    hydrate();
    const onChange = () => hydrate();
    window.addEventListener(CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CHANGED_EVENT, onChange);
  }, [hydrate]);

  const persist = useCallback(
    (next: HomeLayoutPrefs) => {
      setLayout(next);
      if (isSignedIn) {
        fetch('/api/user/home-layout', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        }).catch(() => {
          /* best-effort; UI already updated */
        });
      } else {
        setLocalHomeLayout(next);
      }
      emitChange();
    },
    [isSignedIn],
  );

  const move = (id: HomeElementId, dir: -1 | 1) => {
    const order = [...layout.order];
    const i = order.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    persist({ ...layout, order });
  };

  const toggleHidden = (id: HomeElementId) => {
    const hidden = layout.hidden.includes(id)
      ? layout.hidden.filter(x => x !== id)
      : [...layout.hidden, id];
    persist({ ...layout, hidden });
  };

  const reset = () => persist(DEFAULT_HOME_LAYOUT);

  return { layout, hydrated, move, toggleHidden, reset };
}
