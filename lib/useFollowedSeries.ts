'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getFollowedSeries as getLocalFollowed } from './follow';

interface State {
  followed: string[] | null;
  hydrated: boolean;
}

const FOLLOWED_CHANGED_EVENT = 'paddock:followed-changed';

function emitChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(FOLLOWED_CHANGED_EVENT));
  }
}

/**
 * Auth-aware followed-series state.
 *
 * Signed in → Vercel KV via /api/user/prefs (cross-device sync).
 * Signed out → browser localStorage as today.
 * On first sign-in: if KV is empty and localStorage has prefs, migrate local → KV.
 */
export function useFollowedSeries(): {
  followed: string[] | null;
  hydrated: boolean;
  setFollowed: (slugs: string[]) => void | Promise<void>;
  clearFollowed: () => void;
} {
  const { isLoaded, isSignedIn } = useAuth();
  const [{ followed, hydrated }, setState] = useState<State>({
    followed: null,
    hydrated: false,
  });

  const hydrate = useCallback(async () => {
    if (!isLoaded) return;

    // Following is a signed-in feature: a guest always follows everything (null)
    // — no localStorage personalization. The Settings follow controls render a
    // sign-in CTA for guests, so setFollowed is never reached signed-out.
    if (!isSignedIn) {
      setState({ followed: null, hydrated: true });
      return;
    }

    try {
      const res = await fetch('/api/user/prefs');
      if (res.ok) {
        const data = (await res.json()) as { followed: string[] | null };
        // One-time migration: empty KV + local prefs (left by a pre-gate guest
        // session on this device) → push local to KV on first sign-in.
        if (data.followed === null) {
          const local = getLocalFollowed();
          if (local && local.length > 0) {
            await fetch('/api/user/prefs', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ followed: local }),
            });
            setState({ followed: local, hydrated: true });
            return;
          }
        }
        setState({ followed: data.followed, hydrated: true });
        return;
      }
    } catch {
      /* fall through to the local mirror */
    }
    setState({ followed: getLocalFollowed(), hydrated: true });
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate() adopts the local mirror synchronously on mount — the hydration-safe pattern
    hydrate();
    const onChange = () => hydrate();
    window.addEventListener(FOLLOWED_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(FOLLOWED_CHANGED_EVENT, onChange);
  }, [hydrate]);

  const setFollowed = useCallback(
    async (slugs: string[]) => {
      // Following is signed-in only — a guest can't persist a set (the Settings
      // controls are a sign-in CTA, so this guard is belt-and-suspenders).
      if (!isSignedIn) return;
      setState({ followed: slugs, hydrated: true });
      try {
        await fetch('/api/user/prefs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ followed: slugs }),
        });
      } catch {
        // best-effort; UI already optimistically updated
      }
      emitChange();
    },
    [isSignedIn],
  );

  const clearFollowed = useCallback(() => {
    if (!isSignedIn) return;
    setState({ followed: null, hydrated: true });
    fetch('/api/user/prefs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followed: null }),
    }).catch(() => {});
    emitChange();
  }, [isSignedIn]);

  return { followed, hydrated, setFollowed, clearFollowed };
}
