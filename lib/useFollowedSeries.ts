'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
  getFollowedSeries as getLocalFollowed,
  setFollowedSeries as setLocalFollowed,
} from './follow';

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

    if (isSignedIn) {
      try {
        const res = await fetch('/api/user/prefs');
        if (res.ok) {
          const data = (await res.json()) as { followed: string[] | null };
          // One-time migration: empty KV + local prefs → push local to KV.
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
        /* fall through to local */
      }
    }
    setState({ followed: getLocalFollowed(), hydrated: true });
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    hydrate();
    const onChange = () => hydrate();
    window.addEventListener(FOLLOWED_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(FOLLOWED_CHANGED_EVENT, onChange);
  }, [hydrate]);

  const setFollowed = useCallback(
    async (slugs: string[]) => {
      setState({ followed: slugs, hydrated: true });
      if (isSignedIn) {
        try {
          await fetch('/api/user/prefs', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ followed: slugs }),
          });
        } catch {
          // best-effort; UI already optimistically updated
        }
      } else {
        setLocalFollowed(slugs);
      }
      emitChange();
    },
    [isSignedIn],
  );

  const clearFollowed = useCallback(() => {
    setState({ followed: null, hydrated: true });
    setLocalFollowed([]);
    emitChange();
  }, []);

  return { followed, hydrated, setFollowed, clearFollowed };
}
