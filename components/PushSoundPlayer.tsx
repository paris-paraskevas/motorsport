'use client';
import { useEffect } from 'react';

interface PushSoundMessage {
  type: 'paddock:push-sound';
  payload: { sound: string };
}

function isPushSoundMessage(data: unknown): data is PushSoundMessage {
  if (!data || typeof data !== 'object') return false;
  const d = data as { type?: unknown; payload?: { sound?: unknown } };
  return (
    d.type === 'paddock:push-sound' &&
    typeof d.payload?.sound === 'string'
  );
}

export function PushSoundPlayer() {
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      if (!isPushSoundMessage(event.data)) return;
      const audio = new Audio(event.data.payload.sound);
      audio.volume = 1.0;
      // Autoplay may be blocked without a recent user gesture (mobile in
      // particular). We silently swallow the rejection — the visible
      // notification is still shown by the service worker.
      audio.play().catch(() => {});
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage);
    };
  }, []);

  return null;
}
