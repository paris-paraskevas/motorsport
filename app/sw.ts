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

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
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

const FOREGROUND_SOUND_URL = '/sounds/f1-radio-notification.mp3';

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
        data: { url: payload.url ?? '/', ...(payload.data ?? {}) },
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
  const url = data.url ?? '/';
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
