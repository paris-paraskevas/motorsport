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

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  image?: string;
  /** Accent color applied to the notification chrome on Chromium/Android. */
  color?: string;
}

// Brand accent colour for the notification chip on Android.
// Picked to read against the black launcher icon background.
const ACCENT_COLOR = '#e10600';

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;
  let payload: PushPayload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Paddock', body: event.data.text() };
  }
  const title = payload.title ?? 'Paddock';
  // NotificationOptions in TS doesn't surface `image`/`color`, but Chromium
  // honours both. Cast through `unknown` to allow them without `any`.
  const options = {
    body: payload.body ?? 'Tap to open Paddock.',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: payload.tag,
    data: { url: payload.url ?? '/' },
    image: payload.image,
    color: payload.color ?? ACCENT_COLOR,
    vibrate: [80, 40, 80],
    timestamp: Date.now(),
  } as unknown as NotificationOptions;
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | null)?.url ?? '/';
  event.waitUntil(
    (async () => {
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
