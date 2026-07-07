/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Offline fallback — precache the branded /offline page and serve it whenever
// a document navigation can't be satisfied (defaultCache's NetworkFirst page
// strategies fail with no cached copy). The revision is derived from the
// injected build manifest: stable across SW restarts within one build, changes
// exactly when a new build ships — so the cached HTML always references the
// current hashed chunks instead of purged ones.
const OFFLINE_FALLBACK_URL = '/offline';
const manifest = self.__SW_MANIFEST ?? [];
const offlineRevision = (() => {
  const s = JSON.stringify(manifest);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
})();

const serwist = new Serwist({
  precacheEntries: [...manifest, { url: OFFLINE_FALLBACK_URL, revision: offlineRevision }],
  // Let a new SW install + precache in the BACKGROUND and activate on the NEXT
  // launch, rather than skip-waiting into the current open. Every deploy makes
  // all ~218 precache entries new; skipWaiting activated that busy SW mid-open,
  // hijacking the first post-deploy open (~20-30s on mobile wifi). The old,
  // fully-cached SW keeps serving the current open instantly. Trade-off: an
  // update applies one launch later — fine for a content PWA.
  skipWaiting: false,
  clientsClaim: false,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: OFFLINE_FALLBACK_URL,
        matcher({ request }) {
          return request.destination === 'document';
        },
      },
    ],
  },
});

serwist.addEventListeners();

// --- Web push handlers ---

interface PushAction {
  action: string;
  title: string;
  icon?: string;
}

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  image?: string;
  /** Accent color applied to the notification chrome on Chromium/Android. */
  color?: string;
  actions?: PushAction[];
  data?: Record<string, string>;
  /** Suppress system notification sound when true. */
  silent?: boolean;
}

// Brand accent colour for the notification chip on Android.
// Picked to read against the black launcher icon background.
const ACCENT_COLOR = '#e10600';

// Paddock's original two-tone chime (synthesized in-repo by
// scripts/gen-notification-sound.mjs — no third-party audio licensing).
const FOREGROUND_SOUND_URL = '/sounds/paddock-chime.wav';

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;
  let payload: PushPayload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Paddock Tracker', body: event.data.text() };
  }
  const title = payload.title ?? 'Paddock Tracker';

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      const visibleClients = clients.filter(
        c => c.visibilityState === 'visible',
      );
      const hasVisibleClient = visibleClients.length > 0;
      const callerMuted = payload.silent === true;
      // Suppress the OS notification sound when the app is foregrounded — we'll
      // play our own audio cue via the visible client so the two don't overlap.
      const suppressSystemSound = hasVisibleClient || callerMuted;

      // NotificationOptions in TS doesn't surface `image`/`color`/`actions`, but
      // Chromium honours all of them. Cast through `unknown` to allow without `any`.
      const options = {
        body: payload.body ?? 'Tap to open Paddock Tracker.',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-96.png',
        tag: payload.tag,
        data: { url: payload.url ?? '/app', ...(payload.data ?? {}) },
        image: payload.image,
        color: payload.color ?? ACCENT_COLOR,
        actions: payload.actions ?? [],
        silent: suppressSystemSound,
        vibrate: suppressSystemSound ? undefined : [80, 40, 80],
        timestamp: Date.now(),
      } as unknown as NotificationOptions;

      await self.registration.showNotification(title, options);

      if (hasVisibleClient && !callerMuted) {
        for (const client of visibleClients) {
          client.postMessage({
            type: 'paddock:push-sound',
            payload: { sound: FOREGROUND_SOUND_URL },
          });
        }
      }
    })(),
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const data = (event.notification.data as { url?: string; seriesSlug?: string } | null) ?? {};
  const url = data.url ?? '/app';
  const action = event.action;

  event.waitUntil(
    (async () => {
      if (action === 'mute' && data.seriesSlug) {
        // Best-effort: tell the server to mute this series for the user.
        // The fetch uses the user's auth cookies; if they're signed out it
        // will 401 silently and we still fall through to opening the URL.
        try {
          await fetch('/api/user/mute-series', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seriesSlug: data.seriesSlug, action: 'mute' }),
          });
        } catch {
          // ignore
        }
        return;
      }

      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        if (client.url.endsWith(url) && 'focus' in client) {
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
